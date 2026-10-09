<p align="center">
  <a href="https://getcommish.vercel.app/en/demo"><img src="docs/images/banner-x402.png" alt="Commish: hold the cut until the call is final" width="100%"></a>
</p>

# Commish: USDC Holdback for x402 Agent Payments

> **Agents pay tools per call over HTTP 402. Commish holds the router's cut on Solana until the paid call can no longer be refunded, then anyone can release it, and it can only go to the router.**

[![Solana Mainnet](https://img.shields.io/badge/Solana-Mainnet--Beta-9945FF?logo=solana&logoColor=white)](https://explorer.solana.com/address/CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB)
[![Demo](https://img.shields.io/badge/Demo-1%3A17%20on%20mainnet-111111?logo=vercel&logoColor=white)](https://getcommish.vercel.app/en/demo)
[![x402](https://img.shields.io/badge/x402-HTTP%20402%20endpoint-FF6B00)](https://getcommish.vercel.app/en/agent)
[![Pinocchio](https://img.shields.io/badge/Pinocchio-0.11-FF6B00)](https://github.com/anza-xyz/pinocchio)
[![Program size](https://img.shields.io/badge/Program-9%2C272%20bytes-2F80ED)](#the-program)
[![Tests](https://img.shields.io/badge/Tests-33%20passing-2EA043)](#guarantees-and-the-tests-that-attack-them)
[![Security Review](https://img.shields.io/badge/Security-Internal%20Review-blue)](SECURITY.md)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Colosseum](https://img.shields.io/badge/Colosseum-Crypto%20World's%20Fair%202026-FF6B00)](https://arena.colosseum.org/projects/explore/commish)

<p align="center"><sub>▶ <a href="https://getcommish.vercel.app/en/demo"><b>Watch the 1:17 demo</b></a>: one full cycle recorded on Solana mainnet, 6 Oct 2026, with diagrams for each step.</sub></p>

---

| | |
|---|---|
| **Demo video** | [getcommish.vercel.app/en/demo](https://getcommish.vercel.app/en/demo) |
| **Try the 402 endpoint** | [getcommish.vercel.app/en/agent](https://getcommish.vercel.app/en/agent) · `GET /api/agent/call?market=bitcoin` |
| **Live ledger (read from mainnet)** | [getcommish.vercel.app/en/live](https://getcommish.vercel.app/en/live) |
| **For judges** | [README-JUDGES.md](README-JUDGES.md) |
| **Program (mainnet)** | [`CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB`](https://explorer.solana.com/address/CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB) |
| **Live campaign** | [`GvuUZi4ggeH3FC3AC7RkApQQHBRizwKW5XTRtRWStMmR`](https://explorer.solana.com/address/GvuUZi4ggeH3FC3AC7RkApQQHBRizwKW5XTRtRWStMmR) (10% router cut, 600 s refund window) |
| **Security** | [SECURITY.md](SECURITY.md) · [Internal Security Audit](docs/INTERNAL_SECURITY_AUDIT.md) · [Threat model](docs/threat-model.md) |
| **Upgrade authority** | [`42azYTNiC4bp6UtXXpEQ49adNWBbM6Hhx84xQAtEPfUe`](https://explorer.solana.com/address/42azYTNiC4bp6UtXXpEQ49adNWBbM6Hhx84xQAtEPfUe) (single key today; Squads multisig planned) |
| **Run it on your own Solami key** | [instructions](#run-it-on-your-own-solami-key) |

## How it works

```
+---------+    +-----------+    +---------+    +-------------------+
|  Pay    | -> |  Reserve  | -> |  Hold   | -> | Release  or  Sell |
| agent   |    | relayer   |    | 600 s   |    | keeper    buyer   |
| USDC to |    | records   |    | refund  |    | pays      pays    |
| vault   |    | the cut   |    | window  |    | router    now     |
+---------+    +-----------+    +---------+    +-------------------+
```

1. **Pay.** An agent calls the tool and gets HTTP 402 with a price, a vault and a memo. It pays 0.05 USDC into the campaign vault, with a memo naming its router, then retries with the payment signature and gets the data (the first paid tool is [Panta](https://www.panta.market/) prediction-market data).
2. **Reserve.** The relayer verifies the payment on-chain and calls `record_sale`. The program reserves the router's 10% in its own account, where the tool cannot withdraw it.
3. **Hold.** For 600 seconds a refund can `cancel` it.
4. **Release or sell.** After the window anyone can call `release`, and it can only pay the router (minus a 1% protocol fee). Before that, the router may `sell` the pending claim to a buyer.

## Proof: one full cycle on mainnet (6 Oct 2026)

| Time (UTC) | Step | Transaction |
|---|---|---|
| 13:22:52 | Agent pays 0.05 USDC into the vault | [`47MtDwTY…R12SP`](https://explorer.solana.com/tx/47MtDwTYEsu4xmNyizqXSuvpbgRwmS1g76W4UdnqBUYFBwpUWE763SUXFVaDxC3onKpUR6cZ1Xb4EbFryHSR12SP) |
| 13:22:54 | Relayer records it; 0.005 USDC held by the program | [`2GXGEqG9…KD5F5`](https://explorer.solana.com/tx/2GXGEqG92tbFqummdYMSePphoGHmemWcWN1F6qfr9Ho5daGJKyHXSsJNNLApkXaeja2YKxeGCUYX7vV7XXFKD5F5) |
| 13:33:12 | Window closed at 13:32:54; keeper releases 0.00495 USDC to the router | [`5UP1zayt…18sT3`](https://explorer.solana.com/tx/5UP1zaytSZYa8H6p6xFJSd8fccJLjnkeMg37UuUiVPrXyv2Cs5Xks28dtiBUkMxmd5wj73XsSux96Aivis118sT3) |

Traction, stated plainly: every payment so far comes from the founder's own test agent. Outside agents: 0.

## Built with

- **Solana program:** Rust, Pinocchio 0.11, no Anchor; 9,272-byte binary; 33 LiteSVM tests against the compiled binary.
- **Panta API:** the paid tool behind the 402 endpoint (`web/src/lib/panta.ts`).
- **Solami RPC:** every server-side chain read (`web/src/lib/solami.ts`).
- **Web:** Next.js on Vercel: the 402 endpoint, relayer routes and live ledger.

## Hackathon tracks and sponsors

Submitted to the Colosseum Crypto World's Fair main track ([project page](https://arena.colosseum.org/projects/explore/commish)) and to these Superteam Earn side tracks. Same product in every entry.

| Track | What it uses in Commish | Where to look |
|---|---|---|
| **Panta API** | Panta prediction-market data is the first paid tool behind the 402 endpoint. `GET /markets/` (text search) and `GET /markets/{id}/` with `X-Api-Key`, server-side only. If Panta fails after payment, the route returns 502 and the agent retries with the same signature; it is never charged twice. | [`web/src/lib/panta.ts`](web/src/lib/panta.ts) · [`docs/panta-adapter.md`](docs/panta-adapter.md) · try `GET /api/agent/call?market=bitcoin` |
| **Solami** | Solami RPC is the data path for every server-side read: verifying each agent's USDC payment before `record_sale`, the campaign and vault, the [live ledger](https://getcommish.vercel.app/en/live) and the release sweep. Rate-limited calls back off and retry. A webhook receiver (HMAC-checked) and Beam tips are built behind flags. | [`web/src/lib/solami.ts`](web/src/lib/solami.ts) · [`web/src/app/api/solami/webhook/route.ts`](web/src/app/api/solami/webhook/route.ts) · [Run it on your own Solami key](#run-it-on-your-own-solami-key) |
| **RPC Fast** | Failover mainnet RPC. When a Solami read is rate-limited or fails after two retries, `rpc()` sends it to RPC Fast (`solana-rpc.rpcfast.com`, Frankfurt), then to `RPC_URL`. `/api/agent/health` probes it on every call and reports `fallbackRpcOk`. | [`web/src/lib/rpcfast.ts`](web/src/lib/rpcfast.ts) · [`web/src/lib/agent.ts`](web/src/lib/agent.ts) `rpc()` · [health](https://getcommish.vercel.app/api/agent/health) |
| **CertiK** (audit credits) | The program custodies USDC for third parties and is live on mainnet; it has had an internal review only. Scope we want audited: `program/src/lib.rs` (542 lines, six instructions). | [Internal Security Assurance](#internal-security-assurance) · [SECURITY.md](SECURITY.md) |
| **Adevar Labs** (pre-audit) | Same scope. Known areas to review: trusted relayer (bounded by vault balance), re-recording after close (guarded off-chain), single-key upgrade authority. | [`docs/INTERNAL_SECURITY_AUDIT.md`](docs/INTERNAL_SECURITY_AUDIT.md) · [`docs/threat-model.md`](docs/threat-model.md) |
| **AkcaVPN** (credits) | Solo founder working remotely from Indonesia, operating the relayer and keeper keys that sign mainnet transactions. | [Team](#team) |

Applying to a track is not winning it; none of these sponsors has reviewed or endorsed Commish.

---

> **About the sections below.** The Commish program was first built for affiliate commissions, and the rest of this README still describes it in those terms. The program did not change for x402; only the roles moved:
> brand → **tool treasury**, attestor → **relayer**, creator → **router**, order → **paid call**, refund window → **600-second holdback**.

---

# ENGLISH

## Table of Contents

1. [What Is Commish?](#what-is-commish)
2. [The Problem](#the-problem)
3. [The Solution](#the-solution)
4. [How It Works, End to End](#how-it-works-end-to-end)
5. [System Architecture](#system-architecture)
6. [Key Features](#key-features)
7. [Early Payout](#early-payout)
8. [The Program](#the-program)
9. [Guarantees and the Tests That Attack Them](#guarantees-and-the-tests-that-attack-them)
10. [On-Chain Proof](#on-chain-proof)
11. [Business Model](#business-model)
12. [Tech Stack](#tech-stack)
13. [Quick Start](#quick-start)
14. [Environment Variables](#environment-variables)
15. [Integration Guide for Brands](#integration-guide-for-brands)
16. [Security Model](#security-model)
17. [Repository Layout](#repository-layout)
18. [Roadmap](#roadmap)
19. [Team](#team)
20. [Media and Credits](#media-and-credits)
21. [License](#license)

---

## What Is Commish?

Commish is an escrow protocol for affiliate commissions. A brand locks a USDC
budget in a campaign vault. Each sale a creator refers reserves that creator's
cut in its own on-chain account, where the brand can no longer spend it. When
the refund window closes, anyone can trigger the payout, and it can only land
in the creator's token account.

Brands keep the refund window they already use. Creators get something they
never had: a public, binding promise that the money exists and will be paid on
a known date. A creator who does not want to wait can sell that promise to a
buyer for cash today.

The whole protocol is one Pinocchio program with a **9,272-byte** binary, deployed to
Solana mainnet for **0.04901 SOL**.

---

## The Problem

<p align="center"><img src="docs/images/guarantees.png" alt="What Commish guarantees" width="100%"></p>

**1. Creators are paid on the brand's schedule.** Amazon Associates pays
commission "approximately 60 days after the end of the month" in which it was
earned ([S1](research/commish-sources.md)). A sale on January 2 becomes money
around the end of March.

**2. The hold exists for a good reason.** About **19.3% of US online sales**
were expected to be returned in 2025 ([S2](research/commish-sources.md)). No
brand wants to pay commission on a refunded order, so holding commission until
the refund window closes is fair.

**3. What is missing is a guarantee.** During the hold, the money is still the
brand's. Programs change terms, shut down, or fall behind, and the creator has
no independent record of what they are owed. Among affiliates in high-risk
verticals, 73% name payout reliability as their main reason to switch programs
([S8](research/commish-sources.md), secondary source).

**4. Instant payouts do not work.** At least eight earlier Solana affiliate or
referral projects entered Colosseum hackathons, and none placed
([S7](research/commish-sources.md)). Several promised instant payouts, which
ignores returns: a brand cannot pay out on an order that may still be refunded.

**Market.** US brands are forecast to spend **$13.81B** on affiliate marketing
in 2026 ([S3](research/commish-sources.md), secondary source), and there are
about **50 million** creators worldwide ([S4](research/commish-sources.md)).

---

## The Solution

Commish changes one thing: **the moment a sale is recorded, the commission
stops belonging to the brand.**

| | Today | With Commish |
|---|---|---|
| Where the commission sits during the hold | The brand's bank account | A program-owned USDC vault, reserved per order |
| Can the brand spend it during the hold? | Yes | No. `withdraw` only moves the unreserved balance |
| Refund inside the window | Brand adjusts a spreadsheet | Attestor calls `cancel`; the reservation returns to the budget |
| Who can trigger the payout | Only the brand | Anyone, once the window closes |
| Where the payout can go | Wherever the brand sends it | Only the payee's own USDC account for the campaign's mint |
| If the platform disappears | The creator chases the brand | The creator calls `release` from any Solana client |
| Need the money early | Wait | Sell the pending commission in one transaction |
| Cross-border cost | Wire and FX fees, payout minimums | A Solana base fee of 5,000 lamports per signature ([S6](research/commish-sources.md)) |

Commish does not try to prove that an off-chain sale happened; nothing on-chain
can. The brand's attestor reports sales. What Commish guarantees is everything
after that report.

---

## How It Works, End to End

<p align="center"><img src="docs/images/how-it-works.png" alt="Four steps: fund, record, hold, release" width="100%"></p>

```mermaid
sequenceDiagram
    autonumber
    participant B as Brand
    participant A as Attestor (shop server)
    participant P as Commish program
    participant C as Creator
    participant Y as Buyer (optional)
    participant X as Anyone
    B->>P: create_campaign(rate, refund window, attestor)
    B->>P: deposit USDC into the campaign vault
    A->>P: record_sale(order hash, order total, creator)
    Note over P: cut = total x rate, reserved in its own account
    opt creator wants cash now
        C->>P: sell(price), co-signed by the buyer
        Y-->>C: price in USDC
        Note over P: buyer becomes the payee
    end
    alt order refunded inside the window
        A->>P: cancel
        Note over P: reservation returns to the budget
    else window closes
        X->>P: release
        P->>C: USDC to the payee's token account
    end
```

1. **Fund.** The brand creates a campaign with a commission rate (up to 50%), a
   refund window (0 to 90 days) and an attestor key, then deposits USDC into a
   vault owned by the campaign address.
2. **Record.** When a referred order is paid, the brand's attestor calls
   `record_sale` with a hash of the order, the order total and the creator's
   wallet. The program computes the cut from the campaign rate and refuses the
   sale if the unreserved budget cannot cover it.
3. **Hold.** Inside the refund window the attestor can `cancel` the commission
   if the order is refunded. The brand can withdraw everything except what is
   reserved.
4. **Release.** After the window, anyone can call `release`. The USDC goes to
   the current payee's token account, the commission account closes, and its
   rent returns to whoever paid it.

### State of one commission

| | |
| --- | --- |
| <img src="docs/images/commission-held.png" alt="Held" width="360"> | **Held.** 25.00 USDC reserved from a 250.00 USDC order at 10%; the brand cannot withdraw it. |
| <img src="docs/images/commission-sold.png" alt="Sold early" width="360"> | **Sold early.** The creator receives 24.25 USDC now; the buyer is the payee. |
| <img src="docs/images/commission-paid.png" alt="Paid out" width="360"> | **Paid.** Released when the window closed; the account is closed and its rent refunded. |

---

## System Architecture

```mermaid
flowchart LR
    subgraph Browser
        W[Wallet: Phantom, Solflare, Backpack]
        UI[Next.js app<br/>landing, brand console,<br/>creator desk, docs]
    end
    subgraph Server["Next.js server routes"]
        API[Read API<br/>getProgramAccounts filters]
        RPCP[RPC proxy<br/>method allow-list]
    end
    subgraph Solana["Solana mainnet"]
        P[Commish program]
        CA[Campaign PDA]
        V[USDC vault ATA]
        CM[Commission PDAs]
        T[SPL Token program]
    end
    SHOP[Brand's shop server<br/>attestor key] -- record_sale / cancel --> P
    UI -- builds transactions --> W
    W -- signed transactions --> RPCP --> P
    UI --> API --> Solana
    P --> CA & V & CM
    P -- CPI transfer --> T
```

- **The program is the source of truth.** There is no database. Every balance,
  reservation and commission shown in the app is read from program accounts.
- **The server never signs.** Server routes only read chain state and forward
  a fixed list of JSON-RPC methods for the browser.
- **The attestor is the brand's own key.** It lives on the brand's shop
  server, not on Commish infrastructure. For small shops, the brand console
  can act as the attestor from a connected wallet.

---

## Key Features

<p align="center"><img src="docs/images/hero.png" alt="Landing page" width="100%"></p>

| | |
| --- | --- |
| <img src="docs/images/brand-console.png" alt="Brand console"> | <img src="docs/images/docs.png" alt="Docs"> |
| **Brand console** (`/brand`). Create and fund campaigns, record sales, refund inside the window, withdraw what is unreserved, share the campaign link. | **Docs** (`/docs`). Accounts, instructions, error codes, integration steps and the security model. |
| <img src="docs/images/light-zh.png" alt="Light theme in Chinese"> | <img src="docs/images/mobile-id.png" alt="Mobile, Bahasa Indonesia" width="220"> |
| **Four languages, two themes.** | **Phone-first layout.** |

- **Creator desk** (`/creator`): every commission a wallet is owed across all
  campaigns, what is pending and what is due, one-click release, early payout,
  and a referral-link builder.
- **Campaign page** (`/campaign/<address>`): a public, read-only view of a
  campaign's budget, reservations and open commissions. A creator can check a
  brand's budget before promoting it.
- **Integration** (`/docs#integration`): a TypeScript client with account
  decoders, PDA derivation and a builder for every instruction.

<p align="center"><img src="docs/images/integration.png" alt="Integration code sample" width="100%"></p>

---

## Early Payout

<p align="center"><img src="docs/images/early-payout.png" alt="Early payout calculator" width="100%"></p>

A pending commission is money owed on a known date, so it can be sold.

- The payee and a buyer both sign `sell` with an agreed price.
- The price is paid in the campaign's token and can never exceed the
  commission's face value.
- The buyer becomes the payee and collects the full amount at release.
- The buyer also takes over the refund risk: if the order is refunded inside
  the window, the commission is cancelled and the buyer receives nothing. The
  discount prices that risk.
- It settles in one transaction; neither side has to trust the other.

Worked example: a 25.00 USDC commission due in 30 days, sold at a 3% discount.
The creator receives **24.25 USDC today**. The buyer receives **25.00 USDC** at
release.

---

## The Program

Written with [Pinocchio](https://github.com/anza-xyz/pinocchio) 0.11: no
Anchor, no heap allocation, no serialization library. Source:
[`program/src/lib.rs`](program/src/lib.rs), 542 lines.

### Size and deploy cost

Mainnet rent is `(bytes + 128) × 5,080` lamports.

| Account | Bytes | Rent (SOL) |
| --- | ---: | ---: |
| Program data (binary + 45-byte header) | 9,341 | 0.04810252 |
| Program account | 36 | 0.00083312 |
| **Total held by the deploy** | | **0.04893564** |

The first working build was 25,664 bytes (about 0.13 SOL to deploy). It shrank
to 9,296 bytes, and to 9,272 bytes in the 5 Oct 2026 upgrade, without removing a feature or a check:

- `core` rebuilt with `panic_immediate_abort`, `opt-level = 3`, fat LTO.
- Zero-copy `#[repr(C)]` records read in place.
- A hand-written lazy entrypoint that reads at most 7 accounts, and one CPI
  helper shared by every token transfer.
- The client passes PDA bumps and rent amounts. The program re-derives each
  PDA with the given bump and compares it; the runtime rejects an account
  below the rent-exempt minimum.
- Checked arithmetic where an input can overflow; invariant-based arithmetic
  only where the invariant is enforced on the way in.

The 33 tests run against this exact build, so the size work is tested, not
assumed.

### Accounts

| Account | Seeds | Size | Holds |
| --- | --- | ---: | --- |
| Campaign | `["campaign", brand, id_le]` | 176 | brand, attestor, mint, vault, id, hold, reserved, paid, bps |
| Commission | `["commission", campaign, order_hash]` | 184 | campaign, creator, payee, rent payer, order hash, amount, release time, sold flag |
| Vault | associated token account of the campaign | 165 | the campaign's USDC |

### Instructions and compute units

| # | Instruction | Signers | What it checks | Compute units |
| ---: | --- | --- | --- | ---: |
| 0 | `create_campaign` | brand | rate ≤ 5,000 bps, hold ≤ 90 days, vault is the campaign's ATA | 15,109 (with the vault) |
| 1 | `record_sale` | attestor, payer | signer is the campaign attestor, commission > 0, `reserved + cut ≤ vault balance` | 1,783 |
| 2 | `cancel` | attestor | before `release_at` | 376 |
| 3 | `release` | none | after `release_at`, destination owned by the payee and holding the campaign mint, commission belongs to this campaign; 1% goes to the treasury's token account | 2,947 |
| 4 | `withdraw` | brand | `reserved + amount ≤ vault balance` | 1,450 |
| 5 | `sell` | payee, buyer | before `release_at`, price ≤ face value, token accounts on the campaign mint | 1,622 |

### Order hash

The commission address is a PDA of the order hash, so one order can only ever
be recorded once.

```
order_hash = HMAC-SHA256(key, "commish:v1" || campaign || order_id)
```

The key is known only to the brand: its shop secret, or a key the brand
console derives from a wallet signature. Without it, nobody can compute the
address of a future order and create it first to block the sale. See finding 1
in the [security notes](docs/INTERNAL_SECURITY_AUDIT.md).

### Error codes

| Code | Name | Code | Name |
| ---: | --- | ---: | --- |
| 6000 | InvalidInstruction | 6009 | ZeroCommission |
| 6001 | NotEnoughAccounts | 6010 | InsufficientBudget |
| 6002 | MissingSigner | 6011 | StillHeld |
| 6003 | InvalidAccount | 6012 | AlreadyDue |
| 6004 | WrongAttestor | 6013 | NotPayee |
| 6005 | WrongBrand | 6014 | InvalidPrice |
| 6006 | WrongAccount | 6015 | Overflow |
| 6007 | InvalidCommission | 6016 | TooManyAccounts |
| 6008 | InvalidHold | 6017 | Runtime |

---

## Guarantees and the Tests That Attack Them

Every rule is enforced by the program and attacked by a test in
[`program/test/commish.test.ts`](program/test/commish.test.ts), which loads
the compiled `.so` into LiteSVM.

| Guarantee | How the program enforces it | Test |
| --- | --- | --- |
| Owed money stays locked | `withdraw` requires `reserved + amount ≤ vault balance` | the brand can take back only what is not reserved |
| One order, one commission | the commission address is a PDA of the order hash | the same order can never be recorded twice |
| Only the attestor records sales | the signer must equal `campaign.attestor`; the amount comes from `campaign.bps` | only the campaign's attestor can record a sale |
| No overspending | a sale needs `reserved + cut ≤ vault balance` | a sale cannot reserve more than the unreserved budget |
| Payouts cannot be redirected | the destination's owner must be the payee and its mint the campaign mint | the payout cannot be redirected |
| No cross-campaign drains | the commission must belong to the campaign whose vault pays | a commission from another campaign cannot drain this vault |
| Paid exactly once | the commission account is closed in the instruction that pays it | a commission cannot be paid twice |
| No cancelling after the window | `cancel` requires `now < release_at` | once the window has closed the commission is owed and cannot be cancelled |
| Rent goes back to its payer | the rent destination must equal `commission.rent_payer` | the rent goes back to whoever paid it, nobody else |
| Works without this website | `release` needs no signer | pays the creator once the refund window closes, and refunds the rent |

A second, independent check: [`web/scripts/lifecycle.mts`](web/scripts/lifecycle.mts)
drives the full lifecycle through the app's own client against a local
validator with mainnet's feature set, and passed **41 of 41** checks
([`docs/proof/live-validator-run.md`](docs/proof/live-validator-run.md)).

---

## On-Chain Proof

| What | Link |
| --- | --- |
| Program account | [CmSHpw9Q…w8D79Z8jjhWmPJfFB](https://explorer.solana.com/address/CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB) |
| Deploy transaction | [vZRdesXg…2xWPk9Cv6](https://explorer.solana.com/tx/vZRdesXgmPhV15JwAHy5akzcsn5AWssFYGne5mCcbEcDqJufqxwZWzwSUXHbUoNKBEzaMaryR1h2kB2xWPk9Cv6) |
| Upgrade transaction (finding #1 fix, 2026-10-05) | [3TKdDeWE…B5gChVbH](https://explorer.solana.com/tx/3TKdDeWEeKgsBA5skKqYHnzE8zkFDuUA54j7szYbx4Ejaarx2ZFyGBNkV7S5u5gQ18RQTwLM5DA6tQS2B5gChVbH) |
| Upgrade authority | [42azYTNi…4xQAtEPfUe](https://explorer.solana.com/address/42azYTNiC4bp6UtXXpEQ49adNWBbM6Hhx84xQAtEPfUe), a single key |
| Deployed binary hash | `sha256 6a88a6d02bb2e41151340c7283890d2130a2e8d85c7dcce810f7d8b4c0ffb4f5` (9,272 bytes; the program account is 9,296 bytes, the rest is zero padding). Matched against a local build of this source after the 2026-10-05 upgrade. |

To verify the binary yourself:

```bash
solana program dump CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB onchain.so -u m
head -c 9272 onchain.so | sha256sum
cd program && npm run build && sha256sum target/deploy/commish.so
```

---

## Business Model

- **Fee:** 1% of each payout, taken at release and sent to the treasury's USDC
  account. It is enforced in the program source (`FEE_BPS = 100`) and covered by
  two tests and the lifecycle run. It is live on mainnet: the 3 Oct 2026 mainnet
  test run paid the 1% to the treasury at each release.
- **Size of the prize:** if 1% of US affiliate spend settled through Commish,
  that is about $138M a year in volume and about **$1.4M a year** in fees.
- **Early payout:** a market for pending commissions. Buyers earn the discount;
  a protocol fee on sales is a later option.
- **First users:** Solana apps that already pay creators and referrers in
  USDC, where the wallet, the token and the audience are already on-chain.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| On-chain program | Rust, Pinocchio 0.11, SBPF v0, `cargo build-sbf` with `-Zbuild-std=core` |
| Program tests | LiteSVM, TypeScript |
| Token | SPL Token (legacy program), USDC |
| Web app | Next.js (App Router), React, TypeScript, Tailwind CSS |
| Wallets | Solana Wallet Adapter (Phantom, Solflare, Backpack and any Wallet Standard wallet) |
| Client | `@solana/kit`, hand-written decoders and instruction builders |
| i18n | English, Bahasa Indonesia, Español, 中文 |
| Hosting | Vercel |
| Pitch and media | Plinth (deck), PptxGenJS (PowerPoint), Playwright and ffmpeg (videos) |

---

## Quick Start

Program (needs the Solana CLI with `cargo build-sbf`):

```bash
cd program
npm ci
npm run build   # target/deploy/commish.so, 9,272 bytes
npm test        # 33 tests against the compiled binary
```

App:

```bash
cd web
npm ci
npm run dev     # http://localhost:3000
```

Full lifecycle on a local validator with mainnet's feature set (SIMD-0500
turned off, as on mainnet):

```bash
solana-test-validator --reset \
  --deactivate-feature B8JJXCy5amZyWG9r7EnUYLwzXSXTxG7GZ1qZ1qggo83g
solana program deploy program/target/deploy/commish.so -u l
cd web && RPC_URL=http://127.0.0.1:8899 node --import tsx scripts/lifecycle.mts <payer-keypair.json>
```

---

## Environment Variables

The app holds no private keys. The API keys below are secrets: keep them in
`web/.env.local` or your host's env settings, never in the repo.

| Variable | Used for | Default |
| --- | --- | --- |
| `RPC_URL` | server-side reads and the RPC proxy | `https://api.mainnet-beta.solana.com` |
| `NEXT_PUBLIC_RPC_URL` | the browser's RPC endpoint | the app's own `/api/rpc` proxy |
| `NEXT_PUBLIC_SITE_URL` | canonical links and share URLs | `https://getcommish.vercel.app` |
| `SOLAMI_API_KEY` | Solami RPC for every server-side read (secret) | unset: falls back to `RPC_URL` |
| `SOLAMI_RPC_URL` | full Solami RPC URL, overrides `SOLAMI_API_KEY` (secret) | unset |
| `SOLAMI_WEBHOOK_SECRET` | HMAC check on `/api/solami/webhook` (secret) | unset: webhook refuses calls |
| `SOLAMI_BEAM` | `1` adds a Beam tip to our own sends (costs SOL) | off |
| `SOLAMI_BEAM_TIP_LAMPORTS` | Beam tip per transaction | `100000` |
| `RPCFAST_API_KEY` | [RPC Fast](https://rpcfast.com) failover RPC: reads move here when Solami is rate-limited or down (secret) | unset: no RPC Fast failover |
| `RPCFAST_RPC_URL` | full RPC Fast URL, overrides `RPCFAST_API_KEY` (secret) | unset |
| `PANTA_API_KEY` | Panta market data sold by `/api/agent/call` (secret) | unset |
| `PANTA_API_URL` | Panta API base URL | Panta's public API |
| `COMMISH_DEMO_CAMPAIGN` | campaign the 402 endpoint and `/live` use; mainnet: `GvuUZi4ggeH3FC3AC7RkApQQHBRizwKW5XTRtRWStMmR` | unset: both are off |
| `COMMISH_FOUNDER_PUBKEYS` | comma-separated wallets `/live` labels as SOAK (founder-run) | empty |

### Run it on your own Solami key

1. Get a key at [solami.dev](https://solami.dev).
2. Put it in `web/.env.local`:

   ```bash
   SOLAMI_API_KEY=your-key
   COMMISH_DEMO_CAMPAIGN=GvuUZi4ggeH3FC3AC7RkApQQHBRizwKW5XTRtRWStMmR
   PANTA_API_KEY=your-panta-key   # optional: only the paid call needs it
   ```

3. `cd web && npm ci && npm run dev`, then open
   <http://localhost:3000/en/live>. The live ledger, the payment check behind
   `/api/agent/call` and the release sweep now read mainnet through Solami
   (`web/src/lib/solami.ts`, `rpcUrl()`). Requests that hit Solami's rate limit
   back off and retry (`web/src/lib/agent.ts`).
4. Check it: `curl http://localhost:3000/api/agent/health` returns `"rpcOk":true`.

---

## Integration Guide for Brands

1. Create a campaign in the brand console: rate, refund window, attestor key.
2. Deposit USDC into the campaign vault.
3. Creators share your product links with `?ref=<their wallet>`. Store the ref
   with the order at checkout.
4. When a referred order is paid, your server computes the keyed order hash
   and sends `record_sale`, signed by the attestor key.
5. If the order is refunded inside the window, send `cancel`.
6. Nothing else. Creators, or anyone, release due commissions.

```ts
import { orderHash, recordSaleIx } from "./lib/commish/program";

const hash = await orderHash(campaign, order.id, SHOP_SECRET);
const { instruction } = await recordSaleIx({
  attestor, payer, campaign, vault,
  orderHash: hash,
  orderAmount: order.totalUsdc, // 6-decimal base units
  creator: order.ref,
  lamports: commissionRent,     // rent-exempt minimum for 184 bytes
});
```

---

## Internal Security Assurance

**INTERNAL SECURITY AUDIT COMPLETED.** The audit covered the deployed
program and the security-sensitive client paths: PDA derivation, account
checks, token constraints, payout paths, early-sale authorization and
adversarial behaviour. The review and fixes were done by AI agents working
from the maintainer's requests, prompted by a Superteam Earn bug-bounty report;
the maintainer opened every pull request by hand. This is not a third-party audit.

- 33 tests against the compiled program binary
- 41 of 41 lifecycle and attack checks on a local validator
- the pre-funding griefing scenario reproduced; the keyed HMAC-SHA-256
  mitigation shown to hold
- the deployed mainnet binary compared byte for byte with a build of this source
- findings documented, including one Medium (pre-funding), now fixed in the
  program on mainnet (upgrade [`3TKdDeWE…B5gChVbH`](https://explorer.solana.com/tx/3TKdDeWEeKgsBA5skKqYHnzE8zkFDuUA54j7szYbx4Ejaarx2ZFyGBNkV7S5u5gQ18RQTwLM5DA6tQS2B5gChVbH)), on top of the client-side HMAC

Full record: [docs/INTERNAL_SECURITY_AUDIT.md](docs/INTERNAL_SECURITY_AUDIT.md).
Reporting policy: [SECURITY.md](SECURITY.md).

---

## Security Model

- **Trusted:** the brand's attestor reports real, paid orders. The program
  cannot see off-chain orders; it guarantees what happens after one is
  recorded.
- **Funds leave a vault only two ways:** `release` (to the payee, after the
  window) and `withdraw` (the unreserved part, to the brand).
- **Token checks:** only the legacy SPL Token program is accepted, and every
  token account is checked against the campaign's mint.
- **Order hashes are keyed (HMAC-SHA256),** preventing third parties from
  predicting commission addresses and pre-funding them to grief sales.
- **Single active commission per order hash:** The commission PDA address is derived
  from `["commission", campaign, order_hash]`. Once paid out or cancelled, the account
  is closed; only the attestor could record that order hash again.
- **Privileged Controls & Governance:** No application-level admin accounts, no
  pause switch. The only fee is the 1% taken at release, fixed in the program
  source (`FEE_BPS = 100`). However, the program remains upgradeable
  on mainnet under a single key (`42azYTNi…EPfUe`), scheduled to transition to a Squads
  multisig before scaling commercial volume.
- **Audit Posture:** Internal security audit and adversarial testing, done by AI agents at the
  maintainer's request; no third-party audit. See full disclosure in [SECURITY.md](SECURITY.md) and
  [docs/INTERNAL_SECURITY_AUDIT.md](docs/INTERNAL_SECURITY_AUDIT.md).

---

## Repository Layout

| Path | What it is |
| --- | --- |
| [`program/`](program) | the on-chain program (`src/lib.rs`) and its LiteSVM test suite |
| [`web/`](web) | the Next.js app: landing, brand console, creator desk, docs, API routes |
| [`web/src/lib/commish/program.ts`](web/src/lib/commish/program.ts) | the client: decoders, PDA derivation, every instruction builder |
| [`web/scripts/`](web/scripts) | lifecycle and griefing checks against a local validator |
| [`docs/`](docs) | screenshots, security notes, on-chain proof, video scripts |
| [`pitch/`](pitch) | the pitch deck: PDF, PowerPoint (pixel-exact and editable), HTML source with speaker notes |
| [`research/commish-sources.md`](research/commish-sources.md) | every outside number, with its page and a verbatim quote |
| [`brag-output/`](brag-output) | the 23-second launch video, its poster and share copy |

The directories `programs/`, `pinocchio/`, `app/`, `runbooks/`, `scripts/` and
`tests/` hold the first iteration of this project (Anchor, then an earlier
Pinocchio port). They are superseded by `program/` and `web/` and are not part
of the deployed product.

---

## Roadmap

| When | Milestone |
| --- | --- |
| Sep 2026 | Program on mainnet (first built for affiliate commissions) |
| Oct 2026 | x402 holdback live: public 402 endpoint, Panta as the first paid tool, Solami RPC, full cycle on mainnet; Colosseum submission |
| Q4 2026 | Third-party audit; upgrade authority to a Squads multisig; relayer and keeper running 24/7 |
| Q1 2027 | More paid tools behind the endpoint; an SDK so any x402 seller can add a router cut; first outside agents |
| 2027 | Open relayer set; market for pending router claims |

No token is planned.

---

## Team

**Vincentius Bryan Kwandou** (X [@nayrbryangaming](https://x.com/nayrbryangaming), GitHub [@bryankwandou](https://github.com/bryankwandou)), founder and sole developer, working remotely from Indonesia.
Informatics student in Makassar, Indonesia, and lead of the Superteam campus
club. A working creator since 2022 (Objkt, Drip, Shutterstock, Upwork). Built
the program, the app and the tests.

---

## Media and Credits

- **Demo video** (1:17, x402 cycle on mainnet, 6 Oct 2026): [getcommish.vercel.app/en/demo](https://getcommish.vercel.app/en/demo).
- **Launch video** (23 s, affiliate version): [`brag-output/brag.mp4`](brag-output/brag.mp4), made from the running app.
- **Product walkthrough**: [`docs/video/commish-walkthrough.mp4`](docs/video/commish-walkthrough.mp4).
- **Pitch deck** (12 slides): [`pitch/commish-pitch.pdf`](pitch/commish-pitch.pdf).

Music: "Happy Beats / Business Moves" Vol. 1, Vol. 10 and Vol. 12 by Sascha Ende
([ende.app](https://ende.app/en)), CC BY 4.0. Sound effects by
[Kenney](https://kenney.nl/), CC0. Demo voiceover: synthetic voice (Microsoft Edge neural TTS, en-US Andrew). Geist fonts by Vercel, SIL Open Font License.

---

## License

[Apache-2.0](LICENSE)

---
---

# BAHASA INDONESIA

## Daftar Isi

1. [Status Produksi](#status-produksi)
2. [Apa Itu Commish?](#apa-itu-commish)
3. [Masalah](#masalah)
4. [Solusi](#solusi)
5. [Cara Kerja dari Awal sampai Akhir](#cara-kerja-dari-awal-sampai-akhir)
6. [Arsitektur Sistem](#arsitektur-sistem)
7. [Fitur Utama](#fitur-utama)
8. [Pencairan Lebih Awal](#pencairan-lebih-awal)
9. [Program On-Chain](#program-on-chain)
10. [Jaminan dan Tes yang Menyerangnya](#jaminan-dan-tes-yang-menyerangnya)
11. [Bukti On-Chain](#bukti-on-chain)
12. [Model Bisnis](#model-bisnis)
13. [Tech Stack (ID)](#tech-stack-id)
14. [Mulai Cepat](#mulai-cepat)
15. [Variabel Lingkungan](#variabel-lingkungan)
16. [Panduan Integrasi untuk Brand](#panduan-integrasi-untuk-brand)
17. [Model Keamanan](#model-keamanan)
18. [Struktur Repositori](#struktur-repositori)
19. [Roadmap (ID)](#roadmap-id)
20. [Tim](#tim)
21. [Media dan Kredit](#media-dan-kredit)
22. [Lisensi](#lisensi)

---

## Status Produksi

| Status | Artinya |
|--------|---------|
| **LIVE DI MAINNET** | Program berjalan di Solana mainnet-beta; biaya deploy 0,04901 SOL |
| **NON-KUSTODIAL** | Dana ada di vault milik program. Tidak ada server, termasuk tim Commish, yang bisa memindahkannya |
| **TANPA KUNCI DI SERVER** | Website tidak menyimpan private key. Setiap transaksi ditandatangani di wallet pengguna |
| **TETAP JALAN TANPA WEBSITE** | `release` tidak butuh penanda tangan, jadi komisi yang jatuh tempo bisa dibayar dari klien Solana mana pun |
| **REVIEW INTERNAL & DIUJI DENGAN SERANGAN** | Pemeriksaan internal baris-per-baris selesai (belum ada audit independen pihak ketiga); 33 tes serangan binary dan 41 pemeriksaan siklus penuh lolos di validator lokal |
| **MULTIBAHASA** | English, Bahasa Indonesia, Español, 中文; tema terang dan gelap; tata letak untuk ponsel |

---

## Apa Itu Commish?

Commish adalah protokol escrow untuk komisi afiliasi. Brand mengunci anggaran
USDC di vault kampanye. Setiap penjualan dari kreator mencadangkan bagian
kreator itu di akun on-chain tersendiri, dan brand tidak bisa lagi
memakainya. Saat masa refund berakhir, siapa pun bisa memicu pembayaran, dan
dana hanya bisa masuk ke token account milik kreator.

Brand tetap memakai masa refund yang sudah mereka pakai. Kreator mendapat hal
yang belum pernah mereka punya: janji publik dan mengikat bahwa uangnya ada dan
akan dibayar pada tanggal yang jelas. Kreator yang tidak mau menunggu bisa
menjual janji itu ke pembeli dan menerima uang hari ini.

Seluruh protokol adalah satu program Pinocchio dengan binary **9.272 byte**,
di-deploy ke Solana mainnet dengan biaya **0,04901 SOL**.

---

## Masalah

**1. Kreator dibayar sesuai jadwal brand.** Amazon Associates membayar komisi
"sekitar 60 hari setelah akhir bulan" komisi itu didapat
([S1](research/commish-sources.md)). Penjualan tanggal 2 Januari baru jadi uang
sekitar akhir Maret.

**2. Masa tahan itu punya alasan yang sah.** Sekitar **19,3% penjualan online
di AS** diperkirakan dikembalikan pada 2025 ([S2](research/commish-sources.md)).
Tidak ada brand yang mau membayar komisi atas pesanan yang di-refund.

**3. Yang tidak ada adalah jaminan.** Selama masa tahan, uang itu masih milik
brand. Program afiliasi bisa mengubah aturan, tutup, atau telat bayar, dan
kreator tidak punya catatan independen atas haknya. Di kalangan afiliasi
sektor berisiko tinggi, 73% menyebut keandalan pembayaran sebagai alasan utama
pindah program ([S8](research/commish-sources.md), sumber sekunder).

**4. Pembayaran instan tidak berhasil.** Setidaknya delapan proyek afiliasi
atau referral Solana sebelumnya ikut hackathon Colosseum, dan tidak ada yang
juara ([S7](research/commish-sources.md)). Beberapa menjanjikan pembayaran
instan, yang mengabaikan refund.

**Pasar.** Brand di AS diperkirakan membelanjakan **US$13,81 miliar** untuk
pemasaran afiliasi pada 2026 ([S3](research/commish-sources.md), sumber
sekunder), dan ada sekitar **50 juta** kreator di dunia
([S4](research/commish-sources.md)).

---

## Solusi

Commish mengubah satu hal: **begitu penjualan dicatat, komisi itu bukan lagi
milik brand.**

| | Sekarang | Dengan Commish |
|---|---|---|
| Letak komisi selama masa tahan | Rekening bank brand | Vault USDC milik program, dicadangkan per pesanan |
| Bisakah brand memakainya? | Bisa | Tidak. `withdraw` hanya memindahkan saldo yang tidak dicadangkan |
| Refund di dalam masa refund | Brand mengubah spreadsheet | Attestor memanggil `cancel`; cadangan kembali ke anggaran |
| Siapa yang bisa memicu pembayaran | Hanya brand | Siapa pun, setelah masa refund berakhir |
| Ke mana pembayaran bisa masuk | Ke mana pun brand kirim | Hanya ke akun USDC milik penerima, untuk mint kampanye |
| Jika platform hilang | Kreator mengejar brand | Kreator memanggil `release` dari klien Solana mana pun |
| Butuh uang lebih cepat | Menunggu | Jual komisi yang tertunda dalam satu transaksi |
| Biaya lintas negara | Biaya transfer, kurs, minimum pencairan | Biaya dasar Solana 5.000 lamport per tanda tangan ([S6](research/commish-sources.md)) |

Commish tidak mencoba membuktikan bahwa penjualan off-chain benar terjadi;
tidak ada yang on-chain bisa. Attestor brand yang melaporkan penjualan. Yang
dijamin Commish adalah semua yang terjadi setelah laporan itu.

---

## Cara Kerja dari Awal sampai Akhir

<p align="center"><img src="docs/images/how-it-works.png" alt="Empat langkah: danai, catat, tahan, cairkan" width="100%"></p>

Diagram urutan lengkap ada di bagian [How It Works](#how-it-works-end-to-end).

1. **Danai.** Brand membuat kampanye dengan rate komisi (maksimal 50%), masa
   refund (0 sampai 90 hari) dan kunci attestor, lalu menyetor USDC ke vault
   milik alamat kampanye.
2. **Catat.** Saat pesanan dari referral dibayar, attestor brand memanggil
   `record_sale` dengan hash pesanan, total pesanan dan wallet kreator.
   Program menghitung komisi dari rate kampanye dan menolak penjualan jika
   anggaran yang belum dicadangkan tidak cukup.
3. **Tahan.** Di dalam masa refund, attestor bisa memanggil `cancel` jika
   pesanan di-refund. Brand bisa menarik semua dana kecuali yang dicadangkan.
4. **Cairkan.** Setelah masa refund, siapa pun bisa memanggil `release`. USDC
   masuk ke token account penerima saat ini, akun komisi ditutup, dan sewanya
   kembali ke yang membayar.

| | Status satu komisi |
| --- | --- |
| <img src="docs/images/commission-held.png" alt="Ditahan" width="360"> | **Ditahan.** 25,00 USDC dicadangkan dari pesanan 250,00 USDC dengan rate 10%; brand tidak bisa menariknya. |
| <img src="docs/images/commission-sold.png" alt="Dijual lebih awal" width="360"> | **Dijual lebih awal.** Kreator menerima 24,25 USDC sekarang; pembeli menjadi penerima. |
| <img src="docs/images/commission-paid.png" alt="Dibayar" width="360"> | **Dibayar.** Dicairkan saat masa refund berakhir; akun ditutup dan sewanya dikembalikan. |

---

## Arsitektur Sistem

Diagram lengkap ada di bagian [System Architecture](#system-architecture).

- **Program adalah sumber kebenaran.** Tidak ada database. Setiap saldo,
  cadangan dan komisi di aplikasi dibaca langsung dari akun program.
- **Server tidak pernah menandatangani.** Route server hanya membaca state
  chain dan meneruskan daftar metode JSON-RPC yang terbatas untuk browser.
- **Attestor adalah kunci milik brand sendiri.** Kunci itu ada di server toko
  brand, bukan di infrastruktur Commish. Untuk toko kecil, konsol brand bisa
  berperan sebagai attestor dari wallet yang terhubung.

---

## Fitur Utama

- **Konsol brand** (`/brand`): buat dan danai kampanye, catat penjualan,
  refund di dalam masa refund, tarik dana yang tidak dicadangkan, bagikan
  link kampanye.
- **Meja kreator** (`/creator`): semua komisi milik sebuah wallet di semua
  kampanye, mana yang tertunda dan mana yang jatuh tempo, pencairan sekali
  klik, pencairan lebih awal, dan pembuat link referral.
- **Halaman kampanye** (`/campaign/<alamat>`): tampilan publik anggaran,
  cadangan dan komisi terbuka sebuah kampanye. Kreator bisa memeriksa
  anggaran brand sebelum mempromosikannya.
- **Dokumentasi** (`/docs`): akun, instruksi, kode error, langkah integrasi
  dan model keamanan.
- **Empat bahasa, dua tema, tata letak untuk ponsel.**

---

## Pencairan Lebih Awal

<p align="center"><img src="docs/images/early-payout.png" alt="Kalkulator pencairan lebih awal" width="100%"></p>

Komisi yang tertunda adalah utang dengan tanggal jatuh tempo yang jelas, jadi
bisa dijual.

- Penerima dan pembeli sama-sama menandatangani `sell` dengan harga yang
  disepakati.
- Harga dibayar dengan token kampanye dan tidak boleh melebihi nilai komisi.
- Pembeli menjadi penerima dan menerima jumlah penuh saat pencairan.
- Pembeli juga menanggung risiko refund: jika pesanan di-refund di dalam masa
  refund, komisi dibatalkan dan pembeli tidak menerima apa pun. Diskonnya
  menghargai risiko itu.
- Selesai dalam satu transaksi; tidak ada pihak yang harus percaya pada pihak
  lain.

Contoh: komisi 25,00 USDC jatuh tempo 30 hari lagi, dijual dengan diskon 3%.
Kreator menerima **24,25 USDC hari ini**. Pembeli menerima **25,00 USDC** saat
pencairan.

---

## Program On-Chain

Ditulis dengan Pinocchio 0.11: tanpa Anchor, tanpa alokasi heap, tanpa library
serialisasi. Kode sumber: [`program/src/lib.rs`](program/src/lib.rs), 542 baris.

**Ukuran dan biaya deploy.** Sewa mainnet adalah `(byte + 128) × 5.080`
lamport. Data program 9.341 byte (0,04810252 SOL) ditambah akun program 36
byte (0,00083312 SOL), total **0,04893564 SOL**.

Build pertama berukuran 25.664 byte (sekitar 0,13 SOL). Ukurannya turun ke
9.296 byte, lalu 9.272 byte pada upgrade 5 Okt 2026, tanpa membuang fitur atau pemeriksaan:

- `core` di-build ulang dengan `panic_immediate_abort`, `opt-level = 3`, LTO penuh.
- Record `#[repr(C)]` dibaca langsung tanpa disalin.
- Entrypoint lazy yang ditulis tangan (maksimal 7 akun) dan satu helper CPI
  untuk semua transfer token.
- Klien mengirim bump PDA dan jumlah sewa. Program menurunkan ulang setiap PDA
  dengan bump itu dan membandingkannya; runtime menolak akun di bawah batas
  sewa minimum.
- Aritmetika checked untuk input yang bisa overflow.

33 tes berjalan terhadap build yang persis sama, jadi pengecilan ukuran ini
sudah diuji, bukan diasumsikan.

| # | Instruksi | Penanda tangan | Fungsi | Compute unit |
| ---: | --- | --- | --- | ---: |
| 0 | `create_campaign` | brand | membuat kampanye dan vault | 15.109 |
| 1 | `record_sale` | attestor, payer | mencatat penjualan dan mencadangkan komisi | 1.783 |
| 2 | `cancel` | attestor | membatalkan komisi untuk pesanan yang di-refund | 376 |
| 3 | `release` | tidak ada | membayar komisi yang jatuh tempo (1% ke treasury) | 2.947 |
| 4 | `withdraw` | brand | menarik anggaran yang tidak dicadangkan | 1.450 |
| 5 | `sell` | penerima, pembeli | menjual komisi yang tertunda | 1.622 |

Tabel akun dan kode error (6000 sampai 6017) ada di bagian
[The Program](#the-program).

**Hash pesanan.** Alamat komisi adalah PDA dari
`HMAC-SHA256(kunci, "commish:v1" || kampanye || id_pesanan)`. Kuncinya hanya
diketahui brand, jadi tidak ada yang bisa menghitung alamat pesanan berikutnya
dan membuatnya lebih dulu untuk memblokir penjualan.

---

## Jaminan dan Tes yang Menyerangnya

Setiap aturan ditegakkan oleh program dan diserang oleh tes di
[`program/test/commish.test.ts`](program/test/commish.test.ts).

| Jaminan | Cara program menegakkannya |
| --- | --- |
| Uang yang terutang tetap terkunci | `withdraw` mensyaratkan `reserved + jumlah ≤ saldo vault` |
| Satu pesanan, satu komisi | alamat komisi adalah PDA dari hash pesanan |
| Hanya attestor yang mencatat penjualan | penanda tangan harus `campaign.attestor`; jumlah dihitung dari `campaign.bps` |
| Tidak bisa melebihi anggaran | penjualan mensyaratkan `reserved + komisi ≤ saldo vault` |
| Pembayaran tidak bisa dialihkan | pemilik akun tujuan harus penerima dan mint-nya mint kampanye |
| Tidak bisa menguras kampanye lain | komisi harus milik kampanye yang vault-nya membayar |
| Dibayar tepat sekali | akun komisi ditutup di instruksi yang membayarnya |
| Tidak bisa dibatalkan setelah masa refund | `cancel` mensyaratkan `sekarang < release_at` |
| Sewa kembali ke pembayarnya | tujuan sewa harus `commission.rent_payer` |
| Tetap jalan tanpa website | `release` tidak butuh penanda tangan |

Pemeriksaan kedua yang independen: [`web/scripts/lifecycle.mts`](web/scripts/lifecycle.mts)
menjalankan siklus penuh lewat klien aplikasi di validator lokal dengan fitur
mainnet, dan lolos **41 dari 41** pemeriksaan
([`docs/proof/live-validator-run.md`](docs/proof/live-validator-run.md)).

---

## Bukti On-Chain

| Apa | Link |
| --- | --- |
| Akun program | [CmSHpw9Q…w8D79Z8jjhWmPJfFB](https://explorer.solana.com/address/CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB) |
| Transaksi deploy | [vZRdesXg…2xWPk9Cv6](https://explorer.solana.com/tx/vZRdesXgmPhV15JwAHy5akzcsn5AWssFYGne5mCcbEcDqJufqxwZWzwSUXHbUoNKBEzaMaryR1h2kB2xWPk9Cv6) |
| Transaksi upgrade (perbaikan temuan #1, 2026-10-05) | [3TKdDeWE…B5gChVbH](https://explorer.solana.com/tx/3TKdDeWEeKgsBA5skKqYHnzE8zkFDuUA54j7szYbx4Ejaarx2ZFyGBNkV7S5u5gQ18RQTwLM5DA6tQS2B5gChVbH) |
| Upgrade authority | [42azYTNi…4xQAtEPfUe](https://explorer.solana.com/address/42azYTNiC4bp6UtXXpEQ49adNWBbM6Hhx84xQAtEPfUe), satu kunci |
| Hash binary | `sha256 6a88a6d02bb2e41151340c7283890d2130a2e8d85c7dcce810f7d8b4c0ffb4f5` (9.272 byte; akun program 9.296 byte, sisanya padding nol). Dicocokkan dengan build lokal dari source ini setelah upgrade 2026-10-05. |

Perintah untuk memverifikasi sendiri ada di bagian [On-Chain Proof](#on-chain-proof).

---

## Model Bisnis

- **Biaya:** 1% dari setiap pencairan, diambil saat `release` dan dikirim ke akun
  USDC treasury. Sudah ada di kode program (`FEE_BPS = 100`), diuji oleh dua tes
  dan pemeriksaan siklus penuh. Sudah aktif di mainnet: uji mainnet 3 Okt 2026
  membayar 1% ke treasury di setiap release.
- **Potensi:** jika 1% belanja afiliasi AS diselesaikan lewat Commish, itu
  sekitar US$138 juta volume per tahun dan sekitar **US$1,4 juta per tahun**
  dari biaya.
- **Pencairan lebih awal:** pasar untuk komisi yang tertunda. Pembeli
  mendapat diskonnya.
- **Pengguna pertama:** aplikasi Solana yang sudah membayar kreator dan
  referrer dengan USDC.

---

## Tech Stack (ID)

| Lapisan | Teknologi |
| --- | --- |
| Program on-chain | Rust, Pinocchio 0.11, SBPF v0 |
| Tes program | LiteSVM, TypeScript |
| Token | SPL Token, USDC |
| Aplikasi web | Next.js, React, TypeScript, Tailwind CSS |
| Wallet | Solana Wallet Adapter |
| Klien | `@solana/kit` |
| Hosting | Vercel |

---

## Mulai Cepat

```bash
# Program
cd program && npm ci
npm run build   # target/deploy/commish.so, 9.272 byte
npm test        # 33 tes terhadap binary hasil kompilasi

# Aplikasi
cd web && npm ci
npm run dev     # http://localhost:3000
```

Siklus penuh di validator lokal ada di bagian [Quick Start](#quick-start).

---

## Variabel Lingkungan

Aplikasi tidak menyimpan private key. API key (Solami, Panta) bersifat rahasia; daftar lengkap variabel ada di bagian [Environment Variables](#environment-variables).

| Variabel | Kegunaan | Default |
| --- | --- | --- |
| `RPC_URL` | pembacaan di server dan proxy RPC | `https://api.mainnet-beta.solana.com` |
| `NEXT_PUBLIC_RPC_URL` | endpoint RPC di browser | proxy `/api/rpc` milik aplikasi |
| `NEXT_PUBLIC_SITE_URL` | link kanonik dan link berbagi | `https://getcommish.vercel.app` |

---

## Panduan Integrasi untuk Brand

1. Buat kampanye di konsol brand: rate, masa refund, kunci attestor.
2. Setor USDC ke vault kampanye.
3. Kreator membagikan link produk Anda dengan `?ref=<wallet mereka>`. Simpan
   ref itu bersama pesanan saat checkout.
4. Saat pesanan dari referral dibayar, server Anda menghitung hash pesanan
   berkunci dan mengirim `record_sale` yang ditandatangani kunci attestor.
5. Jika pesanan di-refund di dalam masa refund, kirim `cancel`.
6. Selesai. Kreator, atau siapa pun, mencairkan komisi yang jatuh tempo.

Contoh kode ada di bagian [Integration Guide](#integration-guide-for-brands).

---

## Jaminan Keamanan Internal

**AUDIT KEAMANAN INTERNAL SELESAI.** Audit mencakup program yang
ter-deploy dan jalur klien yang sensitif: derivasi PDA, pemeriksaan akun,
batasan token, jalur pembayaran, otorisasi jual awal, dan perilaku penyerang.
Review dan perbaikannya dikerjakan agen AI atas permintaan maintainer, berawal
dari laporan bug bounty Superteam Earn; setiap pull request dibuka manual oleh
maintainer. Ini bukan audit pihak ketiga.

- 33 tes terhadap binary program hasil kompilasi
- 41 dari 41 pemeriksaan siklus dan serangan di validator lokal
- skenario griefing pre-funding direproduksi; mitigasi HMAC-SHA-256 berkunci terbukti bertahan
- binary di mainnet dibandingkan byte per byte dengan build dari source ini
- temuan didokumentasikan, termasuk satu Medium (pre-funding) yang kini sudah
  diperbaiki di program mainnet (upgrade [`3TKdDeWE…B5gChVbH`](https://explorer.solana.com/tx/3TKdDeWEeKgsBA5skKqYHnzE8zkFDuUA54j7szYbx4Ejaarx2ZFyGBNkV7S5u5gQ18RQTwLM5DA6tQS2B5gChVbH)), selain HMAC di klien

Catatan lengkap: [docs/INTERNAL_SECURITY_AUDIT.md](docs/INTERNAL_SECURITY_AUDIT.md).
Kebijakan pelaporan: [SECURITY.md](SECURITY.md).

---

## Model Keamanan

- **Yang dipercaya:** attestor brand melaporkan pesanan yang benar-benar
  dibayar. Program tidak bisa melihat pesanan off-chain; yang dijamin adalah
  semua yang terjadi setelah pesanan dicatat.
- **Dana keluar dari vault hanya lewat dua jalan:** `release` (ke penerima,
  setelah masa refund) dan `withdraw` (bagian yang tidak dicadangkan, ke brand).
- **Pemeriksaan token:** hanya program SPL Token versi lama yang diterima, dan
  setiap token account diperiksa terhadap mint kampanye.
- **Hash pesanan memakai kunci (HMAC-SHA256),** sehingga pihak ketiga tidak bisa
  menebak alamat PDA komisi dan mendahului pendanaan (pre-funding) untuk mengganggu transaksi.
- **Satu komisi aktif per hash pesanan:** Alamat PDA diturunkan dari
  `["commission", kampanye, order_hash]`. Setelah ditutup/dicairkan, hanya attestor yang
  dapat mencatat pesanan tersebut lagi.
- **Kontrol Akses & Tata Kelola:** Tidak ada akun admin aplikasi, tidak ada tombol
  jeda. Satu-satunya biaya adalah 1% saat release, tertulis di source program (`FEE_BPS = 100`). Namun, program masih dapat di-upgrade
  di mainnet lewat satu kunci (`42azYTNi…EPfUe`), dengan rencana migrasi ke Squads multisig sebelum volume besar.
- **Status Audit:** Telah dilakukan self-review baris-per-baris dan uji serangan komprehensif;
  belum ada audit independen pihak ketiga. Keterbukaan lengkap dicantumkan di [SECURITY.md](SECURITY.md) dan
  [docs/INTERNAL_SECURITY_AUDIT.md](docs/INTERNAL_SECURITY_AUDIT.md).

---

## Struktur Repositori

| Path | Isi |
| --- | --- |
| [`program/`](program) | program on-chain dan tes LiteSVM |
| [`web/`](web) | aplikasi Next.js: landing, konsol brand, meja kreator, dokumentasi, API |
| [`web/scripts/`](web/scripts) | pemeriksaan siklus penuh dan griefing di validator lokal |
| [`docs/`](docs) | screenshot, catatan keamanan, bukti on-chain, naskah video |
| [`pitch/`](pitch) | pitch deck: PDF, PowerPoint, sumber HTML dengan catatan pembicara |
| [`research/commish-sources.md`](research/commish-sources.md) | setiap angka dari luar, dengan halaman sumber dan kutipan asli |
| [`brag-output/`](brag-output) | video peluncuran 23 detik |

Folder `programs/`, `pinocchio/`, `app/`, `runbooks/`, `scripts/` dan `tests/`
berisi iterasi pertama proyek ini dan sudah digantikan oleh `program/` dan
`web/`.

---

## Roadmap (ID)

| Kapan | Target |
| --- | --- |
| Sep 2026 | Program di mainnet (awalnya untuk komisi afiliasi) |
| Okt 2026 | Holdback x402 live: endpoint 402 publik, Panta sebagai tool berbayar pertama, Solami RPC, satu siklus penuh di mainnet; submisi Colosseum |
| Q4 2026 | Audit pihak ketiga; upgrade authority ke Squads multisig; relayer dan keeper jalan 24/7 |
| Q1 2027 | Lebih banyak tool berbayar; SDK agar penjual x402 mana pun bisa memberi bagian ke router; agen luar pertama |
| 2027 | Relayer terbuka; pasar untuk klaim router yang tertunda |

Tidak ada rencana token.

---

## Tim

**Vincentius Bryan Kwandou** (X [@nayrbryangaming](https://x.com/nayrbryangaming), GitHub [@bryankwandou](https://github.com/bryankwandou)), founder dan satu-satunya developer, bekerja remote dari Indonesia.
Mahasiswa informatika di Makassar dan ketua klub kampus Superteam. Kreator
aktif sejak 2022 (Objkt, Drip, Shutterstock, Upwork). Membangun program,
aplikasi dan tesnya sendiri.

---

## Media dan Kredit

Video peluncuran, walkthrough produk dan pitch deck ada di bagian
[Media and Credits](#media-and-credits). Musik oleh Sascha Ende (CC BY 4.0),
efek suara oleh Kenney (CC0), font Geist oleh Vercel (SIL Open Font License).

---

## Lisensi

[Apache-2.0](LICENSE)
