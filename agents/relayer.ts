/**
 * Relayer: sees a USDC payment into the campaign vault, verifies it per
 * agents/SPEC.md, and records the router's commission (record_sale), signed
 * by the RELAYER key (campaign attestor), which also pays the rent.
 *
 *   npx tsx agents/relayer.ts record <payment-signature>
 *   npx tsx agents/relayer.ts cancel <payment-signature> <refund-signature>
 *   npx tsx agents/relayer.ts watch
 *
 * Env: CAMPAIGN (required), CLUSTER, RPC_URL, RPC_URL_2, USDC_MINT, PRICE
 * (min base units, default 50000), LEDGER (JSONL path), ROLES, POLL_MS.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { address, getBase58Encoder, isAddress, type Address, type KeyPairSigner, type Signature } from "@solana/kit";
import {
  COMMISSION_LEN,
  PROGRAM_ID,
  USDC_MINT,
  cancelIx,
  decodeCampaign,
  decodeCommission,
  findCommission,
  recordSaleIx,
  type Campaign,
} from "../web/src/lib/commish/program";
import { RpcPool, TxError, accountBytes, agentsPath, cluster, errText, founderPubkeys, loadRole, log, rentFor, sendTx, sleep, MEMO_PROGRAM } from "./lib";

const DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export type RelayerConfig = {
  pool: RpcPool;
  relayer: KeyPairSigner;
  campaign: Address;
  /** Expected USDC mint; must equal the campaign mint. */
  mint: Address;
  /** Minimum accepted payment, base units. */
  minPrice: bigint;
  ledgerPath: string;
  founders: Set<string>;
};

export type Verified = {
  ok: true;
  signature: string;
  amount: bigint;
  /** null = no ref memo: the call succeeds, no commission. */
  ref: Address | null;
  feePayer: string;
  label: "SOAK" | "FOREIGN";
};
export type Rejected = { ok: false; signature: string; status: 400 | 402 | 409 | 500; reason: string };

export type RecordResult =
  | (Verified & { recorded: true; commission: Address; orderHash: string; releaseAt: bigint; tx: string })
  | (Verified & { recorded: false; reason: string })
  | Rejected;

// ------------------------------------------------------------------ ledger

type LedgerRow = { payment: string; status: string; commission?: string; tx?: string; t: string };

export function ledgerHas(path: string, sig: string): boolean {
  if (!existsSync(path)) return false;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as LedgerRow;
      if (r.payment === sig) return true;
    } catch {
      /* skip corrupt line */
    }
  }
  return false;
}

function ledgerAppend(path: string, row: Omit<LedgerRow, "t">) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify({ ...row, t: new Date().toISOString() }) + "\n");
}

// ------------------------------------------------------------------ helpers

export function x402OrderHash(campaign: Address, paymentSig: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(`commish:x402:${campaign}:${paymentSig}`).digest());
}

async function loadCampaign(pool: RpcPool, campaign: Address): Promise<Campaign | null> {
  const b = await accountBytes(pool, campaign);
  return b ? decodeCampaign(campaign, b) : null;
}

