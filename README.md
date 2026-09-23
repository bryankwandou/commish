# Commish

Affiliate commissions that pay themselves out.

A brand locks a budget in USDC. Every sale a creator refers reserves that
creator's cut on-chain the moment the order lands. When the refund window
closes, the money moves to the creator's wallet on its own. If the order is
refunded first, the reservation is released back to the brand.

Creators today wait. PayPal takes 3.49% on an international transfer, payouts
run net-30 or worse, and Southeast Asia, the Middle East and Africa — where the
creator economy is growing fastest — have the thinnest coverage. The brand's
promise to pay is an invoice in a spreadsheet. Here it is an on-chain
reservation the brand cannot take back.

## What the program guarantees

- **The brand cannot spend what it owes.** `withdraw` only ever moves
  `vault balance − reserved`. A commission that has been recorded is untouchable
  until it is paid or cancelled.
- **A creator cannot be paid twice for one order.** The commission account is a
  PDA derived from the order hash. A second attempt to record it fails because
  the account already exists.
- **Nobody can invent a sale.** Only the campaign's attestor key — the brand's
  own server — may call `record_sale`, and the program, not the caller, computes
  the amount from the campaign's rate.
- **The payout cannot be redirected.** `release` pays the wallet stored on the
  commission, and refuses any other.
- **The payout does not depend on us.** `release` is permissionless. If every
  server running this project disappears, the creator can still pull their own
  money out of the vault.

## Layout

| Path | What it is |
| --- | --- |
| `programs/commish` | the Anchor program: campaign, affiliate, commission |
| `app/src/webhook.ts` | receives the shop's order and refund webhooks |
| `app/src/keeper.ts` | releases every commission whose hold has passed |
| `app/src/store.ts` | click attribution, a file in the demo |
| `tests/commish.ts` | the rules above, each one as a failing attack |

## Running the tests

The tests need a validator. `solana-bankrun` and `litesvm` ship no Windows
binary, so this repo runs them against surfpool instead of an in-process bank,
and uses short refund windows rather than a warped clock.

```bash
surfpool start --no-tui --no-deploy --network mainnet
solana program deploy -u http://127.0.0.1:8899 \
  --program-id target/deploy/commish-keypair.json target/deploy/commish.so
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/commish.ts
```

## Not in scope yet

Fraud scoring for self-referred orders, multi-currency payouts, and the tax
paperwork a brand still owes its creators. The attestor is trusted by the brand
that appointed it: this program removes the brand's ability to stall or skim a
payout, not the brand's ability to lie about whether a sale happened.
