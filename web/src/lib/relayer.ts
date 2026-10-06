import "server-only";
import { address, type Address, type Instruction } from "@solana/kit";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import bs58 from "bs58";
import { commissionsFor } from "./chain";
import { beamEnabled, beamTipIx, rpcUrl } from "./solami";
import {
  COMMISSION_LEN,
  TREASURY,
  decodeTokenAccount,
  findAta,
  recordSaleIx,
  releaseIx,
  type Campaign,
} from "./commish/program";

/**
 * The relayer and keeper, run inside the site's own requests instead of as
 * long-lived processes. The relayer key is the campaign's attestor; it lives
 * in the server environment and its blast radius is the vault's unreserved
 * balance. The keeper side only calls the permissionless `release`.
 */
const RPC = rpcUrl();

function keypair(env: string): Keypair | null {
  const v = process.env[env]?.trim();
  if (!v) return null;
  return Keypair.fromSecretKey(v.startsWith("[") ? Uint8Array.from(JSON.parse(v)) : bs58.decode(v));
}

export const relayerKey = () => keypair("RELAYER_SECRET_KEY");
/** Falls back to the relayer key: release needs only a fee payer. */
export const keeperKey = () => keypair("KEEPER_SECRET_KEY") ?? relayerKey();

const web3 = (ix: Instruction) =>
  new TransactionInstruction({
    programId: new PublicKey(ix.programAddress),
    keys: (ix.accounts ?? []).map((m) => ({ pubkey: new PublicKey(m.address), isWritable: (m.role & 1) === 1, isSigner: (m.role & 2) === 2 })),
    data: Buffer.from(ix.data ?? new Uint8Array()),
  });

/** Sends one transaction and waits up to ~20 s for confirmation. Returns the signature, or throws. */
async function send(conn: Connection, signer: Keypair, ixs: Instruction[]): Promise<string> {
  const t = new Transaction().add(...ixs.map(web3));
  // Beam (Solami): a tip transfer in the transaction routes the plain
  // sendRawTransaction below through Beam. Null when Beam is off.
  const tip = beamEnabled() ? await beamTipIx(signer.publicKey) : null;
  if (tip) t.add(tip);
  t.feePayer = signer.publicKey;
  t.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;
  t.sign(signer);
  const sig = await conn.sendRawTransaction(t.serialize(), { maxRetries: 3 });
  for (let i = 0; i < 20; i++) {
    const st = (await conn.getSignatureStatuses([sig])).value[0];
    if (st?.err) throw new Error(`transaction failed: ${JSON.stringify(st.err)}`);
    if (st?.confirmationStatus === "confirmed" || st?.confirmationStatus === "finalized") return sig;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("not confirmed in time");
}

/** record_sale for a verified payment. The caller has already checked the payment and replay. */
export async function recordSale(c: Campaign, orderHash: Uint8Array, orderAmount: bigint, router: Address): Promise<string> {
  const kp = relayerKey();
  if (!kp) throw new Error("relayer not configured");
  const relayer = address(kp.publicKey.toBase58());
  if (relayer !== c.attestor) throw new Error("relayer key is not this campaign's attestor");
  const conn = new Connection(RPC, "confirmed");
  const lamports = BigInt(await conn.getMinimumBalanceForRentExemption(COMMISSION_LEN));
  const { instruction } = await recordSaleIx({ attestor: relayer, payer: relayer, campaign: c.address, vault: c.vault, orderHash, orderAmount, creator: router, lamports });
  return send(conn, kp, [instruction]);
}

let lastSweep = 0;

/**
 * Releases every commission of `c` whose window has closed. Throttled to once
 * per 30 s per instance; meant to run after a response (next/server `after`).
 * A commission whose payee has no USDC account is skipped, not forced.
 */
export async function sweepDue(c: Campaign): Promise<string[]> {
  const kp = keeperKey();
  if (!kp || Date.now() - lastSweep < 30_000) return [];
  lastSweep = Date.now();
  const conn = new Connection(RPC, "confirmed");
  const now = BigInt(Math.floor(Date.now() / 1000));
  const due = (await commissionsFor("campaign", c.address)).filter((m) => m.releaseAt <= now).slice(0, 5);
  const treasuryToken = await findAta(TREASURY, c.mint);
  const done: string[] = [];
  for (const m of due) {
    const payeeToken = await findAta(m.payee, c.mint);
    const acct = await conn.getAccountInfo(new PublicKey(payeeToken), "confirmed");
    if (!acct || decodeTokenAccount(Uint8Array.from(acct.data))?.owner !== m.payee) continue;
    try {
      done.push(await send(conn, kp, [releaseIx({ campaign: c.address, vault: c.vault, commission: m.address, payeeToken, rentPayer: m.rentPayer, treasuryToken })]));
    } catch {
      // Another keeper (or an earlier sweep) may have released it.
    }
  }
  return done;
}
