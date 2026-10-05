# Mainnet proof, October 2026

These are founder test runs on Solana mainnet, not users. There is no merchant yet.

Program: [`CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB`](https://explorer.solana.com/address/CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB)

## The flow in the demo video (4 Oct 2026, UTC)

Signed from the live site with a connected wallet: create a campaign (10%, 0-day refund window, 1 USDC), record a 2 USDC sale, release the 0.20 USDC commission from the Creator desk.

| Step | Time (UTC) | Transaction |
|---|---|---|
| `record_sale` (0.20 USDC reserved) | 04:46:28 | [5Cptxm26…oKccn6j](https://explorer.solana.com/tx/5Cptxm26d7Xrp5xn1onqv2vmvcnqzZ9efp5ds1uU1FGaFAZTAuPq7gkZ7rYhXtT3Vczoeg7jVwBMDJKDoKccn6j) |
| `release` (paid to the creator, 1% to the treasury) | 04:53:11 | [5tErVHmJ…FMibgsK](https://explorer.solana.com/tx/5tErVHmJXekAjZBjSKHvvB2zJSMTvyGNYwd8M7sX7AGQn2F8emv6Qc72iS4DJgz3ffJM2FkfuMZstew1JMFibgsK) |

Both transactions succeeded (`err: null`) and call the program above.

## Mainnet test run (3 Oct 2026)

A scripted run of every instruction on mainnet passed 15 of 15 checks: reserved funds could not be withdrawn (error 6010), release before the window failed (6011), a held commission was sold, and after the window a release with no signer other than the fee payer paid out, with 1% to the treasury.

- Campaign: [4QszPtFQ…TuyWCd](https://explorer.solana.com/address/4QszPtFQeXon6KEQbgDv5mLwxB562Q9881hF24TuyWCd)
- Release: [3y2SLFmW…EAiJatuB7](https://explorer.solana.com/tx/3y2SLFmWTbvJSZs67yMP7LziRry4uWYELKWSavjzavsvHb8TFvegB49795yCThS9rVxTagCSrTrgGYHEAiJatuB7)
