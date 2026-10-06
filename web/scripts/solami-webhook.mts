// Registers a Solami webhook on the campaign vault so USDC transfers into it
// POST to /api/solami/webhook.
//
//   node --import tsx scripts/solami-webhook.mts            # dry run: prints the request, sends nothing
//   SOLAMI_SESSION_TOKEN=... node --import tsx scripts/solami-webhook.mts --apply
//
// POST /webhooks/create is an account route: it wants a session Bearer token
// (not an API key) with the WebhooksManage permission, and your plan must
// allow webhooks (Pro allows 3). See https://solami.dev/docs/api/post_webhooks-create
// The response carries the signing secret ONCE: put it in SOLAMI_WEBHOOK_SECRET.
// No transaction is sent and nothing here moves funds.
const VAULT = "HfYrkQ8JUHY2EsJfwqYxXsfanJncQrysCRezhDyB6Jvo";
const SITE = (process.env.SITE_URL ?? "https://getcommish.vercel.app").replace(/\/$/, "");
const API = "https://api.solami.dev";

const body = {
  label: "commish vault transfers",
  url: `${SITE}/api/solami/webhook`,
  addresses: [VAULT],
  event_types: ["transfer"],
  payload_kind: "enriched",
  auto_region: true,
};

const apply = process.argv.includes("--apply");
console.log(`${apply ? "SENDING" : "DRY RUN, would send"}: POST ${API}/webhooks/create`);
console.log(JSON.stringify(body, null, 2));

if (!apply) {
  console.log("\nRe-run with --apply and SOLAMI_SESSION_TOKEN set to create it.");
  process.exit(0);
}
const token = process.env.SOLAMI_SESSION_TOKEN;
if (!token) throw new Error("SOLAMI_SESSION_TOKEN is required with --apply");

const r = await fetch(`${API}/webhooks/create`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});
const j = (await r.json().catch(() => ({}))) as { id?: string; secret?: string; message?: string };
if (!r.ok) throw new Error(`create failed (${r.status}): ${j.message ?? "unknown"}`);
console.log(`created webhook ${j.id}`);
console.log(`SOLAMI_WEBHOOK_SECRET=${j.secret}   (shown once; store it, do not commit it)`);
