# Commish — Pinocchio build

The production program. Same behaviour as the Anchor reference in `programs/commish`
(same seeds for campaign/affiliate/commission, same error codes 6000+, Anchor-compatible
event encoding), plus one instruction Anchor does not have: `sell_commission`.

## Instructions

| # | Instruction | Who signs | What it does |
|---|---|---|---|
| 0 | `create_campaign` | brand | Campaign PDA + a program-derived USDC vault owned by the campaign |
| 1 | `join_campaign` | creator | Affiliate record for this campaign |
| 2 | `record_sale` | attestor | Reserves the commission; one account per order hash, so an order can never be recorded twice |
| 3 | `cancel_commission` | attestor | Refund: releases the reservation, the commission can never be paid |
| 4 | `release` | anyone | After the refund hold, pays the commission's payee |
| 5 | `withdraw` | brand | Takes back only the budget not reserved for creators |
| 6 | `sell_commission` | payee + buyer | Early payout: the buyer pays the creator now and becomes the payee; the buyer carries the refund risk |

## Cost vs Anchor

Measured on the same local validator (Surfpool) from real test transactions,
compute units including CPIs:

| Instruction | Anchor 1.1.2 | Pinocchio 0.11 | Saving |
|---|---:|---:|---:|
| create_campaign | 34,132–49,132 | 8,385 | 4–6× |
| join_campaign | 7,308–8,808 | 1,582 | ~5× |
| record_sale | 16,755–18,255 | 4,143–7,143 | ~3× |
| cancel_commission | 8,443 | 583 | ~14× |
| release | 51,343 | 8,763 (30,620 when it first creates the payee's token account) | ~6× |
| withdraw | — | 7,901 | |
| sell_commission | n/a | 8,386 | |
| Program binary | 285,016 bytes | 44,688 bytes | 6.4× |

Where the savings come from:

- No bump search where it is not needed. New PDAs are created with `invoke_signed`,
  which only lets the new account sign when the seeds and bump derive to its address,
  so that call is also the address check. Only the commission PDA uses the canonical
  bump search, because that bump is what makes "one account per order" hold.
- The vault is a program-derived token account whose address is stored in the
  campaign, so later instructions compare 32 bytes instead of deriving an ATA.
- The payee's token account is created only when it does not exist yet.
- Fixed byte layouts, no (de)serialization framework, no instruction-name logs.

## Test

```bash
cargo build-sbf                      # in pinocchio/
surfpool start --no-tui --no-deploy
solana program deploy -u l --use-rpc target/deploy/commish.so --program-id deploy/commish-keypair.json
npx ts-mocha -p ./tsconfig.json -t 1000000 pinocchio/commish.test.ts   # from the repo root
```

The suite is the Anchor suite case for case (7 tests) plus 3 early-payout tests.

## Known trade-offs

- Campaign and affiliate PDAs accept any valid bump. A second account under a
  non-canonical bump could only be made by the same signer, for itself.
- The attestor (the brand's order webhook) is trusted to report refunds honestly.
  A buyer of a commission is exposed to that brand's refund behaviour.

## Devnet

Program `F5ZfVzJ9i9bdu18sS3SHjitbvErKrS6XdBYU52Kc8ijW` (44,688 bytes), deployed 2026-09-26.
Demo campaign `BgXT9chmk44cmkoQznWCbUKf6FmJDX9S7BYQ1VCTCvYC`, run end to end from `web/`:

| Step | Signature | CU |
|---|---|---:|
| record_sale | `2X6Td4g8EfCFssJbLXvsGQszEE8LsF7CjFHXRxoUmWezPSqbUkkvRXcTcBoJUgv2y2fYgSm41rDYPkPV8QYYeK6B` | 4,143 |
| cancel_commission (refund) | `3HDFbGzMz2UAeatXcca3jRnVXJnWpy7K346ghxdw8zU2Yq9NEiVgLf1g3J168yG7y7az9oohmthuitFRdhjEiDpx` | |
| sell_commission (early payout, 3% discount) | `Cmv5Zz31BL8dRMGfL2gby4edGz8U5myYwhv15CzCQDVTPPqfbrjkqPHvJ8uVvpbYCNReyniuGzahYgRW6vz2ZJL` | |
| release | `bRv8UZ8kqVSL9Vz9Qf7HbNT5BY2D5f6RkrxEWD1MhaSXJpNPsWaZiszCuqcZssRDuB7uatCV8DCRRs4sfSkUD2J` | 2,695 |

A second release of the same order fails with `NotPending`.

```bash
cd web && RPC_URL=<devnet rpc> DEMO_PAYER=<funded keypair> npm run dev
```
