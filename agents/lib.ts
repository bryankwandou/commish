/**
 * Shared plumbing for the agents: RPC with fallback + 429 backoff, keypair
 * loading, transaction send/confirm, error-code extraction, JSON logging.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc,
  createTransactionMessage,
  getAddressEncoder,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransaction,
  type Address,
  type Instruction,
  type KeyPairSigner,
  type Signature,
} from "@solana/kit";

export const AGENTS_DIR = dirname(fileURLToPath(import.meta.url));
export const MEMO_PROGRAM = address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export type Cluster = "localnet" | "devnet" | "mainnet";
export const ROLES = ["TOOL_TREASURY", "RELAYER", "ROUTER", "CALLER", "BUYER_DESK", "KEEPER"] as const;
export type Role = (typeof ROLES)[number];

export function log(event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), event, ...fields }, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  console.log(line);
}

export function cluster(): Cluster {
  const c = (process.env.CLUSTER ?? "localnet").toLowerCase();
  if (c === "localnet" || c === "devnet" || c === "mainnet") return c;
  throw new Error(`CLUSTER must be localnet|devnet|mainnet, got ${c}`);
}

const DEFAULT_URL: Record<Cluster, string> = {
  localnet: "http://127.0.0.1:8899",
  devnet: "https://api.devnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
};

export function rpcUrls(c: Cluster = cluster()): string[] {
  const urls = [process.env.RPC_URL, process.env.RPC_URL_2].filter((u): u is string => !!u && u.length > 0);
  return urls.length ? urls : [DEFAULT_URL[c]];
}

export type Rpc = ReturnType<typeof createSolanaRpc>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export { sleep };

function is429(e: unknown): boolean {
  const s = errText(e);
  return /429|Too Many Requests|rate limit/i.test(s);
}

/** RPC pool: tries each URL, exponential backoff on 429 / network errors. */
export class RpcPool {
  readonly rpcs: Rpc[];
  private i = 0;
  constructor(readonly urls: string[] = rpcUrls()) {
    this.rpcs = urls.map((u) => createSolanaRpc(u));
  }
  get rpc(): Rpc {
    return this.rpcs[this.i];
  }
  /** Run `fn`; retries transport/429 errors across URLs. Program errors are rethrown at once. */
  async call<T>(fn: (rpc: Rpc) => Promise<T>, what = "rpc", attempts = 6): Promise<T> {
    let delay = 500;
    let last: unknown;
    for (let k = 0; k < attempts; k++) {
      try {
        return await fn(this.rpc);
      } catch (e) {
        last = e;
        const transient = is429(e) || /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket|network/i.test(errText(e));
        if (!transient) throw e;
        log("rpc_retry", { what, url: this.urls[this.i], attempt: k + 1, delayMs: delay, error: errText(e).slice(0, 200) });
        this.i = (this.i + 1) % this.rpcs.length;
        await sleep(delay);
        delay = Math.min(delay * 2, 30_000);
      }
    }
    throw last;
  }
}

// ------------------------------------------------------------------ keys

export function agentsPath(p: string) {
  return isAbsolute(p) ? p : resolve(AGENTS_DIR, p);
}

export async function loadKeypairFile(path: string): Promise<KeyPairSigner> {
  const raw = JSON.parse(readFileSync(agentsPath(path), "utf8"));
  if (!Array.isArray(raw) || raw.length !== 64) throw new Error(`${path}: expected a 64-byte JSON array keypair`);
  return createKeyPairSignerFromBytes(Uint8Array.from(raw));
}

/** Generates a keypair and writes it in solana-keygen format. */
export async function newKeypairFile(path: string): Promise<KeyPairSigner> {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed);
  const pub = getAddressEncoder().encode(signer.address);
  const full = agentsPath(path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, JSON.stringify([...seed, ...pub]));
  return signer;
}

export function readRolesFile(path = process.env.ROLES ?? "roles.json"): Record<string, string> | null {
  const full = agentsPath(path);
  if (!existsSync(full)) return null;
  return JSON.parse(readFileSync(full, "utf8"));
}

