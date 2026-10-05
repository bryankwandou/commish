# Holdback for machine payments — shared spec

One-liner: USDC holdback for x402: lock the router's cut until the paid call is final.

First users are agents. Humans are not in this loop. The program is unchanged
(mainnet `CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB`); only the roles move:

| Program field | Machine-payment meaning |
|---|---|
| brand | TOOL_TREASURY: the tool seller that funds the vault |
| attestor | RELAYER key: open-source relayer, records only after it sees a USDC payment |
| creator / payee | ROUTER: the agent whose `ref` pubkey routed the call |
| order_hash | `sha256("commish:x402:" + campaign + ":" + payment_signature)` |
| order_amount | USDC base units of the payment (6 dp) |
| hold | refund window: 600 s for the demo campaign |
| sell buyer | BUYER_DESK: pays the router now, collects at release |
| release signer | KEEPER: any fee payer, no other signer |

## Roles (agents/roles.json, keypair paths only, never keys)
TOOL_TREASURY, RELAYER, ROUTER, CALLER, BUYER_DESK, KEEPER.

## Paid call (HTTP 402)
1. `GET /api/agent/call?ref=<router pubkey>` without payment → `402` JSON:
   `{ x402Version:1, accepts:[{ scheme:"exact", network:"solana", asset:<USDC mint>, payTo:<vault ATA>, maxAmountRequired:"50000", resource, description, mimeType:"application/json", maxTimeoutSeconds:120, extra:{ memo:"commish:<ref>", campaign, holdSeconds, routerBps } }] }`
2. Caller sends a USDC transfer of >= price to `payTo` with memo `commish:<ref>`.
3. Retry with header `X-Payment: <base58 tx signature>` (raw signature, not a
   certified facilitator payload: "x402-compatible, not certified").
4. Server verifies the tx on chain (finalized/confirmed, USDC mint, destination
   = vault, amount >= price, memo ref matches), returns `200`
   `{ result, receipt:{ payment, commission, orderHash, releaseAt, explorer } }`.
   The relayer records the sale (record_sale) for that payment.
5. No `ref` → call succeeds, no commission. Invalid ref → `400`.

## Idempotency / replay
The program closes a commission on release/cancel, so the same order_hash can
be recorded again after close (attestor-gated). The relayer MUST refuse a
payment whose commission PDA address has any transaction history
(`getSignaturesForAddress(pda, {limit:1})` non-empty) and keep a local ledger
of processed payment signatures.

## Cancel
Only with proof: a USDC transfer from the vault back to the caller referencing
the payment signature. The relayer cancels; nobody clicks.

## Price / rent
Price 0.05 USDC (50 000). Router cut 10% (1 000 bps) = 0.005 USDC. Commission
account rent (~0.0021 SOL) is paid by the relayer and refunded on close.

## Labels
Every founder-run tx is SOAK. A payment whose fee payer is not in
`agents/founder-pubkeys.json` counts as FOREIGN. Show 0 if 0.

## Clarifications (agents implementation, 2026-10-04)
- Refund proof for cancel: a vault -> payer token-account transfer (brand
  `withdraw`) in a tx carrying memo `commish:refund:<payment signature>`.
- Memo `commish:soak` marks founder txs and is never read as a ref. Any other
  `commish:<x>` where x is not a valid pubkey is an invalid ref (400).
- Relayer accepts amount >= PRICE and records order_amount = actual amount paid.