async function getParsedTx(pool: RpcPool, sig: string): Promise<any | null> {
  return pool.call(
    (r) =>
      r
        .getTransaction(sig as Signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" })
        .send() as Promise<any>,
    "getTransaction",
  );
}

/** All parsed instructions, top-level and inner. */
function allIxs(tx: any): any[] {
  const top: any[] = tx?.transaction?.message?.instructions ?? [];
  const inner: any[] = (tx?.meta?.innerInstructions ?? []).flatMap((i: any) => i.instructions ?? []);
  return [...top, ...inner];
}

/**
 * Whether `pda` was ever created by a successful record_sale. Only the
 * campaign's attestor can make one succeed, so lamports or junk transactions
 * aimed at the predictable address do not count (they would otherwise let
 * anyone block a router's cut by touching the address first).
 */
export async function wasRecorded(pool: RpcPool, pda: Address): Promise<boolean | "too_many"> {
  const sigs = await pool.call((r) => r.getSignaturesForAddress(pda, { limit: 1000, commitment: "confirmed" }).send(), "history");
  if (sigs.length >= 1000) return "too_many"; // fail closed; costs an attacker ~0.005 SOL per payment
  const b58 = getBase58Encoder();
  for (const s of sigs) {
    if (s.err) continue;
    const tx = await getParsedTx(pool, s.signature);
    for (const ix of allIxs(tx)) {
      if (ix.programId !== PROGRAM_ID || !Array.isArray(ix.accounts) || typeof ix.data !== "string") continue;
      if (ix.accounts[4] === pda && b58.encode(ix.data)[0] === 1) return true;
    }
  }
  return false;
}

function memos(tx: any): string[] {
  return allIxs(tx)
    .filter((ix) => ix.programId === MEMO_PROGRAM || ix.program === "spl-memo")
    .map((ix) => (typeof ix.parsed === "string" ? ix.parsed : ""))
    .filter((m) => m.length > 0);
}

function accountKeys(tx: any): string[] {
  return (tx?.transaction?.message?.accountKeys ?? []).map((k: any) => (typeof k === "string" ? k : k.pubkey));
}

function tokenAccountMint(tx: any, acct: string): string | undefined {
  const keys = accountKeys(tx);
  const idx = keys.indexOf(acct);
  const all = [...(tx?.meta?.postTokenBalances ?? []), ...(tx?.meta?.preTokenBalances ?? [])];
  return all.find((b: any) => b.accountIndex === idx)?.mint;
}

/** Sum of SPL token transfers of `mint` from `source?` to `dest`. */
function transfersTo(tx: any, dest: string, mint: string, source?: string): bigint {
  let sum = 0n;
  for (const ix of allIxs(tx)) {
    if (ix.program !== "spl-token" || !ix.parsed) continue;
    const { type, info } = ix.parsed;
    if (type !== "transfer" && type !== "transferChecked") continue;
    if (info.destination !== dest) continue;
    if (source && info.source !== source) continue;
    const m = info.mint ?? tokenAccountMint(tx, dest);
    if (m !== mint) continue;
    const amt = info.tokenAmount?.amount ?? info.amount;
    try {
      sum += BigInt(amt);
    } catch {
      /* ignore */
    }
  }
  return sum;
}

// ------------------------------------------------------------------ verify

/** Verify a payment per SPEC: success, USDC mint, dest = vault, amount >= price, memo ref. */
export async function verifyPayment(cfg: RelayerConfig, sig: string): Promise<Verified | Rejected> {
  try {
    const camp = await loadCampaign(cfg.pool, cfg.campaign);
    if (!camp) return { ok: false, signature: sig, status: 500, reason: "campaign_not_found" };
    if (camp.mint !== cfg.mint) return { ok: false, signature: sig, status: 500, reason: "campaign_mint_is_not_usdc" };
    const tx = await getParsedTx(cfg.pool, sig);
    if (!tx) return { ok: false, signature: sig, status: 402, reason: "payment_not_found_or_unconfirmed" };
    if (tx.meta?.err) return { ok: false, signature: sig, status: 402, reason: "payment_failed_on_chain" };
    const amount = transfersTo(tx, camp.vault, camp.mint);
    if (amount === 0n) return { ok: false, signature: sig, status: 402, reason: "no_usdc_transfer_to_vault" };
    if (amount < cfg.minPrice) return { ok: false, signature: sig, status: 402, reason: `amount_below_price:${amount}<${cfg.minPrice}` };
    const feePayer = accountKeys(tx)[0] ?? "";
    const label = cfg.founders.has(feePayer) ? "SOAK" : "FOREIGN";
    const refMemos = memos(tx).filter((m) => m.startsWith("commish:") && m !== "commish:soak");
    if (refMemos.length === 0) return { ok: true, signature: sig, amount, ref: null, feePayer, label };
    const ref = refMemos[0].slice("commish:".length).trim();
    if (!isAddress(ref)) return { ok: false, signature: sig, status: 400, reason: "invalid_ref" };
    return { ok: true, signature: sig, amount, ref: address(ref), feePayer, label };
  } catch (e) {
    return { ok: false, signature: sig, status: 500, reason: `verify_error:${errText(e).slice(0, 200)}` };
  }
}

/**
 * Verify + dedupe + record_sale. Safe to call from the web endpoint.
 * Refuses when the payment is in the ledger or its commission PDA has any
 * history (replay after close).
 */
export async function recordPayment(cfg: RelayerConfig, sig: string): Promise<RecordResult> {
  if (ledgerHas(cfg.ledgerPath, sig)) {
    log("relayer_refuse", { payment: sig, reason: "already_in_ledger" });
    return { ok: false, signature: sig, status: 409, reason: "already_processed" };
  }
  const v = await verifyPayment(cfg, sig);
  if (!v.ok) {
    log("relayer_reject", { payment: sig, status: v.status, reason: v.reason });
    if (v.status === 400) ledgerAppend(cfg.ledgerPath, { payment: sig, status: "invalid_ref" });
    return v;
  }
  if (!v.ref) {
    ledgerAppend(cfg.ledgerPath, { payment: sig, status: "no_ref" });
    log("relayer_no_ref", { payment: sig, amount: v.amount, label: v.label });
    return { ...v, recorded: false, reason: "no_ref" };
  }
  try {
    const hash = x402OrderHash(cfg.campaign, sig);
    const { address: pda } = await findCommission(cfg.campaign, hash);
    const seen = await wasRecorded(cfg.pool, pda);
    if (seen !== false) {
      ledgerAppend(cfg.ledgerPath, { payment: sig, status: "refused_pda_history", commission: pda });
      log("relayer_refuse", { payment: sig, reason: "commission_pda_has_history", commission: pda });
      return { ok: false, signature: sig, status: 409, reason: "commission_pda_has_history" };
    }
    const camp = await loadCampaign(cfg.pool, cfg.campaign);
    if (!camp) return { ok: false, signature: sig, status: 500, reason: "campaign_not_found" };
    const { commission, instruction } = await recordSaleIx({
      attestor: cfg.relayer.address,
      payer: cfg.relayer.address,
      campaign: cfg.campaign,
      vault: camp.vault,
      orderHash: hash,
      orderAmount: v.amount,
      creator: v.ref,
      lamports: await rentFor(cfg.pool, COMMISSION_LEN),
    });
    const tx = await sendTx(cfg.pool, [cfg.relayer], [instruction], "record_sale");
    const b = await accountBytes(cfg.pool, commission);
    const com = b ? decodeCommission(commission, b) : null;
    ledgerAppend(cfg.ledgerPath, { payment: sig, status: "recorded", commission, tx });
    log("relayer_recorded", { payment: sig, commission, tx, amount: v.amount, ref: v.ref, label: v.label, releaseAt: com?.releaseAt });
    return { ...v, recorded: true, commission, orderHash: Buffer.from(hash).toString("hex"), releaseAt: com?.releaseAt ?? 0n, tx };
  } catch (e) {
    const code = e instanceof TxError ? e.code : undefined;
    log("relayer_error", { payment: sig, code, error: errText(e).slice(0, 400) });
    return { ok: false, signature: sig, status: 500, reason: `record_failed${code ? `:${code}` : ""}` };
  }
}

/**
 * Cancel with proof: `refundSig` must move USDC from the vault to the payer's
 * token account (the payment's source) and carry memo "commish:refund:<paymentSig>".
 */
export async function cancelWithProof(cfg: RelayerConfig, paymentSig: string, refundSig: string): Promise<{ ok: boolean; reason?: string; tx?: string }> {
  try {
    const camp = await loadCampaign(cfg.pool, cfg.campaign);
    if (!camp) return { ok: false, reason: "campaign_not_found" };
    const pay = await getParsedTx(cfg.pool, paymentSig);
    const ref = await getParsedTx(cfg.pool, refundSig);
    if (!pay || !ref || ref.meta?.err) return { ok: false, reason: "tx_not_found" };
    const src = allIxs(pay).find((ix) => ix.program === "spl-token" && ix.parsed?.info?.destination === camp.vault)?.parsed?.info?.source;
    if (!src) return { ok: false, reason: "payment_source_unknown" };
    if (transfersTo(ref, src, camp.mint, camp.vault) === 0n) return { ok: false, reason: "no_refund_transfer_from_vault" };
    if (!memos(ref).includes(`commish:refund:${paymentSig}`)) return { ok: false, reason: "refund_memo_missing" };
    const { address: commission } = await findCommission(cfg.campaign, x402OrderHash(cfg.campaign, paymentSig));
    const b = await accountBytes(cfg.pool, commission);
    const com = b ? decodeCommission(commission, b) : null;
    if (!com) return { ok: false, reason: "commission_not_open" };
    const tx = await sendTx(cfg.pool, [cfg.relayer], [cancelIx({ attestor: cfg.relayer.address, campaign: cfg.campaign, commission, rentPayer: com.rentPayer })], "cancel");
    ledgerAppend(cfg.ledgerPath, { payment: paymentSig, status: "cancelled", commission, tx });
    log("relayer_cancelled", { payment: paymentSig, refund: refundSig, commission, tx });
    return { ok: true, tx };
  } catch (e) {
    log("relayer_cancel_error", { payment: paymentSig, error: errText(e).slice(0, 400) });
    return { ok: false, reason: errText(e).slice(0, 200) };
  }
}

// ------------------------------------------------------------------ watch

export async function watch(cfg: RelayerConfig, pollMs = Number(process.env.POLL_MS ?? 5000)) {
  const camp = await loadCampaign(cfg.pool, cfg.campaign);
  if (!camp) throw new Error("campaign not found");
  let until: string | undefined;
  let backoff = pollMs;
  log("relayer_watch_start", { campaign: cfg.campaign, vault: camp.vault });
  for (;;) {
    try {
      const sigs = await cfg.pool.call(
        (r) => r.getSignaturesForAddress(camp.vault, { limit: 100, commitment: "confirmed", ...(until ? { until: until as Signature } : {}) }).send(),
        "vault_signatures",
      );
      if (sigs.length) until = sigs[0].signature;
      for (const s of [...sigs].reverse()) {
        if (s.err || ledgerHas(cfg.ledgerPath, s.signature)) continue;
        await recordPayment(cfg, s.signature);
      }
      backoff = pollMs;
    } catch (e) {
      backoff = Math.min(backoff * 2, 60_000);
      log("relayer_watch_error", { error: errText(e).slice(0, 300), nextPollMs: backoff });
    }
    await sleep(backoff);
  }
}

// ------------------------------------------------------------------ CLI

export async function configFromEnv(): Promise<RelayerConfig> {
  const c = cluster();
  const campaign = process.env.CAMPAIGN;
  if (!campaign || !isAddress(campaign)) throw new Error("set CAMPAIGN=<campaign address>");
  const mint = process.env.USDC_MINT ?? (c === "mainnet" ? USDC_MINT : c === "devnet" ? DEVNET_USDC : "");
  if (!isAddress(mint)) throw new Error("set USDC_MINT (required on localnet)");
  return {
    pool: new RpcPool(),
    relayer: await loadRole("RELAYER"),
    campaign: address(campaign),
    mint: address(mint),
    minPrice: BigInt(process.env.PRICE ?? "50000"),
    ledgerPath: agentsPath(process.env.LEDGER ?? `ledger/relayer-${c}.jsonl`),
    founders: founderPubkeys(),
  };
}

async function main() {
  const [cmd, a1, a2] = process.argv.slice(2);
  if (cluster() === "mainnet" && process.env.CONFIRM_MAINNET !== "yes") throw new Error("mainnet refused: set CONFIRM_MAINNET=yes");
  const cfg = await configFromEnv();
  if (cmd === "record" && a1) {
    const r = await recordPayment(cfg, a1);
    log("result", r as any);
    process.exitCode = r.ok ? 0 : 1;
  } else if (cmd === "cancel" && a1 && a2) {
    const r = await cancelWithProof(cfg, a1, a2);
    log("result", r);
    process.exitCode = r.ok ? 0 : 1;
  } else if (cmd === "watch") {
    await watch(cfg);
  } else {
    console.error("usage: relayer.ts record <sig> | cancel <paymentSig> <refundSig> | watch");
    process.exitCode = 2;
  }
}

if (process.argv[1] && /relayer\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    log("fatal", { error: errText(e) });
    process.exitCode = 1;
  });
}

