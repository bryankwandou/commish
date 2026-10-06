import { SystemProgram, TransactionInstruction, PublicKey } from "@solana/web3.js";

/**
 * Solami adapter (https://solami.dev). Everything here is opt-in: with no
 * SOLAMI_* variable set, behaviour is exactly what it was before.
 *
 *  - SOLAMI_RPC_URL      full RPC URL incl. key, e.g. https://rpc.solami.dev/sol?api_key=...
 *  - SOLAMI_API_KEY      if set and SOLAMI_RPC_URL is not, the RPC URL is derived from it;
 *                        it also turns on Beam (a tip transfer is added to our own sends)
 *  - SOLAMI_BEAM_TIP_LAMPORTS  tip per transaction, default 100000 (0.0001 SOL, Beam's minimum)
 *  - SOLAMI_BEAM=0       keep the Solami RPC but skip the tip
 *
 * Beam over HTTP has no endpoint of its own: a normal sendTransaction to the
 * Solami RPC that carries a tip instruction is routed through Beam
 * (https://solami.dev/docs/endpoints, "Beam over HTTP has no endpoint of its own").
 */
const FALLBACK = "https://api.mainnet-beta.solana.com";
const API = "https://api.solami.dev";

const env = (k: string) => process.env[k]?.trim() || "";

/** The RPC endpoint every server-side connection should use. */
export function rpcUrl(): string {
  const direct = env("SOLAMI_RPC_URL");
  if (direct) return direct;
  const key = env("SOLAMI_API_KEY");
  if (key) return `https://rpc.solami.dev/sol?api_key=${encodeURIComponent(key)}`;
  return env("RPC_URL") || env("NEXT_PUBLIC_RPC_URL") || FALLBACK;
}

export const solamiRpcActive = () => !!(env("SOLAMI_RPC_URL") || env("SOLAMI_API_KEY"));

/** Beam is on when a Solami key is configured and not switched off. */
export const beamEnabled = () => !!env("SOLAMI_API_KEY") && env("SOLAMI_BEAM") !== "0";

let tips: string[] | null = null;
let tipsAt = 0;

async function tipAddresses(): Promise<string[]> {
  if (tips && Date.now() - tipsAt < 3_600_000) return tips;
  // GET /onchain/tip-addresses is public (no auth); see https://solami.dev/docs/api/get_onchain-tip-addresses
  const r = await fetch(`${API}/onchain/tip-addresses`, { signal: AbortSignal.timeout(5_000), cache: "no-store" });
  if (!r.ok) throw new Error(`tip-addresses ${r.status}`);
  const j = (await r.json()) as unknown;
  if (!Array.isArray(j) || !j.every((x) => typeof x === "string") || j.length === 0) throw new Error("tip-addresses: unexpected shape");
  tips = [...new Set(j as string[])];
  tipsAt = Date.now();
  return tips;
}

/**
 * The Beam tip instruction for `payer`, or null when Beam is off or the tip
 * list could not be fetched (the caller then sends without a tip, as before).
 */
export async function beamTipIx(payer: PublicKey): Promise<TransactionInstruction | null> {
  if (!beamEnabled()) return null;
  const lamports = Number(env("SOLAMI_BEAM_TIP_LAMPORTS") || 100_000);
  if (!Number.isSafeInteger(lamports) || lamports < 100_000) return null; // below Beam's 0.0001 SOL minimum
  try {
    const list = await tipAddresses();
    const to = new PublicKey(list[Math.floor(Math.random() * list.length)]);
    return SystemProgram.transfer({ fromPubkey: payer, toPubkey: to, lamports });
  } catch {
    return null;
  }
}
