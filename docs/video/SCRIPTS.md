# Commish video scripts

# Colosseum submission cuts (use these first)

Colosseum's form sets two limits: the **pitch video is at most 2 minutes** and
must introduce the founder and why you are the person to build this; the
**demo video is at most 3 minutes** and must show the live product, not
slides and not code. The two scripts below fit those limits. The longer
scripts further down are for YouTube and the weekly posts.

## A. Pitch video, 2:00 (founder on camera the whole time)

| Time | Say |
| --- | --- |
| 0:00 | Hi, I'm Bryan, from Makassar, Indonesia. I'm building Commish. |
| 0:05 | Amazon pays its affiliates about sixty days after the month closes. Until then, what a creator earned is a line in the brand's spreadsheet. The brand can change terms, pay late, or not pay at all. |
| 0:20 | Brands hold commission for a fair reason: about one in five online orders comes back. Nobody wants to pay commission on a refund. The hold is fair. What's missing is a guarantee. |
| 0:33 | Commish puts that guarantee on Solana. The brand funds a USDC vault. When a referred sale is recorded, the creator's cut is locked in its own account. The brand can't take it back. When the refund window closes, anyone can release it, and it can only go to the creator. |
| 0:52 | A creator who can't wait can sell the pending commission today, in one transaction. The buyer collects at release. |
| 1:02 | It's live on mainnet. One Pinocchio program, 9,296 bytes, deployed for under 0.05 SOL, with 26 tests that attack every rule. |
| 1:14 | Why me? I'm a creator. I've sold my art on Objkt since 2022 and on Drip since 2024, and I earn through Shutterstock and Upwork. Every payout I get runs on someone else's schedule. I study informatics, I lead the Superteam campus club, and I built the program, the app and the tests myself. |
| 1:38 | At least eight Solana affiliate projects tried before. They promised instant payouts, and brands can't accept that while orders get refunded. Commish keeps the refund window and guarantees the money inside it. |
| 1:50 | Next: a first live campaign and ten pilots with Solana apps that already pay creators. I'm Bryan, this is Commish. |

About 290 words. Read it at a relaxed pace and it lands at 1:55.

## B. Demo video, 3:00 (screen recording of getcommish.vercel.app, founder's voice)

| Time | Screen | Say |
| --- | --- | --- |
| 0:00 | Landing page, dark theme | This is Commish, live on Solana mainnet at getcommish dot vercel dot app. I'll create a campaign as a brand, record a sale, and collect it as a creator. |
| 0:12 | Scroll the commission card animation | Here's one commission: a 250 dollar order at ten percent, so 25 USDC is held until the refund window closes. |
| 0:25 | Click Connect wallet, pick Phantom | I connect a wallet. The site never holds a key; every transaction is signed here. |
| 0:35 | Brand console, New campaign: rate 10%, window 7 days, attestor = my wallet | As a brand, I set the rate, the refund window and who records sales. |
| 0:50 | Approve in wallet, then the Explorer link | One transaction creates the campaign and its USDC vault. Here it is on Solana Explorer. |
| 1:02 | Deposit 50 USDC | I fund the vault with 50 USDC. |
| 1:12 | Record sale: order id, total 250, creator wallet | When a referred order is paid, the brand records it. The program computes the cut itself: 25 USDC, now reserved. |
| 1:30 | Withdraw: try 50, see only 25 allowed | The brand tries to take everything back. It can only withdraw what isn't reserved. The creator's 25 stays locked. |
| 1:45 | Open the public campaign page | Anyone can see the budget and every open commission, so a creator can check a brand before promoting it. |
| 1:57 | Switch wallet, Creator desk | Now I'm the creator. My desk shows every commission I'm owed, and when each one is due. |
| 2:10 | Early payout panel, price 24.25 | If I need the money now, I can sell this commission to a buyer for 24.25 today. The buyer collects 24.75 at release, after the 1% protocol fee. |
| 2:25 | Release on a due commission (0-day window campaign) | When the window closes, release needs no signer. One click, and the USDC lands in my wallet. |
| 2:40 | Language switcher: Bahasa Indonesia, 中文; theme toggle | It works in four languages, in light and dark, on a phone. |
| 2:50 | Landing page | Commissions that pay themselves. Commish. |

Record it on mainnet with small amounts (1 to 5 USDC works the same way;
say the real numbers you use). For the release shot, use a campaign with a
0-day refund window so the commission is due at once.

---


Three videos. Colosseum requires the first two; the third is for the weekly
progress posts on X.

