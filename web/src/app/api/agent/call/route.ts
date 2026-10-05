import { SITE_URL, explorerAddress, explorerTx, PROGRAM_ADDRESS } from "@/lib/config";
import { USDC_MINT } from "@/lib/commish/program";
import { PRICE, ROUTER_BPS, RpcError, accountExists, commissionPda, wasRecorded, rpcDown, corsHeaders, err, getTx, hex, json, limited, loadDemoCampaign, parseRef, verifyPayment } from "@/lib/agent";

export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;
const used = new Map<string, { t: number; body: unknown }>();

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
  try {
    if (limited(req)) return err(429, "rate_limited", "Too many requests, retry in a minute.", { "retry-after": "60" });
    const url = new URL(req.url);
    const ref = parseRef(url.searchParams.get("ref"));
    if (ref === "bad") return err(400, "invalid_ref", "ref must be a base58 Solana public key.");

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
              resource: `${SITE_URL}/api/agent/call${ref ? `?ref=${ref}` : ""}`,
              description: "Echo call. 0.05 USDC; the router cut is held until the refund window closes.",
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

    // Durable replay guard: the commission PDA's own history survives restarts.
    if (ref) {
      if (await accountExists(pda)) {
        const prior = used.get(sig);
        if (prior) return json(prior.body);
      } else if (await wasRecorded(pda)) {
        return err(402, "payment_already_used", "This payment was already redeemed and its commission is closed.");
      }
    }
    // Fast path / idempotent replay (no-ref payments, or recorded-but-not-yet-visible, or restart with live account).
    const prior = used.get(sig);
    if (prior) return json(prior.body);

    const echo = ref ?? null;
    const timestamp = new Date().toISOString();
    const sha256 = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${echo ?? ""}|${timestamp}`))));
    const base = v.blockTime ?? Math.floor(now / 1000);
    const body = {
      result: { echo, timestamp, sha256 },
      receipt: {
        payment: sig,
        orderHash: hex(hash),
        commission: ref ? pda : null,
        releaseAt: ref ? new Date((base + Number(campaign.holdSeconds)) * 1000).toISOString() : null,
        note: ref ? "Recorded by the relayer; the commission account appears shortly after." : "No ref, so no commission.",
        explorer: {
          payment: explorerTx(sig),
          commission: ref ? explorerAddress(pda) : null,
          vault: explorerAddress(campaign.vault),
          program: explorerAddress(PROGRAM_ADDRESS),
        },
      },
    };
    used.set(sig, { t: now, body });
    if (used.size > 5000) for (const [k, e] of used) if (now - e.t > 3_600_000) used.delete(k);
    return json(body);
  } catch (e) {
    if (e instanceof RpcError) return rpcDown();
    return err(500, "internal_error", "Unexpected error.");
  }
}
