# Internal security review

**What this is.** A line-by-line review of `program/src/lib.rs` (516 lines) by the
builder, with findings reproduced on a live validator.

**Status: not audited.**

**Scope.** Every instruction (`create_campaign`, `record_sale`, `cancel`, `release`,
`withdraw`, `sell`), the entrypoint, the CPI helper and account closing. Reviewed
2026-09-27 against the binary deployed on mainnet
(`CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB`).

## Findings

| # | Severity | Finding | Status |
| --- | --- | --- | --- |
| 1 | Medium | **Pre-funding blocks a sale.** The commission address is derived from the order hash. With the plain hash, anyone who can guess an order id (shops often number orders in sequence) can send a few lamports to that address first; `CreateAccount` then refuses it and `record_sale` fails for that order. No funds can be taken. Reproduced with `web/scripts/grief.mts`. | **Fixed in the client.** `orderHash(campaign, orderId, key)` now uses HMAC-SHA256 with a key only the attestor holds; the brand console derives it from a wallet signature. The same script shows the keyed sale succeeding after the same attack, and a duplicate of it still rejected. A program-side fix (create by transfer, allocate and assign) is noted for the next upgrade. |
| 2 | Low | **An order can be recorded again after its commission closes.** Closing the account on payout or refund frees its address. Only the attestor can record, so only the brand's own key can do this. | Documented. |
| 3 | Low (trust) | **The attestor can cancel any open commission inside the window, including one sold early.** This is the refund path by design; the early buyer carries that risk and the app says so. | Documented. |
| 4 | Info | **USDC has a freeze authority.** Circle can freeze a vault, as with any USDC account. | Outside the program's control. |

## Checked and holding

- The brand can only withdraw `vault balance - reserved`; the vault is owned by the campaign address, so only the program moves funds out of it.
- Release pays only a token account of the campaign's mint whose owner is the current payee, after `release_at`; the commission must belong to the campaign whose vault pays.
- Paying out closes the commission in the same instruction, so a commission cannot be paid twice.
- Cancel works only before `release_at`; sell only before it, and never above face value.
- Commission maths is exact and cannot overflow; `reserved` stays within the vault balance.
- Only the legacy SPL Token program is accepted; every token account is checked for its mint and initialised state.
- Duplicate accounts in an instruction resolve to the earlier copy; no path lets a duplicate move funds to the wrong owner.

## Evidence

- 26 unit tests against the compiled binary (`program/test`).
- 41 of 41 checks for every instruction and attack on a live validator (`docs/proof/live-validator-run.md`).
- The pre-funding finding and its fix: `web/scripts/grief.mts`.