| Video | Length | Shape | Who is on screen | Edited with |
| --- | --- | --- | --- | --- |
| Pitch | 2:45 | 16:9 | Founder on camera for about 45 s, the deck for the rest | splicecraft, level 35 |
| Technical walkthrough | 2:55 | 16:9 | Screen recording with the founder's voice | splicecraft, level 25 |
| Weekly update | 0:45 | 9:16 | Founder on camera | splicecraft, level 60 |

Every number below comes from the deck or from `research/commish-sources.md`;
the source id is in brackets and is not spoken. The two founder lines (2:21 in the pitch, 0:31 in the update) are drafted from
the founder's CV, LinkedIn and GitHub; read them once and change anything that
is not right. **[after deploy]** marks a
shot that needs the program live on mainnet.

At 150 words a minute, the pitch runs about 2:45 and the walkthrough about 2:55. Read
each one aloud once and cut any sentence you trip on.

---

## 1. Pitch video (2:45)

Colosseum lists six things judges look for: the team, the product, why you
started, the market, how you reach first users, and how it works. The founder's
face carries the opening, the "why" and the close. The deck carries the rest.

| Time | Visual | Audio |
| --- | --- | --- |
| 0:00 | Founder on camera, chest up | Amazon pays its affiliates about sixty days after the month closes. [S1] Until then, what a creator earned is a line in the brand's spreadsheet. I'm Bryan, and Commish puts that money on Solana the moment the sale is recorded. |
| 0:14 | Slide 2, then slide 3 | A sale on January second becomes money around the end of March. And brands have a reason to wait. About nineteen percent of US online sales were expected to come back in 2025. [S2] Nobody wants to pay commission on a refund. So the hold is fair. What's missing is a guarantee. During the hold, the money is still the brand's to spend. |
| 0:38 | Slide 4 | Commish changes one thing. The brand funds a campaign vault in USDC. When a referred order is paid, the brand's server records it, and the program sets the creator's cut aside in its own account. From then on the brand can withdraw everything except what it owes. |
| 0:56 | Screen: the commission card on the landing page, clicked through | Here's one commission. A two-hundred-fifty-dollar order at ten percent, so twenty-five dollars is reserved. If the order is refunded inside the window, the commission is cancelled and the budget comes back. Once the window closes, anyone can release it, and the money can only land in the payee's own USDC account. If this website went offline tomorrow, creators could still collect. |
| 1:24 | Slide 6 | A creator who can't wait can sell the commission. Here they get twenty-four twenty-five today. The buyer becomes the payee, collects the full twenty-five at release, and takes on the refund risk. It settles in one transaction. |
| 1:38 | Slide 7 | It's one Solana program, written with Pinocchio. 9,296 bytes, small enough to deploy to mainnet for under 0.05 SOL. Every rule is checked on-chain, and 26 tests attack those rules against the compiled program. |
| 1:53 | Slide 8 | At least eight Solana affiliate projects entered earlier Colosseum hackathons. None placed. [S7] Three of them promised instant payouts, and no brand accepts that while one online order in five comes back. Commish keeps the refund window and guarantees the money inside it. |
| 2:08 | Slide 9 | US brands are forecast to spend about fourteen billion dollars on affiliate marketing this year. [S3] Our plan is a one percent fee on each payout. If one percent of that spend settled here, that's about 1.4 million dollars a year. |
| 2:21 | Founder on camera | I'm a creator too. I've sold my art on Objkt since 2022 and on Drip since 2024, and I earn through Shutterstock and Upwork, so every payout I get runs on someone else's schedule. I study informatics in Makassar, lead the Superteam campus club, and I built Commish's program, app and tests myself. |
| 2:35 | Founder on camera, then slide 11 | Next is the mainnet deploy and a first live campaign, then ten pilots with Solana apps that already pay creators. If you run an affiliate program, try it at getcommish dot vercel dot app. |

---

## 2. Technical walkthrough (2:55)

Colosseum asks for the how here: stack decisions, why Solana, the on-chain
logic. It does not repeat the pitch.

