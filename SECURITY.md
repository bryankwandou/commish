# Security Policy

## Status

**INTERNAL SECURITY AUDIT COMPLETED · INTERNALLY SECURITY REVIEWED**

The review and fixes were done by AI agents working from the maintainer's
requests, prompted by a report submitted through a Superteam Earn bug bounty.
The maintainer opened every pull request by hand. It is not a third-party audit,
and no outside security firm has certified or attested to this code.

The full review record is [docs/INTERNAL_SECURITY_AUDIT.md](docs/INTERNAL_SECURITY_AUDIT.md).

## Reporting a vulnerability

1. **Do not disclose publicly** and do not open a public GitHub issue.
2. **Report privately through GitHub:** open a draft advisory at
   <https://github.com/bryankwandou/commish/security/advisories/new>
   (Security tab -> "Report a vulnerability"). Only the maintainer can read it.
3. Include a description, steps or a script to reproduce, the affected commit
   or program address, and the impact you expect.

This is a one-maintainer project. Expect a reply within a few days; a fix ships
before any public disclosure.

## Review scope

- `program/src/lib.rs`: all six instructions (`create_campaign`, `record_sale`,
  `cancel`, `release`, `withdraw`, `sell`)
- the entrypoint, the CPI helper, and account closing
- PDA derivation and account-owner checks
- token-program and mint checks
- commission reservation and payout invariants
- early-sale authorization
- client-side order-hash derivation (`web/src/lib/commish/program.ts`)

## Evidence in this repository

- 31 tests against the compiled program binary (`program/test/commish.test.ts`)
- 41 of 41 lifecycle and attack checks on a local validator
  ([docs/proof/live-validator-run.md](docs/proof/live-validator-run.md))
- the pre-funding griefing scenario reproduced, and the keyed HMAC-SHA-256
  mitigation shown to hold (`web/scripts/grief.mts`)
- the deployed mainnet binary compared byte for byte with a build of this
  source (see "On-Chain Proof" in the [README](README.md))

## Findings

| # | Severity | Finding | Status |
| --- | --- | --- | --- |
| 1 | Medium | Pre-funding a predictable commission address blocks `record_sale` for that order | Mitigated in the official client: order hashes are HMAC-SHA-256 with a key only the attestor holds. A program-side fix is reserved for a future upgrade. |
| 2 | Low | An order hash can be recorded again after its commission closes | Accepted. Only the attestor can record; the guarantee is one open commission per order hash. |
| 3 | Low (trust) | The attestor can cancel an open commission inside the window, including one sold early | By design: an early buyer owns a claim that holds only if the order survives the refund window. |
| 4 | Info | USDC has a freeze authority | Outside the program's control. |

Details and reproduction steps are in [docs/INTERNAL_SECURITY_AUDIT.md](docs/INTERNAL_SECURITY_AUDIT.md).

## Trust boundary

The program guarantees what happens after a sale is recorded. It cannot see
off-chain orders, so the brand's attestor is trusted to report real, paid sales.

## Deployment and upgrade authority

| | |
| --- | --- |
| Program | `CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB` (mainnet) |
| Upgrade authority | `42azYTNiC4bp6UtXXpEQ49adNWBbM6Hhx84xQAtEPfUe`, a single key |
| Application admin | none: no pause switch and no admin instruction |
| Fee | 1% of each payout, taken at release and sent to the treasury's USDC account (`FEE_BPS = 100` in the program source) |

The program is upgradeable. Moving the upgrade authority to a multisig is a
separate operational step from the program's own authorization rules and has
not happened yet.
