# Commish: holdback for machine payments

USDC holdback for x402: lock the router's cut until the paid call is final.

First users are agents. Humans are not in this loop.

## Flow

```
+---------+    +-----------+    +---------+    +-------------------+
|  Pay    | -> |  Reserve  | -> |  Hold   | -> | Release  or  Sell |
| caller  |    | relayer   |    | 600 s   |    | keeper    buyer   |
| USDC to |    | records   |    | refund  |    | pays      desk    |
| vault   |    | the cut   |    | window  |    | router    pays now|
+---------+    +-----------+    +---------+    +-------------------+
```

1. Pay: an agent gets HTTP 402, sends 0.05 USDC to the vault, retries with the signature.
2. Reserve: the relayer verifies the payment and calls `record_sale`. 10% (0.005 USDC) is reserved for the router.
3. Hold: for 600 s the relayer can `cancel` if the caller was refunded.
4. Release or sell: after the window any keeper calls `release`. Before it, the router may `sell` the claim to a buyer desk.

## On chain

Mainnet program: `CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB`. It was not changed for x402. Only the roles moved.

Both paths ran on mainnet, every step a public transaction (tables with links in [README.md](README.md#proof-one-full-cycle-on-mainnet-6-oct-2026)):

- Release path, 6 Oct 2026: pay `47MtDwTY…`, record `2GXGEqG9…`, keeper release `5UP1zayt…` (0.00495 USDC to the router, 0.00005 fee).
- Refund path, 9 Oct 2026: pay `2j1px41k…`, record `3P2qbXKx…`, refund to the agent `4b1FAR1L…`, cancel `44iK8DZt…` (the router gets nothing).

Six instructions:

| # | Instruction | Signer | What it does |
|---|---|---|---|
| 0 | `create_campaign` | tool treasury | Campaign + vault, rate (max 50%), hold (max 90 days) |
| 1 | `record_sale` | relayer | Reserves the router's cut, one account per order hash |
| 2 | `cancel` | relayer | Inside the window only; reservation goes back to budget |
| 3 | `release` | anyone | After the window; pays payee minus 1% fee |
| 4 | `withdraw` | tool treasury | Only the unreserved part of the vault |
| 5 | `sell` | payee + buyer | Buyer pays now, becomes payee, carries refund risk |

## Trust model

- The relayer is a trusted attestor. It verifies the USDC payment off chain, then records.
- A compromised relayer can reserve fake commissions. The loss is bounded by the vault balance.
- Replay after close is possible. `release` and `cancel` close the commission account, so the same order hash can be recorded again. Two LiteSVM tests show this (`finding #2: the attestor can record an order again after ...`). Mitigation: the relayer refuses any payment whose commission PDA has transaction history, and keeps a ledger of processed signatures.
- The tool treasury cannot withdraw reserved funds. Nobody can release early. Nobody can cancel late. Tests cover each case.
- Internal security audit (AI agents at the maintainer's request, not a third-party audit) in `docs/INTERNAL_SECURITY_AUDIT.md`, a threat model in `docs/threat-model.md`.
- Upgrade authority is the founder's wallet `42azYTNiC4bp6UtXXpEQ49adNWBbM6Hhx84xQAtEPfUe`. The 1% fee goes to the treasury `ETcQvsQek2w9feLfsqoe4AypCWfnrSwQiv3djqocaP2m`. The program can be changed by one key today. Moving it to a multisig is planned, not done.

## Fee

1% of each commission, taken in `release()` (`FEE_BPS = 100` in `program/src/lib.rs`). It rounds down and goes to the treasury token account. On a 0.005 USDC cut the fee is 0.00005 USDC. `record_sale`, `cancel`, `sell` and `withdraw` take no fee.

## Hard questions

**Why would an API call need a refund window?** A single synchronous read rarely does: if it fails, the agent never gets a 200. The window matters when the paid work outlives the HTTP response: async jobs (scraping, compute, multi-step agent tasks) that can fail after payment, data found stale or wrong later (an SLA breach), and disputes on prepaid credits. Each campaign sets its own window; the demo uses 600 s.

**Who pays rent for a sub-cent commission?** The relayer pays the commission account's rent (0.00158 SOL) when it records. `release` and `cancel` close the account and return the rent to that payer, as on mainnet: record `3P2qbXKx…` paid it, cancel `44iK8DZt…` returned it. So rent is working capital while the window is open, not a cost. The real cost is two network fees per commission (record, then release or cancel), 0.00001 SOL in total. Next to a 0.005 USDC cut that is a large share, so the fit is larger calls and longer jobs. Batching many calls into one commission is a next step, not built yet.

**Can a tool cancel to avoid paying the router?** On chain, `cancel` needs the relayer's signature and only works before `release_at`. The relayer cancels only with proof of a refund: a transfer from the vault back to the payer with memo `commish:refund:<payment>` (`cancelWithProof` in `agents/relayer.ts`). Dodging a 0.005 USDC cut that way costs the tool the full 0.05 USDC payment. The limit: this check is relayer policy, not program code, so a tool running its own relayer could skip it. Moving the refund check into the program is planned.

**Does a 1% fee add up?** The fee is 1% of the commission, so 0.1% of the payment at a 10% cut. At 0.05 USDC per call, 1,000 USDC a month in fees takes about 20 million paid calls. The bet is agent call volume; a fee on early sales of pending claims is a second line.

## Team and traction

- Team: 1 person.
- Traction: every founder-run payment is labeled SOAK. These are test runs, not customers.
- Foreign agents (fee payer not in `agents/founder-pubkeys.json`): 0.

## Judging criteria

| Criterion | Where to look |
|---|---|
| Functionality | Live mainnet program. 33 LiteSVM tests on the compiled binary: `cd program && npm test` |
| Impact | Agents paying agents need a refund window. Without one the router is paid before the call is final |
| Novelty | A holdback, not an escrow of the whole payment. The pending claim can be sold for early payout |
| UX | No clicks. 402, pay, retry. Keepers release. The relayer cancels on proof of refund |
| Open source | Program, client, relayer and tests are in this repo. See LICENSE |
| Business | 1% of each released commission, enforced on chain. No revenue yet |

## Run it

```
cd program && npm install && npm test
```
