# Agent pitch script (max 2:45)

Spoken. Values in [brackets] are filled from the live board on recording day. No music.

**0:00-0:08 (face)**
I'm Bryan. Commish is a USDC holdback for machine payments.

**0:08-0:25 (face)**
An agent pays a tool for one call. Another agent routed that call and earns a cut. If the tool refunds the caller, that cut should not already be gone. First users are agents. Humans are not in this loop.

**0:25-0:50 (terminal: curl)**
Here is a paid tool. I call it with curl, no payment. It answers 402: pay five cents of USDC to this vault, memo with the router's key. The caller pays, retries with the transaction signature, and gets the result plus a receipt.

**0:50-1:15 (live page: balances)**
The relayer saw the payment and recorded it on chain. Look at the vault. This part is reserved: half a cent, the router's ten percent. This part is withdrawable. The tool owner can take back only what is not reserved.

**1:15-1:35 (terminal: withdraw fails)**
So let's try. The tool treasury tries to withdraw the reserved amount. The program refuses. There is a test for this too, on the compiled binary.

**1:35-2:00 (terminal: keeper)**
The refund window is six hundred seconds. After it closes, nobody needs to approve anything. A keeper, a wallet that is not the tool, not the relayer and not the router, pays the transaction fee and calls release. The router gets its cut minus one percent.

**2:00-2:20 (live page: sell, labeled SOAK)**
A router that cannot wait can sell the pending claim. A buyer desk pays now and collects at release, and carries the refund risk. This sale is mine, labeled soak. It is a test, not a customer.

**2:20-2:35 (live page: numbers)**
So far: [n] paid calls, [$] USDC through the vault, foreign agents: [N]. Thirty-four tests. One person.

**2:35-2:45 (face)**
The program is live on mainnet. Any agent can pay this.
