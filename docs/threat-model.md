# Threat model (x402 holdback)

Scope: mainnet program `CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB` plus the off-chain relayer.

## Assets

- Vault USDC (tool treasury budget plus reserved commissions).
- Pending commission claims (router or buyer desk).
- Commission account rent (paid by the relayer, refunded on close).

## Actors and trust

| Actor | Trust | Can do |
|---|---|---|
| Tool treasury (brand) | Funds the vault | Withdraw unreserved funds only |
| Relayer (attestor) | Trusted | Record and cancel commissions |
| Router (payee) | Untrusted | Sell its own pending claim |
| Buyer desk | Untrusted | Buy a claim, collect at release |
| Keeper | Untrusted | Call release after the window |
| Upgrade authority | Trusted, single key | Replace the program |

## Threats

| # | Threat | Control | Status |
|---|---|---|---|
| T1 | Treasury pulls reserved funds | `withdraw` checks `reserved + amount <= balance` | Tested |
| T2 | Early release | `release` requires `now >= release_at` | Tested |
| T3 | Late cancel to dodge payment | `cancel` requires `now < release_at` | Tested |
| T4 | Payout or fee redirected | Payee token owner and treasury owner checked | Tested |
| T5 | Cross-campaign drain | Commission bound to its campaign and vault | Tested |
| T6 | Double record while open | One PDA per order hash | Tested |
| T7 | Replay after close | None on chain. Relayer checks PDA history and keeps a signature ledger | KNOWN, tested |
| T8 | Relayer key stolen | Fake commissions up to the vault balance. Treasury keeps vault small and rotates the attestor by new campaign | Accepted |
| T9 | Relayer records unpaid call | Relayer verifies mint, destination, amount, memo on chain before recording | Off chain |
| T10 | Buyer desk loses to refund | By design: sell transfers refund risk. Test shows desk ends with nothing after cancel | Disclosed |
| T11 | Malicious upgrade | Single founder key today; multisig planned | Open |
| T12 | Dust orders | `ZeroCommission` if the cut rounds to 0; 0.05 USDC at 10% is fine | Tested |

## Residual risk

The relayer is the trust root. If it lies or is compromised, the vault can be drained to routers it chooses, bounded by the vault balance. Keep vaults sized to expected volume over one hold window.
