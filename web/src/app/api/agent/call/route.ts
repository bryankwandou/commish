import { SITE_URL, explorerAddress, explorerTx, PROGRAM_ADDRESS } from "@/lib/config";
import { USDC_MINT } from "@/lib/commish/program";
import { after } from "next/server";
import { PantaError, marketData, pantaConfigured } from "@/lib/panta";
import { recordSale, sweepDue } from "@/lib/relayer";
import { PRICE, ROUTER_BPS, RpcError, accountExists, commissionPda, wasRecorded, rpcDown, corsHeaders, err, getTx, hex, json, limited, loadDemoCampaign, parseRef, verifyPayment } from "@/lib/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;
const used = new Map<string, { t: number; body: unknown }>();
// One payment buys data for one market. Per instance only, like `used`.
const marketOf = new Map<string, string>();

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
  try {
    if (limited(req)) return err(429, "rate_limited", "Too many requests, retry in a minute.", { "retry-after": "60" });
    const url = new URL(req.url);
    const ref = parseRef(url.searchParams.get("ref"));
    if (ref === "bad") return err(400, "invalid_ref", "ref must be a base58 Solana public key.");

    const marketRaw = url.searchParams.get("market")?.trim() || null;
    if (marketRaw && !/^[\w .:,'?-]{1,80}$/.test(marketRaw)) return err(400, "invalid_market", "market must be a Panta market address or a short text query (max 80 chars).");
    const market = marketRaw && pantaConfigured() ? marketRaw : null;

    let campaign;
    try {
      campaign = await loadDemoCampaign();
    } catch {
      return rpcDown();
    }
    if (!campaign) return err(503, "demo_campaign_not_configured", "demo campaign not configured");

    const sig = req.headers.get("x-payment")?.trim();
    if (!sig) {
      return json(
        {
          x402Version: 1,
          accepts: [
            {
              scheme: "exact",
              network: "solana",
              asset: USDC_MINT,
              payTo: campaign.vault,
              maxAmountRequired: PRICE.toString(),
              resource: `${SITE_URL}/api/agent/call${ref || market ? `?${[ref && `ref=${ref}`, market && `market=${encodeURIComponent(market)}`].filter(Boolean).join("&")}` : ""}`,
              description: market
                ? `Panta prediction-market data for "${market}": market details and live YES/NO prices. 0.05 USDC; the router cut is held until the refund window closes.`
                : "Echo call. 0.05 USDC; the router cut is held until the refund window closes. Add ?market=<Panta market id or query> for Panta prediction-market data.",
              mimeType: "application/json",
              maxTimeoutSeconds: 120,
              extra: { memo: ref ? `commish:${ref}` : null, campaign: campaign.address, holdSeconds: Number(campaign.holdSeconds), routerBps: ROUTER_BPS },
            },
          ],
        },
        402,
      );
    }

    if (!BASE58.test(sig)) return err(400, "invalid_payment", "X-Payment must be a base58 transaction signature.");
    const tx = await getTx(sig);
    if (!tx) return err(402, "payment_not_found", "Transaction not found at confirmed commitment yet. Retry shortly.");
    const v = verifyPayment(tx, campaign.vault, ref);
    if (!v.ok) return err(402, "payment_invalid", v.reason);
    const now = Date.now();
    const { hash, pda } = await commissionPda(campaign.address, sig);
    // Cached per payment AND ref: a ref-less call made first by someone who saw
    // the signature must not stand in for the payer's own call with its ref.
    const key = `${sig}|${ref ?? ""}|${market ?? ""}`;
    const prior = used.get(key);
    if (prior) return json(prior.body);

    let recordTx: string | null = null;
    if (ref) {
      if (!(await accountExists(pda))) {
        // Durable replay guard: a closed commission still has its record_sale on chain.
        if (await wasRecorded(pda)) return err(402, "payment_already_used", "This payment was already redeemed and its commission is closed.");
        try {
          recordTx = await recordSale(campaign, hash, v.amount, ref);
        } catch {
          // A concurrent retry may have recorded it; the account check below decides.
        }
        if (!(await accountExists(pda))) return err(503, "record_pending", "Payment verified, but the reservation did not confirm yet. Retry the same request.");
      }
    }

    let panta: Awaited<ReturnType<typeof marketData>> | null = null;
    if (market) {
      const served = marketOf.get(sig);
      if (served && served !== market) return err(409, "payment_already_used", `This payment already bought data for "${served}". Pay again for another market.`);
      // Payment is verified and recorded; failures are not cached, so retrying the same request is safe.
      try {
        panta = await marketData(market);
      } catch (e) {
        if (e instanceof PantaError && e.code === "market_not_found") return err(404, "market_not_found", "Payment verified, but Panta has no matching market. Retry with another market value and the same X-Payment.");
        return err(502, "panta_unavailable", "Payment verified, but the Panta API failed. Retry the same request.");
      }
    }

    const echo = ref ?? null;
    const timestamp = new Date().toISOString();
    const sha256 = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${echo ?? ""}|${timestamp}`))));
    const base = v.blockTime ?? Math.floor(now / 1000);
    const body = {
      result: panta ? { source: "panta", market: panta.market, matched: panta.matched ?? null, timestamp } : { echo, timestamp, sha256 },
      receipt: {
        payment: sig,
        orderHash: hex(hash),
        commission: ref ? pda : null,
        releaseAt: ref ? new Date((base + Number(campaign.holdSeconds)) * 1000).toISOString() : null,
        note: ref ? "The router's cut is reserved on chain until releaseAt; then anyone can release it." : "No ref, so no commission.",
        recordTx: recordTx ? explorerTx(recordTx) : null,
        explorer: {
          payment: explorerTx(sig),
          commission: ref ? explorerAddress(pda) : null,
          vault: explorerAddress(campaign.vault),
          program: explorerAddress(PROGRAM_ADDRESS),
        },
      },
    };
    used.set(key, { t: now, body });
    if (market) marketOf.set(sig, market);
    after(() => sweepDue(campaign).catch(() => {}));
    if (used.size > 5000) for (const [k, e] of used) if (now - e.t > 3_600_000) used.delete(k);
    if (marketOf.size > 5000) marketOf.clear();
    return json(body);
  } catch (e) {
    if (e instanceof RpcError) return rpcDown();
    return err(500, "internal_error", "Unexpected error.");
  }
}
