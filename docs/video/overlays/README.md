# Overlay pack for the 2:00 pitch video (script A)

Every PNG is 1920x1080 with a transparent background, except `99-end-card.png`
(full frame, opaque). Drop the talking-head clip on track 1, each PNG on track 2
at the time below, and give each card a 6-frame fade in and out. Cards sit on
the right third, so frame yourself on the left third of the shot.

| In | Out | File | On screen while you say |
| --- | --- | --- | --- |
| 0:00 | 2:00 | `00-logo-bug.png` | whole video, top right, 80% opacity |
| 0:01 | 0:05 | `01-lower-third.png` | "Hi, I'm Bryan, from Makassar" |
| 0:05 | 0:12 | `02-sixty-days.png` | "about sixty days after the month closes" |
| 0:12 | 0:20 | `03-spreadsheet.png` | "a line in the brand's spreadsheet" |
| 0:20 | 0:28 | `04-returns.png` | "about one in five online orders comes back" |
| 0:28 | 0:33 | `05-guarantee.png` | "The hold is fair. What's missing is a guarantee." |
| 0:33 | 0:44 | `06-flow.png` | "The brand funds a USDC vault ... locked in its own account" |
| 0:44 | 0:52 | `07-release-rule.png` | "anyone can release it ... only to the creator" |
| 0:52 | 1:02 | `08-early-payout.png` | "sell the pending commission today" |
| 1:02 | 1:14 | `09-mainnet.png` | "It's live on mainnet. One Pinocchio program" |
| 1:14 | 1:38 | `10-creator.png` | "Why me? I'm a creator." |
| 1:38 | 1:50 | `11-eight-tried.png` | "At least eight Solana affiliate projects" |
| 1:50 | 1:55 | `12-next.png` | "a first live campaign and ten pilots" |
| 1:55 | 2:00 | `99-end-card.png` | "I'm Bryan, this is Commish." (cut to full frame) |

Spares, for the demo cut or the longer pitch: `13-market.png` (market size),
`14-fee.png` (business model).

Every number on a card comes from `research/commish-sources.md` or from the
program on mainnet. To change a card, edit `build.mjs` and run
`node docs/video/overlays/build.mjs`.
