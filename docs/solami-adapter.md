# Solami adapter

Status: **code merged on a branch, not enabled live.** No Solami key has been
used, no webhook registered, no Beam transaction sent. With no `SOLAMI_*`
variable set, behaviour is identical to before.

Commish is still a USDC holdback for x402 machine payments. Solami is only the
data and landing layer underneath: where we read the chain, and how our own two
transactions (`record_sale`, `release`) get sent.

## What is integrated

| Piece | Where | What it does |
|---|---|---|
| RPC | `web/src/lib/solami.ts` `rpcUrl()`, used by `relayer.ts`, `agent.ts`, `chain.ts`, `api/rpc/route.ts` | One helper picks the endpoint: `SOLAMI_RPC_URL`, else derived from `SOLAMI_API_KEY`, else `RPC_URL`, else the public default. |
| Beam | `solami.ts` `beamTipIx()`, called from `relayer.ts` `send()` | When `SOLAMI_API_KEY` is set, a tip transfer is appended to `record_sale` and `release` transactions before signing. Sent through the same `sendRawTransaction`. |
| Webhook receiver | `web/src/app/api/solami/webhook/route.ts` | Verifies `X-Webhook-Signature`, and when the delivery mentions the vault and the USDC mint, runs `sweepDue` via `after()`. |
| Webhook registration | `web/scripts/solami-webhook.mts` | Dry run by default; prints the `POST /webhooks/create` body for vault `HfYrkQ8JUHY2EsJfwqYxXsfanJncQrysCRezhDyB6Jvo`. `--apply` sends it. |

Not used: Yellowstone gRPC, Mirage, Blur. The thesis needs one event (USDC into
the vault), which a webhook covers; adding a stream would be a long-lived
process on a serverless deploy.

## Solami endpoints (from their docs)

Solami's docs are a client-rendered app; the pages below were read from the
site's own bundle (`https://solami.dev/assets/index-*.js`, which embeds the
per-endpoint markdown) and `llms.txt`.

- Endpoint table and auth: https://solami.dev/docs/endpoints
  - RPC `https://rpc.solami.dev/sol?api_key=KEY`; account/data API `https://api.solami.dev`.
  - "Beam over HTTP has no endpoint of its own. Send a normal `sendTransaction` to your RPC endpoint with a tip instruction included and it routes through Beam."
- Beam: https://solami.dev/swqos . Minimum tip 0.0001 SOL (100000 lamports), a transfer instruction to a tip address.
- `GET https://api.solami.dev/onchain/tip-addresses`, public, returns a JSON array of addresses: https://solami.dev/docs/api/get_onchain-tip-addresses
- Webhooks guide: https://solami.dev/docs/webhooks
- `POST /webhooks/create` (session Bearer token, `WebhooksManage`): https://solami.dev/docs/api/post_webhooks-create . Body: `addresses`, `url`, `event_types` (`transfer` among them), `payload_kind` `enriched|raw`, `auto_region`. Response includes `secret` (`whsec_...`), shown once.
- Delivery: POST to `url` with `X-Webhook-Signature` ("an HMAC of the body with your secret"), three retries with backoff on failure.
- Plan caps: Pro allows 3 webhooks; free allows none (`max_webhooks` in the pricing data).

## Environment variables

| Variable | Needed for | Notes |
|---|---|---|
| `SOLAMI_RPC_URL` | RPC | Full URL including key. Wins over everything. |
| `SOLAMI_API_KEY` | RPC (derived) and Beam | Turns Beam on. |
| `SOLAMI_BEAM_TIP_LAMPORTS` | Beam | Default 100000. Below 100000 disables the tip. |
| `SOLAMI_BEAM` | Beam | `0` keeps the Solami RPC but sends no tip. |
| `SOLAMI_WEBHOOK_SECRET` | Webhook receiver | The `whsec_...` value. Unset means the route returns 503. |
| `SOLAMI_SESSION_TOKEN` | Registration script only | Session Bearer token, not an API key. Never set on Vercel. |

Server-only. Do not prefix with `NEXT_PUBLIC_`. The browser still talks to
`/api/rpc`, which forwards to the chosen upstream, so the key stays on the server.

## How to enable

1. Sign up at https://solami.dev/signup?ref=st-earn-sep-26 and create an API key.
2. Set `SOLAMI_API_KEY` (and optionally `SOLAMI_RPC_URL`) in the Vercel project env. Redeploy.
3. Optional webhook: `cd web && node scripts/solami-webhook.mts` to review, then
   `SOLAMI_SESSION_TOKEN=... node scripts/solami-webhook.mts --apply`. Copy the printed secret into `SOLAMI_WEBHOOK_SECRET` and redeploy.

## Cost and risk

- Beam is free to use but each tipped transaction pays at least 0.0001 SOL from
  the relayer/keeper wallet, on top of the network fee. Set `SOLAMI_BEAM=0` to avoid it.
- If the tip list cannot be fetched, the transaction is sent without a tip,
  as before. A tip never changes the program instruction.
- The webhook route never trusts the body: unsigned or wrongly signed requests get 401.
  A match only triggers `sweepDue`, which is throttled and idempotent.

## Honest status: not verified

- Never run against a live key. All of the above is written from the docs.
- The signature algorithm and encoding are not stated in the docs. The receiver
  accepts HMAC-SHA256 as hex or base64 (optional `sha256=` prefix). Confirm on the first real delivery.
- The enriched payload's field names are not documented, so matching is by
  content (vault address and USDC mint both present) rather than by field.
- The Beam HTTP path is documented only in one sentence (above); landing rate is unmeasured.
- `beam-http.solami.dev`, named in `llms.txt`, did not resolve from here; this adapter does not use it.
- The hackathon asks for a demo against live mainnet. That needs a key and a real
  x402 call, which this branch deliberately does not do.
