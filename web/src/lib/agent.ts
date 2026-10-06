import "server-only";
import { address, type Address } from "@solana/kit";
import {
  PROGRAM_ID,
  USDC_MINT,
  decodeCampaign,
  decodeTokenAccount,
  findCommission,
  type Campaign,
} from "./commish/program";
import { SITE_URL } from "./config";

export const PRICE = 50_000n;
export const ROUTER_BPS = 1000;
const RPC = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";

export class RpcError extends Error {}

export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let j: { error?: { message: string }; result?: T };
  try {
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    j = await r.json();
  } catch (e) {
    throw new RpcError(`${method}: ${e instanceof Error ? e.message : "request failed"}`);
  }
  if (j.error) throw new RpcError(`${method}: ${j.error.message}`);
  return j.result as T;
}

export const rpcDown = () => err(503, "rpc_unavailable", "Solana RPC is unavailable or timed out. Retry shortly.");

/** Whether `a` is an account owned by the Commish program (lamports alone do not count). */
export async function accountExists(a: string): Promise<boolean> {
  const r = await rpc<{ value: { owner: string } | null }>("getAccountInfo", [a, { encoding: "base64", commitment: "confirmed", dataSlice: { offset: 0, length: 0 } }]);
  return r.value?.owner === PROGRAM_ID;
}

/**
 * Whether `pda` was ever created by a successful record_sale. Lamports or junk
 * transactions aimed at the predictable address do not count; otherwise anyone
 * could make a paid call look already redeemed by touching the address first.
 * Over 1,000 signatures fails closed (true).
 */
export async function wasRecorded(pda: string): Promise<boolean> {
  const sigs = await rpc<{ signature: string; err: unknown }[]>("getSignaturesForAddress", [pda, { limit: 1000, commitment: "confirmed" }]);
  if (sigs.length >= 1000) return true;
  for (const s of sigs) {
    if (s.err) continue;
    const tx = await rpc<{ transaction: { message: { instructions: RawIx[] } }; meta: { innerInstructions?: { instructions: RawIx[] }[] } } | null>(
      "getTransaction", [s.signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]);
    if (!tx) continue;
    const ixs = [...tx.transaction.message.instructions, ...(tx.meta.innerInstructions ?? []).flatMap((i) => i.instructions)];
    if (ixs.some((ix) => ix.programId === PROGRAM_ID && ix.accounts?.[4] === pda && firstByteB58(ix.data ?? "") === 1)) return true;
  }
  return false;
}
type RawIx = { programId: string; accounts?: string[]; data?: string };

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
/** First byte of a base58-encoded instruction data string. */
export function firstByteB58(s: string): number | null {
  if (!s) return null;
  let n = 0n;
  for (const ch of s) {
    const i = B58.indexOf(ch);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  let lead = 0;
  while (lead < s.length && s[lead] === "1") lead++;
  const bytes: number[] = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  const all = [...new Array(lead).fill(0), ...bytes];
  return all.length ? all[0] : null;
}

const DOCS = `${SITE_URL}/en/docs`;

export function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": SITE_URL,
    "access-control-allow-headers": "x-payment, content-type",
    "access-control-allow-methods": "GET, OPTIONS",
    vary: "Origin",
    "cache-control": "no-store",
  };
}

export function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(body, { status, headers: { ...corsHeaders(), ...headers } });
}

export function err(status: number, code: string, message: string, headers?: Record<string, string>) {
  return json({ code, message, docs: DOCS }, status, headers);
}

const hits = new Map<string, number[]>();
export function limited(req: Request, max = 30, windowMs = 60_000): boolean {
  const ip = (req.headers.get("x-forwarded-for") || "anon").split(",")[0].trim();
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return arr.length > max;
}

export function parseRef(s: string | null): Address | null | "bad" {
  if (!s) return null;
  try {
    return address(s);
  } catch {
    return "bad";
  }
}

export function demoCampaignAddress(): Address | null {
  const v = process.env.COMMISH_DEMO_CAMPAIGN;
  if (!v) return null;
  try {
    return address(v.trim());
  } catch {
    return null;
  }
}

export async function loadDemoCampaign(): Promise<Campaign | null> {
  const a = demoCampaignAddress();
  if (!a) return null;
  const r = await rpc<{ value: { data: [string, string]; owner: string } | null }>("getAccountInfo", [a, { encoding: "base64", commitment: "confirmed" }]);
  if (!r.value || r.value.owner !== PROGRAM_ID) return null;
  return decodeCampaign(a, Uint8Array.from(Buffer.from(r.value.data[0], "base64")));
}

export async function vaultBalance(vault: Address): Promise<bigint | null> {
  try {
    const r = await rpc<{ value: { data: [string, string] } | null }>("getAccountInfo", [vault, { encoding: "base64", commitment: "confirmed" }]);
    if (!r.value) return null;
    return decodeTokenAccount(Uint8Array.from(Buffer.from(r.value.data[0], "base64")))?.amount ?? null;
  } catch {
    return null;
  }
}

export const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** order_hash = sha256("commish:x402:" + campaign + ":" + payment_signature) */
export async function commissionPda(campaign: Address, signature: string) {
  const pre = new TextEncoder().encode(`commish:x402:${campaign}:${signature}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", pre));
  return { hash, pda: (await findCommission(campaign, hash)).address };
}

type Bal = { accountIndex: number; mint: string; uiTokenAmount: { amount: string } };
export type ParsedTx = {
  blockTime: number | null;
  meta: { err: unknown; preTokenBalances?: Bal[]; postTokenBalances?: Bal[] } | null;
  transaction: {
    message: {
      accountKeys: { pubkey: string; signer: boolean }[];
      instructions: { program?: string; parsed?: unknown }[];
    };
  };
};

export async function getTx(signature: string): Promise<ParsedTx | null> {
  return rpc<ParsedTx | null>("getTransaction", [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]);
}

export type Verdict = { ok: true; blockTime: number | null; feePayer: string; amount: bigint } | { ok: false; reason: string };

/** Read-only check: tx succeeded, USDC credited to the vault >= price, memo matches ref. */
export function verifyPayment(tx: ParsedTx, vault: Address, ref: Address | null): Verdict {
  if (!tx.meta || tx.meta.err) return { ok: false, reason: "transaction failed on chain" };
  const keys = tx.transaction.message.accountKeys;
  const vi = keys.findIndex((k) => k.pubkey === vault);
  if (vi < 0) return { ok: false, reason: "vault is not part of this transaction" };
  const find = (xs?: Bal[]) => xs?.find((b) => b.accountIndex === vi);
  const pre = find(tx.meta.preTokenBalances);
  const post = find(tx.meta.postTokenBalances);
  if (!post || post.mint !== USDC_MINT) return { ok: false, reason: "vault was not credited with USDC" };
  const delta = BigInt(post.uiTokenAmount.amount) - BigInt(pre?.uiTokenAmount.amount ?? "0");
  if (delta < PRICE) return { ok: false, reason: `amount ${delta} below price ${PRICE}` };
  if (ref) {
    const want = `commish:${ref}`;
    const memo = tx.transaction.message.instructions.some((i) => i.program === "spl-memo" && i.parsed === want);
    if (!memo) return { ok: false, reason: `memo ${want} not found` };
  }
  return { ok: true, blockTime: tx.blockTime, feePayer: keys[0].pubkey, amount: delta };
}

export const founderKeys = () => (process.env.COMMISH_FOUNDER_PUBKEYS || "").split(",").map((s) => s.trim()).filter(Boolean);