| Time | Visual | Audio |
| --- | --- | --- |
| 0:00 | Terminal: `npm test` in `program/`, 26 passing, compute-unit table | This is Commish's test suite: 26 tests running against the compiled Solana program. Most of them are attacks that have to fail. Here's what they protect. |
| 0:10 | `program/src/lib.rs`, the account structs | There's one program, written with Pinocchio instead of Anchor. It has three kinds of account. A campaign, 176 bytes, holds the brand, the attestor key, the rate and the refund window. Its vault is a USDC token account owned by the campaign address. Each recorded sale gets its own commission account, 184 bytes, at an address derived from a hash of the order. |
| 0:36 | Brand console: create a campaign. **[after deploy]** the transaction on Solana Explorer | A brand creates a campaign here: the rate, the refund window, and who records sales. That's create_campaign, about fifteen thousand compute units including the vault. Then it deposits USDC. |
| 1:00 | Brand console: record a sale; the commission appears in the list | When an order is paid, the attestor signs record_sale with the order hash, the order total and the creator's wallet. The program computes the cut itself, and refuses the sale if the unreserved budget can't cover it. The order id never goes on-chain in clear. The address comes from SHA-256 of the campaign and the order id, so recording the same order twice fails. |
| 1:30 | Test output: "the brand can take back only what is not reserved" | Now the brand tries to take everything back. It can't. Withdraw only moves the vault balance minus what's reserved. Inside the window, the attestor can cancel a refunded order, and the reservation returns to the budget. |
| 1:55 | Creator desk: release a due commission | After the window, release needs no signer. The program checks that the destination token account belongs to the payee and holds the campaign's mint, pays it with the campaign address as signer, and closes the commission account. The rent goes back to whoever paid it. |
| 2:20 | Test output: "a creator sells a pending commission and the buyer collects at release" | Early payout is one instruction, sell. The payee and a buyer both sign. The buyer pays in the campaign's token, never more than the commission is worth, and becomes the payee. |
| 2:38 | README: program size and deploy cost table | Why Solana: a base fee of 5,000 lamports per signature makes one account per order affordable [S6], and USDC is native here. The program is 9,296 bytes, so it deploys for under 0.05 SOL. The code and docs are at github dot com slash bryankwandou slash commish. |

---

## 3. Weekly update, week 1 (0:45, vertical)

For X and the Colosseum weekly update. Shot on a phone, held vertically.

| Time | Audio |
| --- | --- |
| 0:00 | I cut a Solana program from 25,664 bytes to 9,296, so it deploys to mainnet for under 0.05 SOL. |
| 0:06 | It's Commish. It holds an affiliate commission in USDC until the shop's refund window closes. Then anyone can pay it out. |
| 0:14 | How I cut it: I rebuilt Rust's core library with panics stripped, read accounts in place instead of copying them, and let the client pass the address bumps and rent. |
| 0:26 | The deploy cost went from about 0.13 SOL to 0.049. |
| 0:31 | Next week: the program goes live on mainnet, and I record the first real campaign. |
| 0:38 | The code is open. Link's in the post. |

The first build size (25,664 bytes) and the deploy costs are our own
measurements: rent on mainnet is (bytes + 128) × 5,080 lamports, read from
`getMinimumBalanceForRentExemption` on 2026-09-27.

---

## Recording guide

Record, then send the files. splicecraft cuts the pauses and stumbles, so keep
the camera rolling and just say a line again when you trip.

**Camera.** A phone is enough. Put it at eye level, about an arm's length away.
Landscape 1920×1080 at 30 fps for the pitch; vertical for the weekly update.
Face a window; never sit with the window behind you.

**Sound.** Sound matters more than picture. Use a quiet room with soft things
in it (a bed, curtains). Keep the phone or a clip-on mic about 30 cm from your
mouth. Record five seconds of silence at the start of each take.

**Screen.** For the walkthrough, record the browser at 1920×1080 with bookmarks hidden
and the zoom at 110%. Record your voice at the same time or separately; either
works.

**Takes.** One file per row of the script is easiest to fix later. Name them in
order: `pitch-01.mp4`, `pitch-02.mp4`, `walkthrough-01.mp4`, `update-01.mp4`.

**Editing, once the files are here:**

```bash
SC="python ~/.claude/skills/splicecraft/scripts/splicecraft.py"
# Pitch: light edit, 16:9, Commish colors
$SC auto pitch.mp4 -d work-pitch --level 35 --genre auto --size 1920x1080 --brand docs/video/brand.json --language en
# Technical walkthrough: captions and clean audio only
$SC auto walkthrough.mp4 -d work-walkthrough --level 25 --genre tutorial_docs --size 1920x1080 --brand docs/video/brand.json --language en
# Weekly update: vertical short
$SC auto update-01.mp4 -d work-update --level 60 --genre auto --size 1080x1920 --brand docs/video/brand.json --language en
```

Colosseum's own advice is that a clear story beats heavy editing, which is why
the pitch and the walkthrough sit at levels 35 and 25.
