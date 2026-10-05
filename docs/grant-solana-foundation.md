# Solana Foundation grant application: Commish (DRAFT, not submitted)

> **Catatan untuk founder (Bahasa Indonesia, hapus sebelum submit)**
> Ini draft. Belum dikirim ke mana pun. Cek dulu:
> 1. Isi `[NAME]`, `[LINKEDIN/X]`, email kontak, dan negara/entitas penerima di bagian Team.
> 2. **Upgrade authority tidak konsisten di repo.** `README.md` menulis `42azYT...`, sedangkan `README-JUDGES.md` menulis `ETcQvsQe...`. Cek on-chain (`solana program show CmSHpw9Q...`) dan samakan. Selain itu, catatan memori kamu bilang `42azYT` dan `Zd2Cn5FZ` milik orang lain; jangan klaim wallet itu "milik saya" di form kalau belum yakin.
> 3. **Jumlah test:** 33 (32 lama + 1 test micropayment 0.05 USDC). Draft ini pakai 33.
> 4. Angka biaya audit ($12.000) dan tarif dev time adalah **estimasi saya, bukan penawaran**. Minta quote dari 2 firma audit sebelum submit.
> 5. Kesesuaian dengan form: kebijakan terbaru ada di solana.org/grants-funding. Saya tidak membuka situs itu; cek kategori "convertible grant" dan batas nominalnya.
> 6. Semua traksi adalah SOAK (uji internal). Jangan tulis "pengguna" atau "pelanggan".

Recommended track: **Convertible grant**, because Commish has an on-chain 1% protocol fee (a commercial component) on top of an open-source public-good core.

Requested total: **USD 28,000** over about 6 months.

---

## 1. Project overview

<!-- source: README-JUDGES.md, README.md -->
Commish is an open-source, non-custodial USDC holdback program on Solana. A payer's router cut is locked in a program-owned vault, and held for a refund window (up to 90 days, `MAX_HOLD` in `program/src/lib.rs`). Then anyone can call `release` to pay it, or the attestor can `cancel` it if the caller was refunded. The pending claim can also be sold to a buyer desk for early payout. The program is 9,272 bytes (in a 9,296-byte account), written with Pinocchio, and is live on mainnet at `CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB`. It has 33 tests that attack the compiled binary. The first users are machine payments (x402 agents paying per call) and creator or affiliate commissions. This grant funds a third-party audit, moving the upgrade key to a multisig, a packaged SDK and reference relayer, and the first outside integrations.

## 2. Problem and who it is for

<!-- source: docs/judge-qa.md ("Why not plain x402", "Why now?") -->
When a router sits between a payer and a tool, instant settlement pays the router before the call is final. If the tool refunds the caller, the router's cut is already gone and someone must claw it back. Today that is handled by trust, spreadsheets, or delayed manual payouts.

Who it is for:
- **Tool and API builders** who pay routers or affiliates and want the cut reserved, not spent, until the refund window closes.
- **Routers, affiliates and creators** who want a payout that no one can withhold or release early.
- **Buyer desks** who want to buy pending commissions at a discount and carry refund risk.
- **Relayer and attestor operators** who need a small, auditable on-chain primitive instead of building their own ledger.

## 3. Why Solana

<!-- source: docs/judge-qa.md ("Why Solana?"), README.md (fee table) -->
- USDC is native, and a transfer costs a fraction of a cent (base fee 5,000 lamports per signature, per README.md). A 0.05 USDC call cannot carry a fee larger than the call.
- Finality is fast enough that a 600 s hold window means something.
- `release` needs no signer other than a fee payer, so keepers can be permissionless. The rent for each commission account is refunded to its payer on close.
- The binary is small enough to be cheap to deploy and easy to review (see section 5).

## 4. Public-good component

