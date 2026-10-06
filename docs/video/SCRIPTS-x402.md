# Commish video scripts — x402 holdback (replaces the affiliate cuts)

The affiliate cuts in `SCRIPTS.md` are legacy (tag `legacy-affiliate-v1`).
These two match the Arena copy: "First users are agents."

Colosseum limits: pitch ≤ 2:00 with the founder introduced; demo ≤ 3:00 of
the live product, not slides, not code.

Every number below is checked against the chain or the test suite:

| Fact | Source |
| --- | --- |
| Program `CmSHpw9Q…`, 9,272 bytes | `solana program show`, hash `6a88a6d0…` |
| 33 tests on the compiled binary | `npm test` in `program/` |
| Live campaign `GvuUZi4g…`, 10%, 600 s window | `web/scripts/live-setup.mts campaign` output |
| 0.05 USDC call → 5,000 base units reserved | test "a 0.05 USDC paid call reserves a 10% router cut" |
| Foreign agents: 0 | say it; do not round up |

**Before recording:** the endpoint must be deployed and answer
`curl -i https://getcommish.vercel.app/api/agent/call` with `402`.

---

## A. Pitch video, 2:00 (founder on camera)

| Time | Say |
| --- | --- |
| 0:00 | Hi, I'm Bryan, from Makassar, Indonesia. I'm building Commish. First users are agents. Humans are not in this loop. |
| 0:08 | Agents now pay for tools over HTTP 402: a request, a price, a USDC payment, a retry. Often an agent doesn't find the tool itself. A router sends it there, and the router wants a cut. |
| 0:22 | Pay the router at once, and you pay commission on calls that fail or get refunded. Hold it, and the router has to trust the tool's spreadsheet. That's the same problem affiliates have had for twenty years, now at machine speed. |
| 0:38 | Commish is a holdback on Solana. The agent pays the tool's USDC vault. A relayer reads that payment and reserves the router's ten percent in its own account. The tool can't withdraw it. After a ten-minute refund window, anyone can release it, and it can only go to the router. |
| 0:58 | A router that can't wait can sell the pending cut for USDC now. The buyer collects at release. |
| 1:06 | It's live on mainnet. One Pinocchio program, 9,272 bytes, 33 tests that attack the compiled binary. A five-cent call reserves half a cent, exactly. A public 402 endpoint is up at getcommish dot vercel dot app. |
| 1:22 | Honest numbers: so far, zero outside agents have paid it. Every payment you'll see is mine. That's the next job. |
| 1:30 | Why me? I wrote the program, the relayer, the keeper and the tests myself. I'm a creator: I've sold art on Objkt and Drip and earn through Shutterstock and Upwork, so I know what it is to wait on someone else's payout schedule. I study informatics and lead the Superteam campus club. |
| 1:50 | If you run an agent or a paid tool, point it at the endpoint. I'm Bryan, this is Commish. |

About 290 words; lands near 1:55 at a relaxed pace.

---

## B. Demo video, 3:00 (screen recording, founder's voice)

| Time | Screen | Say |
| --- | --- | --- |
| 0:00 | Landing page | This is Commish on Solana mainnet. I'll show an agent paying a tool, the router's cut being held, and the release. |
| 0:10 | Terminal: `curl -i https://getcommish.vercel.app/api/agent/call` → `402` with terms | An agent calls a paid route without paying. It gets 402 Payment Required: the price, 0.05 USDC; the vault address; and the memo format for naming a router. |
| 0:30 | Terminal: the agent script pays 0.05 USDC with memo `commish:<router>` | The agent pays 0.05 USDC into the vault. The memo names the router that sent it. The payer commits to that, so nobody who sees the signature can swap in their own router. |
| 0:50 | Terminal: retry with `X-PAYMENT` → `200` + receipt with `recordTx` | It retries with the payment signature. The server checks the transfer on-chain, serves the call, and the relayer records the sale. Here's the receipt. |
| 1:05 | Explorer: the `recordTx`, then the commission account | On Explorer: the commission account. 5,000 base units, ten percent of the call, reserved for the router, release time ten minutes from now. |
| 1:25 | Terminal: same signature again → refused | Replay the same payment: refused. One payment, one commission. |
| 1:35 | Site: public campaign page for `GvuUZi4g…` | Anyone can see the vault, what's reserved and when each cut is due. The tool can withdraw only what isn't reserved. |
| 1:55 | Cut card: "10 minutes later" | Ten minutes later. |
| 2:00 | Terminal: `curl …/api/agent/health` → keeper sweep; Explorer: release tx | Release needs no special signer. Any request to the site triggers the keeper, which calls release. The router's USDC account receives the cut, minus a one percent fee. |
| 2:25 | Explorer: router token account balance | There it is in the router's account. If this website went offline, anyone could still call release. |
| 2:40 | Terminal: test run, 33 passing (2 s, not more) | Thirty-three tests attack these rules against the deployed binary. |
| 2:48 | Landing page | Holdback for machine payments. Commish. |

Record with the real live campaign. Say the real numbers on screen; if a fee
or balance differs from this script, say what the screen shows.

---

## Recording notes

- Same setup as `SCRIPTS.md` → Recording guide (phone at eye level, quiet room, 1920×1080).
- Terminal font ≥ 18 pt; hide the RPC URL if it carries an API key.
- Never show `RELAYER_SECRET_KEY`, `KEEPER_SECRET_KEY` or any `agents/keys/` file on screen.
