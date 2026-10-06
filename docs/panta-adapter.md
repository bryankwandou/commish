# Panta adapter: the first paid tool behind the x402 endpoint

Commish stays what it was: holdback for machine payments. Panta is the tool being paid for, not a new product.
`GET /api/agent/call?market=<id or query>` sells Panta prediction-market data (Colosseum Crypto World's Fair, Panta sidetrack).

## What was integrated
`web/src/lib/panta.ts` (server-only) wraps two read endpoints of the Panta API:

| Endpoint | Used for | Doc |
| - | - | - |
| `GET /markets/` (`limit=50`, optional `category`, `status`) | find a market from a text query (Panta has no text-search param, so titles/descriptions are filtered locally over one page of 50) | https://docs.panta.market/api-reference/markets/list |
| `GET /markets/{marketId}/` | market detail with spot YES/NO prices | https://docs.panta.market/api-reference/markets/get |

Base URL default `https://live-api.panta.market/api/v1`; auth header `X-Api-Key`; trailing slashes required
(https://docs.panta.market/ , https://docs.panta.market/guides/authentication , index https://docs.panta.market/llms.txt).

In `route.ts`: after the on-chain payment check and `recordSale`, a request with `market=` (and Panta configured) returns
`result: { source: "panta", market, matched, timestamp }` instead of the echo. The 402 `description` states what is sold.
Idempotency, replay guard and the cache are unchanged; the cache key now includes `market`.
If Panta fails after payment, the route returns 502 `panta_unavailable` (or 404 `market_not_found`) and does not cache it. Retry the same `X-Payment`: `record_sale` is already done.

## Env vars
- `PANTA_API_KEY` (required to enable; without it the endpoint behaves exactly as before, echo only)
- `PANTA_API_URL` (optional, default above)

## Demo flow
```bash
H=https://<site>
# 1. 402 with terms; description names the Panta market
curl -i "$H/api/agent/call?ref=<AGENT_PUBKEY>&market=<MARKET_ID_OR_QUERY>"
# 2. pay 0.05 USDC to payTo with memo commish:<AGENT_PUBKEY>; keep the signature
# 3. retry with proof
curl "$H/api/agent/call?ref=<AGENT_PUBKEY>&market=<MARKET_ID_OR_QUERY>" -H "X-Payment: <TX_SIGNATURE>"
# 200 -> { result:{source:"panta",market:{title,yesPrice,noPrice,...}}, receipt:{payment,commission,releaseAt,recordTx,...} }
```

## Status (honest)
Written from the Panta docs only. `PANTA_API_KEY` is not set anywhere and no live Panta call has been made; the response
shape is taken from the documented examples, not observed. The paid flow with Panta data has not been demoed on mainnet.
