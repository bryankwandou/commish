// One-time mainnet setup for the public 402 endpoint (/api/agent/call).
// Usage: RPC_URL=<mainnet rpc> node --import tsx scripts/live-setup.mts <swap|campaign>
//   swap      CALLER swaps SWAP_LAMPORTS (default 0.003 SOL) to USDC via Jupiter
//   campaign  TOOL_TREASURY creates the campaign (RELAYER attests, 600 s, 10%)
//             and the ROUTER's USDC account, then prints COMMISH_DEMO_CAMPAIGN
// Keys come from agents/keys/mainnet/<ROLE>.keypair.json (gitignored).
import { readFileSync } from "node:fs";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import { address, type Address, type Instruction } from "@solana/kit";
import * as C from "../src/lib/commish/program.ts";

const RPC = process.env.RPC_URL ?? "";
if (!RPC) throw new Error("RPC_URL is required");
const cx = new Connection(RPC, "confirmed");
const role = (r: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(new URL(`../../agents/keys/mainnet/${r}.keypair.json`, import.meta.url), "utf8"))));
const a = (k: Keypair): Address => address(k.publicKey.toBase58());
const web3 = (ix: Instruction) => new TransactionInstruction({
  programId: new PublicKey(ix.programAddress),
  keys: (ix.accounts ?? []).map((m) => ({ pubkey: new PublicKey(m.address), isWritable: (m.role & 1) === 1, isSigner: (m.role & 2) === 2 })),
  data: Buffer.from(ix.data ?? new Uint8Array()),
});
async function send(ixs: Instruction[], signers: Keypair[]) {
  const t = new Transaction().add(...ixs.map(web3));
  const sig = await cx.sendTransaction(t, signers, { preflightCommitment: "confirmed" });
  await cx.confirmTransaction(sig, "confirmed");
  return sig;
}

const cmd = process.argv[2];
if (cmd === "swap") {
  const caller = role("CALLER");
  const amount = process.env.SWAP_LAMPORTS ?? "3000000";
  const quote = await (await fetch(`https://lite-api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${C.USDC_MINT}&amount=${amount}&slippageBps=100`)).json();
  if (!quote.outAmount) throw new Error(`no quote: ${JSON.stringify(quote)}`);
  const { swapTransaction } = await (await fetch("https://lite-api.jup.ag/swap/v1/swap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ quoteResponse: quote, userPublicKey: caller.publicKey.toBase58(), wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true }),
  })).json();
  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
  tx.sign([caller]);
  const sig = await cx.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
  await cx.confirmTransaction(sig, "confirmed");
  console.log(JSON.stringify({ swap: sig, expectedUsdc: quote.outAmount }));
} else if (cmd === "campaign") {
  const tool = role("TOOL_TREASURY"), relayer = role("RELAYER"), router = role("ROUTER");
  const lamports = BigInt(await cx.getMinimumBalanceForRentExemption(C.CAMPAIGN_LEN));
  const cc = await C.createCampaignIxs({ brand: a(tool), id: C.randomCampaignId(), bps: 1000, holdSeconds: 600n, attestor: a(relayer), mint: C.USDC_MINT, lamports });
  const routerAta = await C.findAta(a(router), C.USDC_MINT);
  const sig = await send([...cc.instructions, C.createAtaIx(a(tool), routerAta, a(router), C.USDC_MINT)], [tool]);
  console.log(JSON.stringify({ create: sig, COMMISH_DEMO_CAMPAIGN: cc.campaign, vault: cc.vault, routerAta }));
} else {
  throw new Error("usage: live-setup.mts <swap|campaign>");
}
