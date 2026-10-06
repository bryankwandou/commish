import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { USDC_MINT } from "@/lib/commish/program";
import { loadDemoCampaign } from "@/lib/agent";
import { sweepDue } from "@/lib/relayer";

/**
 * Receiver for Solami webhooks (https://solami.dev/docs/webhooks) on the
 * campaign vault. A matching delivery wakes the keeper (sweepDue), so a
 * USDC transfer into the vault is acted on when it lands instead of when a
 * cron next fires. Off unless SOLAMI_WEBHOOK_SECRET is set.
 *
 * Solami signs each delivery with the webhook's `whsec_...` secret in the
 * `X-Webhook-Signature` header, "an HMAC of the body". The docs do not state
 * the hash or the encoding, so we accept HMAC-SHA256 as hex or base64 (with
 * an optional "sha256=" prefix). Unverified against a live delivery.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function signatureOk(body: string, header: string, secret: string): boolean {
  const sig = header.trim().replace(/^sha256=/i, "");
  const mac = createHmac("sha256", secret).update(body).digest();
  for (const enc of ["hex", "base64"] as const) {
    const want = Buffer.from(mac.toString(enc));
    const got = Buffer.from(sig);
    if (want.length === got.length && timingSafeEqual(want, got)) return true;
  }
  return false;
}

export async function POST(req: Request) {
  const secret = process.env.SOLAMI_WEBHOOK_SECRET?.trim();
  if (!secret) return Response.json({ error: "solami webhook not configured" }, { status: 503 });

  const body = await req.text();
  if (body.length > 1_000_000) return Response.json({ error: "payload too large" }, { status: 413 });
  const header = req.headers.get("x-webhook-signature");
  if (!header || !signatureOk(body, header, secret)) return Response.json({ error: "bad signature" }, { status: 401 });

  let campaign;
  try {
    campaign = await loadDemoCampaign();
  } catch {
    return Response.json({ error: "rpc unavailable" }, { status: 503 }); // non-2xx so Solami retries
  }
  if (!campaign) return Response.json({ ok: true, ignored: "no campaign" });

  // Field names of the enriched payload are not documented, so match on
  // content: the delivery must mention both the vault and the USDC mint.
  // A false positive only costs one throttled, idempotent sweepDue.
  const hit = body.includes(campaign.vault) && body.includes(USDC_MINT);
  if (hit) {
    console.log("solami webhook: USDC activity on vault", campaign.vault);
    after(() => sweepDue(campaign).catch(() => {}));
  }
  return Response.json({ ok: true, swept: hit });
}
