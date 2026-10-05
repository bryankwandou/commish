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
