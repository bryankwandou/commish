# Arena copy (Crypto World's Fair, submit target 10 Oct 2026)

## One-liner (<= 120 chars)

USDC holdback for x402: lock the router's cut on Solana until the paid call is final. First users are agents.

## Description (<= 500 chars)

Commish is a USDC holdback for machine payments. An agent pays a tool over HTTP 402; a relayer reserves the router's 10% cut on chain; after a 600 s refund window any keeper releases it, or the router sells the claim for USDC now. First users are agents. Humans are not in this loop. Program on mainnet: https://explorer.solana.com/address/CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB. 33 tests attack the compiled binary. Foreign agents so far: 0.

(Check the length after any edit; the text above is under 500 characters.)

## Tracks (suggestion)

- Primary: Payments / stablecoins (USDC settlement for x402 calls).
- Secondary: AI agents / infrastructure (agent-to-agent payments, keeper release).
- Pick only tracks the event actually lists; do not stretch into DeFi or consumer.

## Team

Team of 1: Bryan Kwandou, solo founder. Wrote the program, tests, relayer, keeper, site and scripts.

## Prior development disclosure

Founder to confirm before submitting: the brief says the program existed before
the hackathon, but this repo's git history starts on 2026-09-23, inside the
window. All 30 commits (`git log --since=2026-09-14`) are dated 2026-09-23 or
later. If earlier work exists outside this repo (another repo, local code,
design notes), name it here with dates. Do not claim more prior work than you
can show, and do not claim less.

What the repo shows, in order:

- 2026-09-23: first commission holdback (`48510f9`), Pinocchio port with early
  payout / `sell` (`a2ee1fd`), compute-unit cuts (`962faa0`).
- 2026-09-26: test-cluster deploy, Codama client, dashboard (`60b6d07`,
  `2adc6a2`, `ac8c1e2`).
- 2026-09-27: rewrite for a sub-0.05 SOL deploy (`be83587`), web app
  (`96c11da`), README, deck, videos (`007e794`, `82c3358`, `73944f9`,
  `01b6095`), live-validator lifecycle run 41/41 (`18b00a9`), security fix with
  keyed order hashes (`c7cff86`).
- Later: 1% fee in `release()` (`1b5f8cd`, `055286b`), copy matched to mainnet
  (`92fff11`), upgrade-authority check page (`c82e1b7`, `e5bccb4`, `9d34607`),
  pitch overlay and scripts (`83d4edf`, `9e93d8c`, `19f55fa`).

The mainnet program `CmSHpw9Q…` was first built for affiliate commissions
(brands paying human creators). The x402 repositioning changes roles, not
program code. Not yet committed at the time of writing: the agent work in
`agents/` (relayer, keeper, soak runner, SPEC), the micropayment / keeper /
replay LiteSVM tests, and the `/en/agent` and `/en/live` pages. Re-run
`git log --since=2026-09-14 --oneline` right before submitting.