export async function loadRole(role: Role, rolesPath?: string): Promise<KeyPairSigner> {
  const roles = readRolesFile(rolesPath);
  if (!roles || !roles[role]) throw new Error(`role ${role} missing: copy agents/roles.example.json to agents/roles.json and point it at keypair files`);
  return loadKeypairFile(roles[role]);
}

export function founderPubkeys(): Set<string> {
  const p = agentsPath(process.env.FOUNDERS ?? "founder-pubkeys.json");
  if (!existsSync(p)) return new Set();
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    const list: unknown = Array.isArray(j) ? j : j.pubkeys;
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

// ------------------------------------------------------------------ tx

export function memoIx(text: string): Instruction {
  return { programAddress: MEMO_PROGRAM, accounts: [], data: new TextEncoder().encode(text) };
}

export function errText(e: unknown): string {
  if (e == null) return String(e);
  const parts: string[] = [];
  let cur: any = e;
  for (let d = 0; cur && d < 6; d++) {
    parts.push(String(cur?.message ?? cur));
    if (cur?.context) {
      try {
        parts.push(JSON.stringify(cur.context, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
      } catch {
        /* ignore */
      }
    }
    cur = cur?.cause;
  }
  return parts.join(" | ");
}

/** Custom program error code (e.g. 6011) out of a kit error / logs, if any. */
export function programErrorCode(e: unknown): number | undefined {
  const s = errText(e);
  const hex = s.match(/custom program error: 0x([0-9a-f]+)/i);
  if (hex) return parseInt(hex[1], 16);
  const c = s.match(/"Custom":\s*(\d+)/) ?? s.match(/"code":\s*(\d{4})/);
  if (c) return Number(c[1]);
  return undefined;
}

export class TxError extends Error {
  constructor(message: string, readonly code: number | undefined, readonly signature?: string) {
    super(message);
  }
}

/**
 * Sign with `signers` (first = fee payer), send, wait for `confirmed`.
 * Throws TxError (with program error code when available) on failure.
 */
export async function sendTx(pool: RpcPool, signers: KeyPairSigner[], instructions: Instruction[], label = "tx"): Promise<Signature> {
  const feePayer = signers[0].address;
  const { value: bh } = await pool.call((r) => r.getLatestBlockhash({ commitment: "confirmed" }).send(), "blockhash");
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  // dedupe signers by address
  const uniq = [...new Map(signers.map((s) => [s.address, s])).values()];
  const tx = await signTransaction(uniq.map((s) => s.keyPair), compileTransaction(msg));
  const sig = getSignatureFromTransaction(tx);
  const wire = getBase64EncodedWireTransaction(tx);
  try {
    await pool.call((r) => r.sendTransaction(wire, { encoding: "base64", preflightCommitment: "confirmed" }).send(), `send:${label}`);
  } catch (e) {
    throw new TxError(`${label} rejected: ${errText(e).slice(0, 600)}`, programErrorCode(e), sig);
  }
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const { value } = await pool.call((r) => r.getSignatureStatuses([sig]).send(), "status");
    const st = value[0];
    if (st) {
      if (st.err) throw new TxError(`${label} failed on chain: ${JSON.stringify(st.err, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`, programErrorCode({ context: st.err }), sig);
      if (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized") return sig;
    }
    await sleep(500);
  }
  throw new TxError(`${label} not confirmed within 90 s`, undefined, sig);
}

export async function rentFor(pool: RpcPool, bytes: number): Promise<bigint> {
  return BigInt(await pool.call((r) => r.getMinimumBalanceForRentExemption(BigInt(bytes)).send(), "rent"));
}

export async function accountBytes(pool: RpcPool, a: Address): Promise<Uint8Array | null> {
  const { value } = await pool.call((r) => r.getAccountInfo(a, { encoding: "base64", commitment: "confirmed" }).send(), "getAccountInfo");
  if (!value) return null;
  return Uint8Array.from(Buffer.from(value.data[0], "base64"));
}

export function explorer(sig: string, c: Cluster = cluster()): string {
  if (c === "mainnet") return `https://explorer.solana.com/tx/${sig}`;
  if (c === "devnet") return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
  return `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899`;
}
