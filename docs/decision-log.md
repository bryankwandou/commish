# Decision log

## 2026-10-05 — From human affiliates to holdback for machine payments

**Boundary.** Tag `legacy-affiliate-v1` (branch `legacy/affiliate`, commit
`7234c35`) is the last state of the brand → creator affiliate story. Everything
after it is the rework below.

**Why.** Two outside reviews of the submission said the same thing from
different angles: the human affiliate category on Colosseum has many entries
and no placements (Redio, SuperLink, Earnify, Sendit, Coinfiliate, Reflink, …),
and with no merchant and no creator using Commish, every "user" in a demo would
be the founder's own wallets. Testing with agents is only honest if the users
are agents.

**What changes.** The user is a machine. An agent pays a paid route in USDC;
the router that sent it there earns a cut; the cut is reserved in the vault
until the call is final (the window), then anyone can release it, and the
router can sell it before then.

**What does not change.** The program. The deployed binary (`6a88a6d0…`,
9,272 bytes) already does everything this needs:

- error 6009 is `ZeroCommission`, not a dust floor: a 0.05 USDC call at 10%
  reserves 5,000 base units (test: "a 0.05 USDC paid call reserves…");
- a 600-second window is inside `0..=MAX_HOLD`;
- the vault can be funded by the payment itself, so a tool needs no USDC float.

An upgrade would also need ~0.052 SOL for a 10,240-byte extend (the account has
24 bytes left), so on-chain payment verification is out of scope this week.

**Trust, stated plainly.** The program cannot see the payment. The relayer
key is the campaign's attestor; it records a sale only after it has read a
successful USDC transfer into the vault. Trust moves from a brand to an
open-source relayer, not to zero. A compromised relayer key can reserve fake
cuts up to the vault's unreserved balance; the bound is the vault size.

**Two reviews, one plan.** The longer review proposed composing SolGig,
Meterline, QuantCoin, a proof agent and reputation into one network. The later
review rejected that as a second thesis for a solo founder with a week left.
This log follows the later one: one primitive (holdback), x402-style payments
as the first adapter, everything else deferred.

### Relayer rules (`agents/relayer.ts`, spec in `agents/SPEC.md`)

The relayer, keeper and soak runner were written on 2026-10-03, set aside on
2026-10-05 when the video was locked on the affiliate story, and restored here
unchanged except for stale facts in the docs.

| Rule | Why |
| --- | --- |
| The router is named in a memo `commish:<ref>` inside the payment, and must match `?ref=` | The ref is committed by the payer; someone who sees the signature cannot swap in their own |
| A payment whose commission PDA has any transaction history is refused; processed signatures are kept in a ledger | Replay after close (finding #2): the program lets the attestor record a closed order hash again |
| Cancel only with a refund proof: a vault → payer transfer carrying memo `commish:refund:<payment signature>` | Nobody clicks cancel; a refund is a transaction anyone can check |
| Order hash = sha256(`commish:x402:` + campaign + `:` + payment signature) | One commission per payment. Unkeyed is acceptable since the 2026-10-05 upgrade: lamports sent to the address first no longer block `record_sale` (finding #1) |
| No ref → paid call, no commission; malformed ref → 400 | |

### Deferred

SolGig discovery, Meterline channels, QuantCoin treasury, reputation scores, a
proof/risk agent, on-chain payment verification, fee changes. Each needs either
a program upgrade or users this week does not have.
