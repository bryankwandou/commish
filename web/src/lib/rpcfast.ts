/**
 * RPC Fast adapter (https://rpcfast.com). The second mainnet RPC: when the
 * primary (Solami) is rate-limited or down, reads fail over here.
 *
 *  - RPCFAST_RPC_URL   full RPC URL incl. key
 *  - RPCFAST_API_KEY   if set and RPCFAST_RPC_URL is not, the URL is derived from it
 *
 * With neither set, there is no RPC Fast fallback and behaviour is unchanged.
 */
const env = (k: string) => process.env[k]?.trim() || "";

export function rpcFastUrl(): string | null {
  const direct = env("RPCFAST_RPC_URL");
  if (direct) return direct;
  const key = env("RPCFAST_API_KEY");
  return key ? `https://solana-rpc.rpcfast.com/?api_key=${encodeURIComponent(key)}` : null;
}
