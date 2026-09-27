/** Public configuration, readable in the browser. */
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://commish.vercel.app";
export const REPO_URL = "https://github.com/bryankwandou/commish";
export const PROGRAM_ADDRESS = "CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB";
export const EXPLORER = "https://explorer.solana.com";

export const explorerAddress = (a: string) => `${EXPLORER}/address/${a}`;
export const explorerTx = (s: string) => `${EXPLORER}/tx/${s}`;

export const short = (a: string, n = 4) => (a.length > 2 * n + 1 ? `${a.slice(0, n)}…${a.slice(-n)}` : a);

/** USDC base units (6 decimals) to a display string. */
export function usdc(units: bigint, digits = 2): string {
  const neg = units < 0n;
  const v = neg ? -units : units;
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").slice(0, digits);
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${w}${digits ? "." + frac : ""}`;
}

/** Parse a decimal USDC string into base units. */
export function parseUsdc(s: string): bigint | null {
  const m = s.trim().replace(/,/g, "").match(/^(\d+)(?:\.(\d{0,6}))?$/);
  if (!m) return null;
  return BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0"));
}
