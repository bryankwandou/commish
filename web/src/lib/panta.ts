import "server-only";

/**
 * Panta API (prediction-market infrastructure) read client.
 * Docs: https://docs.panta.market/ (index: https://docs.panta.market/llms.txt)
 *  - GET /markets/            https://docs.panta.market/api-reference/markets/list
 *  - GET /markets/{marketId}/ https://docs.panta.market/api-reference/markets/get
 * Auth: X-Api-Key header (https://docs.panta.market/guides/authentication). Trailing slashes are required.
 */
const DEFAULT_URL = "https://live-api.panta.market/api/v1";

export type PantaMarket = {
  marketId: string;
  category: string;
  title: string;
  description: string;
  phase: string;
  status: string;
  resolved: boolean;
  volumeUsdc: string;
  endTime: number;
  resolutionTime: number;
  yesPrice: string | null;
  noPrice: string | null;
  primaryYesPrice: string | null;
  primaryNoPrice: string | null;
  secondaryYesPrice: string | null;
  secondaryNoPrice: string | null;
};

export class PantaError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export const pantaConfigured = () => !!process.env.PANTA_API_KEY;
const base = () => (process.env.PANTA_API_URL || DEFAULT_URL).replace(/\/+$/, "");

async function get<T>(path: string, query?: Record<string, string>): Promise<T> {
  const key = process.env.PANTA_API_KEY;
  if (!key) throw new PantaError("not_configured", "PANTA_API_KEY is not set.");
  const qs = query ? `?${new URLSearchParams(query)}` : "";
  let r: Response;
  try {
    r = await fetch(`${base()}${path}${qs}`, { headers: { "X-Api-Key": key, accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new PantaError("unreachable", "Panta API unreachable or timed out.");
  }
  if (r.status === 404) throw new PantaError("market_not_found", "Panta has no such market.");
  if (!r.ok) throw new PantaError(r.status === 429 ? "rate_limited" : "upstream_error", `Panta API returned ${r.status}.`);
  return (await r.json()) as T;
}

const pick = (m: PantaMarket): PantaMarket => ({
  marketId: m.marketId, category: m.category, title: m.title, description: m.description, phase: m.phase, status: m.status,
  resolved: m.resolved, volumeUsdc: m.volumeUsdc, endTime: m.endTime, resolutionTime: m.resolutionTime,
  yesPrice: m.yesPrice ?? null, noPrice: m.noPrice ?? null,
  primaryYesPrice: m.primaryYesPrice ?? null, primaryNoPrice: m.primaryNoPrice ?? null,
  secondaryYesPrice: m.secondaryYesPrice ?? null, secondaryNoPrice: m.secondaryNoPrice ?? null,
});

/** Single market with spot YES/NO prices. */
export async function getMarket(marketId: string): Promise<PantaMarket> {
  return pick(await get<PantaMarket>(`/markets/${encodeURIComponent(marketId)}/`));
}

/** Catalog page; Panta has no text search, so `q` filters titles/descriptions locally over one page of up to 50 rows. */
export async function listMarkets(opts: { q?: string; category?: string; status?: string } = {}): Promise<PantaMarket[]> {
  const query: Record<string, string> = { limit: "50" };
  if (opts.category) query.category = opts.category;
  if (opts.status) query.status = opts.status;
  const { items } = await get<{ items: PantaMarket[] }>("/markets/", query);
  const q = opts.q?.toLowerCase();
  return items.filter((m) => !q || `${m.title} ${m.description}`.toLowerCase().includes(q)).map(pick);
}

/**
 * Resolve the `market` param of the paid call: a base58 market address returns that market with prices;
 * anything else is a text query, and the best match is re-fetched for spot prices (list rows carry none).
 */
export async function marketData(param: string): Promise<{ market: PantaMarket; matched?: number }> {
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(param)) return { market: await getMarket(param) };
  const hits = await listMarkets({ q: param });
  if (!hits.length) throw new PantaError("market_not_found", "No Panta market matches that query.");
  return { market: await getMarket(hits[0].marketId), matched: hits.length };
}
