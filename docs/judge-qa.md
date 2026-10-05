# Judge Q&A

Short answers. Numbers here are from the repo and the program; nothing is projected.

**Who funds early payouts? Who buys the receivable?**
A buyer desk: any wallet that pays the router USDC now with `sell` and becomes the payee, collecting at release. Today the only buyer desk is a founder-run wallet, labeled SOAK. There is no outside buyer yet.

**What stops a fraudulent sale?**
`sell` needs the current payee's signature, cannot exceed face value, must be paid in the campaign's token, and is refused once the commission is due. Tests cover each of these. The buyer cannot be sold a claim that does not exist, because the claim is the on-chain commission account itself.

**What happens on a refund after an early sale?**
The buyer carries the refund risk. If the relayer cancels inside the window, the reservation returns to the tool's budget and the buyer gets nothing (test: "sell then cancel: buyer desk ends with nothing"). That risk is why a buyer pays a discount.

**Who attests, and how is that constrained?**
One relayer key, set as the campaign's attestor. It can only `record_sale` and `cancel`, cannot move vault funds, cannot cancel after the window, and cannot reserve more than the unreserved budget. A compromised relayer can create fake reservations up to the vault balance; that is the trust assumption, stated in README-JUDGES.md.

**Why not plain x402, settling instantly?**
Instant settlement pays the router before the call is final. If the tool refunds the caller, the router's cut is already gone. A holdback keeps the cut reserved, not spent, until the refund window closes.

**Isn't this just a multisig?**
No. Nobody signs a release: any keeper can call it after the window, with only a fee payer. The rules (no early release, no late cancel, no withdrawing reserved funds) are enforced by the program, not by people agreeing.

**Isn't this just x402?**
x402 is the payment handshake. Commish is what happens to the router's share after the payment: reserve, hold, release or sell. The server is x402-compatible, not certified; it accepts a raw transaction signature in `X-Payment`.

**Moat after 12 months?**
Honestly, little in code: the program is small and open source. Any moat would come from being the default holdback that relayers and buyer desks already integrate with, and from a history of releases that paid on time. None of that exists yet.

**What traction exists, and what was built during the hackathon?**
Traction: 0 foreign agents. Every founder-run payment is labeled SOAK. The repo's commit history starts on 2026-09-23, inside the window; see docs/arena-copy.md for the commit list.

**What did you personally build?**
Everything: I am the only person on the team. The program, the 33 LiteSVM tests, the relayer, keeper and soak runner, the site and the scripts. I used AI coding tools; the decisions and the deployed program are mine.

**Why Solana?**
USDC is native, a transfer costs a fraction of a cent, and finality is fast enough for a 600 s window to mean something. A 0.05 USDC call cannot carry a fee that is larger than the call.

**Why now?**
x402 gives agents a standard way to pay per call, so agent-to-agent payments with a router in the middle are starting to exist. The refund question shows up as soon as there is a router.

**Business model?**
1% of each released commission, enforced in `release()` (`FEE_BPS = 100`). Unit economics today: a $0.05 call, a 10% router cut ($0.005), 1% of that is $0.00005. That is dust until there is machine volume. Revenue so far: none.

**What would you cut with 24 hours less?**
The buyer desk and `sell` demo. Pay, reserve, hold and keeper release are the core; early payout is the part with no outside user yet.

**Strongest transaction in the demo?**
The keeper release: a wallet that is not the tool, not the relayer and not the router pays the fee, and the router receives its cut minus 1%. No party had to agree. Link the exact signature in the video: [3y2SLFmW…](https://explorer.solana.com/tx/3y2SLFmWTbvJSZs67yMP7LziRry4uWYELKWSavjzavsvHb8TFvegB49795yCThS9rVxTagCSrTrgGYHEAiJatuB7).