<!-- source: README.md (License, Repository, file table), README-JUDGES.md -->
Everything below is Apache-2.0 and in the public repo https://github.com/bryankwandou/commish :
- The on-chain program (`program/src/lib.rs`, 516 lines).
- The TypeScript client and the LiteSVM test suite (33 tests, `cd program && npm test`).
- The relayer, keeper and soak runner (`agents/`).
- The threat model (`docs/threat-model.md`), the internal security audit (`docs/INTERNAL_SECURITY_AUDIT.md`) and the live-validator proof run (`docs/proof/live-validator-run.md`).
- The documentation site (https://getcommish.vercel.app/en/docs).

Non-custodial: funds sit in program-owned vaults; the website holds no private key and every transaction is signed in the user's wallet (README.md, "Production Status"). The brand can withdraw only `vault balance - reserved`.

Commercial component (reason for the convertible track): 1% of each released commission, enforced on chain in `release()` (`FEE_BPS = 100`). Revenue to date: none (README-JUDGES.md).

## 5. Current status and on-chain proof

<!-- source: README.md, README-JUDGES.md, docs/INTERNAL_SECURITY_AUDIT.md, agents/out/soak-2026-10-03T23-21-56-533Z.md -->

| Item | Evidence |
|---|---|
| Mainnet program | [`CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB`](https://explorer.solana.com/address/CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB) |
| Deploy transaction | [`vZRdesXg...2xWPk9Cv6`](https://explorer.solana.com/tx/vZRdesXgmPhV15JwAHy5akzcsn5AWssFYGne5mCcbEcDqJufqxwZWzwSUXHbUoNKBEzaMaryR1h2kB2xWPk9Cv6) (README.md) |
| Deploy cost | 0.04901 SOL (README.md, "Production Status") |
| Binary | 9,296 bytes, sha256 `3e71be49df0861a5ff1343e6dbf0a28674d363c830b32d226fca16328cc264c4` (README.md) |
| Live app | https://getcommish.vercel.app (4 languages) |
| Tests | 33 LiteSVM tests on the compiled binary (`program/test/commish.test.ts`) |
| Live-validator run | 41 of 41 checks passed on a local validator configured like mainnet (`docs/proof/live-validator-run.md`) |
| Mainnet soak run, 2026-10-03 | 15/15 asserts passed on mainnet, hold 180 s, real USDC mint `EPjFWdd5...`, campaign `4QszPtFQeXon6KEQbgDv5mLwxB562Q9881hF24TuyWCd`; payouts matched exactly (router +12870, buyer desk +7920, fee +210 base units) (`agents/out/soak-2026-10-03T23-21-56-533Z.md`) |
| Permissionless release | [`3y2SLFmW...`](https://explorer.solana.com/tx/3y2SLFmWTbvJSZs67yMP7LziRry4uWYELKWSavjzavsvHb8TFvegB49795yCThS9rVxTagCSrTrgGYHEAiJatuB7), keeper release paid by a wallet that is not the tool, relayer or router (`docs/judge-qa.md`) |
| Colosseum | Submitted to the Colosseum Crypto World's Fair, Oct 2026 (stated by founder) |

Honest limits (from the repo):
- **Traction is zero.** Every payment so far is a founder-run test labeled SOAK; foreign agents: 0 (README-JUDGES.md, soak reports).
- **Single upgrade key today.** Multisig is planned, not done (README.md, README-JUDGES.md).
- **Relayer is a trusted attestor.** A compromised relayer can reserve fake commissions up to the vault balance (`docs/threat-model.md`, T8).
- **Known open issue T7.** An order hash can be recorded again after its commission closes; mitigated off chain only (`docs/threat-model.md`).
- Security finding 1 (pre-funding griefing) is fixed on mainnet: upgrade tx `3TKdDeWE…B5gChVbH` on 2026-10-05 (`docs/INTERNAL_SECURITY_AUDIT.md`).

## 6. Milestones and budget

<!-- Amounts, durations and the split are PROPOSED by the author of this draft. They are not taken from a repo file. Audit price is an estimate, no quote exists. -->

Total: **USD 28,000**. Development costs only (audit, developer time, infrastructure, RPC). No line repays debt or reimburses past spending.

| # | Milestone | Timeline | Amount |
|---|---|---|---|
| M1 | Program hardening and multisig | Months 1-2 | $5,000 |
| M2 | Third-party security audit | Months 2-4 | $12,000 |
| M3 | SDK, reference relayer and plugins | Months 3-5 | $7,000 |
| M4 | Pilot integrations and public report | Months 5-6 | $4,000 |
| | **Total** | | **$28,000** |

### M1: Program hardening and multisig ($5,000, months 1-2)
- **Deliverable:** a program upgrade that (a) closes finding 1 on chain (create commission by transfer, allocate, assign) and (b) addresses replay after close (T7), for example with a non-closing tombstone or a nonce; new tests for each; upgrade authority moved to a Squads-style multisig.
- **Acceptance criterion:** `cd program && npm test` passes with new tests for both fixes, the existing "KNOWN: same order hash can be recorded again" test is replaced by a rejection test, and `solana program show CmSHpw9Q...` shows an upgrade authority that is a multisig address, linked in the README.
- **Budget:** about 6 weeks part-time dev at the founder's cost basis [RATE TO CONFIRM] plus rent and fees for the upgrade buffer.

### M2: Third-party audit ($12,000, months 2-4)
- **Deliverable:** an independent audit of the post-M1 program by a named security firm, with all high and medium findings fixed.
- **Acceptance criterion:** the final audit report is published in `docs/audit/` in the public repo, with fix commits referenced for every high and medium finding, and the audited binary hash matches mainnet.
- **Budget:** firm fee. Estimate only; two quotes to be attached before the grant is signed. Any unspent amount is returned or re-scoped with the Foundation.

### M3: SDK, reference relayer and plugins ($7,000, months 3-5)
- **Deliverable:** a versioned npm SDK for the six instructions, a documented reference relayer and keeper that anyone can run, and the Shopify or WooCommerce attestor plugin listed in the README roadmap (one of the two, whichever pilots ask for first).
- **Acceptance criterion:** the SDK is published on npm with a tagged GitHub release; a third party can follow the docs and complete create, record, release on mainnet in under one hour (timed on a fresh machine, screen recording linked in the repo); CI runs the full test suite on every push.
- **Budget:** developer time, hosting and RPC for the reference deployment (about $50 per month, my estimate).

### M4: Pilot integrations and public report ($4,000, months 5-6)
- **Deliverable:** at least 3 outside projects (not founder-run wallets) running a campaign on mainnet, and a public report with real numbers.
- **Acceptance criterion:** the report lists campaign addresses; an explorer check shows at least 3 distinct creator or tool-treasury wallets that are not in `agents/founder-pubkeys.json`, each with at least one released commission. The report states the volume, the fee collected and any failures, whatever they are.
- **Budget:** integration support time, RPC and monitoring, and the cost of publishing the report.

## 7. Team

<!-- source: README-JUDGES.md ("Team: 1 person"), docs/judge-qa.md -->
- **Founder and sole builder:** [NAME], [LINKEDIN/X]
- Contact: [EMAIL]
- Location / legal entity for payment: [FILL IN]
- Built everything in the repo alone: the program, the 33 tests, the relayer, keeper and soak runner, the site and scripts. AI coding tools were used; the design decisions and the deployed program are the founder's (docs/judge-qa.md). The repo history starts on 2026-09-23 (git log).
- No other contributors or advisors are listed in the repo. [ADD IF ANY]

## 8. Risks and open questions

**Technical and product risks (from the repo)**
- Relayer trust root: if it lies or is compromised, the vault can be drained to routers it chooses, bounded by the vault balance (`docs/threat-model.md`). The audit in M2 reviews this, but the design stays trusted-attestor.
- Replay after close (T7) and USDC freeze authority (security notes, finding 4) are not fully solvable on chain.
- No outside buyer for early payouts exists yet (`docs/judge-qa.md`); the secondary market is a 2027 item in the roadmap.
- Moat is thin: the program is small and open source (`docs/judge-qa.md`).
- Unit economics are dust until there is machine volume: a $0.05 call at a 10% cut yields $0.00005 of fee (`docs/judge-qa.md`).

**Could not verify while drafting (check before submitting)**
1. Upgrade authority: README.md says `42azYTNi...`, README-JUDGES.md says `ETcQvsQe...`. Not checked on chain.
2. Test count: 33 (README-JUDGES, test file).
3. Whether the mainnet deployed binary matches the current `program/` source; the hash is quoted from README.md, not re-computed.
4. The Colosseum submission itself (taken from the founder's statement; no file in the repo confirms it).
5. Current Solana Foundation grant rules, convertible-grant terms and size limits (not opened).
6. All budget amounts, timelines and the audit price are proposals, not quotes.
7. Ownership of the wallets named in the soak reports (`Zd2Cn5FZ...`, `42azYTNi...`); the founder's own notes say they may belong to others.
8. Open-source and non-custodial claims rely on README.md; the relayer holds an attestor key, which is non-custodial for funds but should be described that way in the form.
9. The 41-check live-validator run was on a local validator, not mainnet; the mainnet evidence is the 15-assert soak run.
