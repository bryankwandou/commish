# Internal Security Audit

**Status:** INTERNAL SECURITY AUDIT COMPLETED · Internally security reviewed  
**Document Type:** Internal security audit, AI-performed at the maintainer's request (not a third-party audit)  
**Author / Reviewer:** AI agents working from requests by Bryan Kwandou (maintainer), prompted by a Superteam Earn bug-bounty report; pull requests opened manually by the maintainer  
**Third-Party Audit:** **None / Not independently audited**  
**Review Target:** `program/src/lib.rs` (535 lines)  
**Binary Verified:** Solana Mainnet deployment `CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB`  
**Review Date:** 2026-09-27  

---

## 1. Executive Summary & Review Scope

This document details an internal, line-by-line security review of the Commish Pinocchio program on Solana. The review covers:
- Core instructions: `create_campaign`, `record_sale`, `cancel`, `release`, `withdraw`, `sell`.
- Hand-rolled entrypoint, deserialization parsers (`#[repr(C)]`), and memory alignment assumptions.
- CPI helper invoking System Program and legacy SPL Token Program via `invoke_signed_unchecked`.
- Account closure lifecycle (`close_unchecked`) and rent reclamation.

This review is an internal developer review, **not an independent third-party audit**. It is published transparently to delineate verified invariants from open release-blockers and architectural trust assumptions.

---

## 2. Findings Register

| ID | Severity | Finding Summary | Impact & Reproduction | Mitigation Status |
| :--- | :--- | :--- | :--- | :--- |
| **#1** | **Medium** | **Pre-funding griefing attack blocks sale recording** | The commission PDA is derived deterministically from the order hash (`["commission", campaign, order_hash]`). If order IDs are predictable (e.g. sequential integer IDs `1001, 1002`), a malicious third party can compute the target commission PDA and pre-fund it with lamports (e.g., 1 lamport). When the brand attempts `record_sale`, the runtime System Program `CreateAccount` instruction fails because an account with positive lamports already exists at that address.<br><br>Reproduced via `web/scripts/grief.mts`. | **Client Mitigation Deployed:** `orderHash(campaign, orderId, key)` mandates HMAC-SHA256 with an attestor-held private key (derived via wallet signature). With an unpredictable hash, external parties cannot pre-fund the PDA.<br><br>**Protocol Upgrade Pending:** Program-side refactoring from `CreateAccount` to transfer + allocate + assign is scheduled for the next smart contract upgrade to enforce protocol-level resistance even if an unkeyed hash is used. |
| **#2** | **Low** | **Order hash can be re-recorded after commission account closes** | When a commission is released or refunded/cancelled, the commission PDA account is closed and rent is reimbursed. Once closed, the same order hash PDA is vacant, allowing a new commission with the same order hash to be recorded in the future. | **Accepted Design Invariant:** Only the authorized `attestor` key can execute `record_sale`. Guarantee is strictly: *One active commission per order hash at any point in time*. Documented for protocol clarity. |
| **#3** | **Low (Trust)** | **Attestor can cancel open commission even after early sale** | If a creator sells an early pending commission to a buyer, and the merchant experiences a legitimate customer refund within the refund window, the attestor can still cancel the commission, closing the account. In this event, the buyer loses the contingent claim. | **Accepted Product Architecture:** Early payout is a contingent claim on an order surviving the refund window. The risk profile is transparently surfaced in the UI/docs. |
| **#4** | **Info** | **USDC SPL Token program has freeze authority** | The underlying collateral is native Circle USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`), which retains native freeze authority capabilities at the token program layer. | **External Invariant:** Native to USDC SPL Token architecture on Solana; outside of Commish protocol control. |

---

## 3. Verified Security Invariants

The following security properties have been verified both by static analysis and by runtime testing:

- **Isolated Solvency:** A campaign brand can only withdraw unreserved funds (`vault_balance - reserved`). Vaults are owned by campaign PDAs; funds can never be moved by the Commish team, a backend key, or an arbitrary caller.
- **Payee-Locked Release:** `release` strictly transfers funds to an SPL token account belonging to the current `payee` recorded in the commission PDA, and only after the `release_at` timestamp has passed.
- **Single Payout Enforcement:** Payout and account closure occur within the exact same atomic transaction instruction, preventing double-release or reentrancy.
- **Strict Window Separation:** `cancel` and `sell` are strictly rejected after `release_at` timestamp. `release` is strictly rejected before `release_at`.
- **Bounded Arithmetic:** All arithmetic operations computing bps and balance tracking use checked operations or are mathematically proven to fit within `u64`.
- **Mint Integrity:** Strictly legacy SPL Token Program accounts of the campaign's declared mint are permitted; account initialisation state is enforced.
- **Signer Authorization:** `create_campaign` requires brand signer; `record_sale` requires campaign attestor signer; `withdraw` requires brand signer; `cancel` requires attestor signer; `sell` requires current payee signer.

---

## 4. Verification Evidence & Artifacts

- **31 Adversarial Unit Tests:** Running directly against the compiled ELF binary (`program/test/commish.test.ts`), verifying that every attack vector fails while honest workflows succeed.
- **41/41 Live Validator Lifecycle Checks:** End-to-end multi-party validation on local validator matching mainnet conditions (`docs/proof/live-validator-run.md`).
- **Griefing Attack PoC & Mitigation Proof:** Executable reproduction in `web/scripts/grief.mts`.
- **On-Chain Binary Reproducibility:** Deployed binary hash verifiable via `solana program dump CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB` matched against release artifacts.
