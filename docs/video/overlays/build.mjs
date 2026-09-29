// Renders the overlay pack: 1920x1080 PNGs with transparent backgrounds.
// Run: node docs/video/overlays/build.mjs (needs a Chromium binary in CHROME).
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const mark = readFileSync(join(here, "../../images/mark.svg"), "utf8").replace(/width="32" height="32"/, 'width="100%" height="100%"');

const css = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;background:transparent;overflow:hidden;
 font-family:Inter,"Helvetica Neue",Arial,sans-serif;color:#F4F4F5;-webkit-font-smoothing:antialiased}
.card{position:absolute;background:rgba(20,20,23,.92);border:1px solid rgba(255,255,255,.10);
 border-radius:28px;box-shadow:0 30px 80px rgba(0,0,0,.45);padding:44px 52px}
.k{font-size:22px;letter-spacing:.14em;text-transform:uppercase;color:#A1A1AA;font-weight:600}
.big{font-size:140px;font-weight:800;letter-spacing:-.04em;line-height:1}
.grad{background:linear-gradient(100deg,#F5B544,#9EE06B 55%,#3DDC97);-webkit-background-clip:text;color:transparent}
.t{font-size:40px;font-weight:600;line-height:1.25;letter-spacing:-.01em}
.m{font-size:26px;color:#A1A1AA;line-height:1.4}
.src{font-size:18px;color:#71717A;margin-top:22px}
.bar{height:6px;width:120px;border-radius:3px;background:linear-gradient(90deg,#F5B544,#3DDC97);margin-bottom:26px}
.mark{width:84px;height:84px;display:inline-block}
.mono{font-family:"JetBrains Mono",Menlo,monospace}
.pill{display:inline-block;padding:10px 20px;border-radius:999px;background:rgba(61,220,151,.14);color:#3DDC97;font-size:24px;font-weight:600}
.row{display:flex;align-items:center;gap:28px}
.node{background:#1C1C21;border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:28px 34px;min-width:300px}
.arrow{font-size:54px;color:#3DDC97;font-weight:300}
`;
const R = "right:96px;bottom:120px;width:720px"; // default card slot: right side, clear of the face
const scenes = {
  "00-logo-bug": `<div style="position:absolute;right:56px;top:48px" class="row"><div class="mark" style="width:64px;height:64px">${mark}</div><div style="font-size:34px;font-weight:700;letter-spacing:-.02em">Commish</div></div>`,
  "01-lower-third": `<div class="card" style="left:96px;bottom:110px;padding:34px 46px"><div class="row"><div class="mark">${mark}</div><div><div style="font-size:48px;font-weight:700;letter-spacing:-.02em">Bryan Kwandou</div><div class="m" style="font-size:28px">Founder, Commish · Makassar, Indonesia</div></div></div></div>`,
  "02-sixty-days": `<div class="card" style="${R}"><div class="bar"></div><div class="k">Amazon Associates payout</div><div class="big grad" style="margin:18px 0">~60 days</div><div class="t">after the month closes</div><div class="src">Source: Amazon Associates Program Operating Agreement</div></div>`,
  "03-spreadsheet": `<div class="card" style="${R}"><div class="bar"></div><div class="k">Until payout</div><div class="t" style="margin-top:18px;font-size:46px">A commission is a line in the brand's spreadsheet.</div><div class="m" style="margin-top:22px">Terms can change. Payment can be late. Or never come.</div></div>`,
  "04-returns": `<div class="card" style="${R}"><div class="bar"></div><div class="k">US online sales returned, 2025</div><div class="big grad" style="margin:18px 0">19.3%</div><div class="t">About 1 in 5 orders comes back</div><div class="src">Source: NRF and Happy Returns, 2025</div></div>`,
  "05-guarantee": `<div class="card" style="${R}"><div class="bar"></div><div class="t" style="font-size:52px">The hold is fair.</div><div class="t grad" style="font-size:52px;margin-top:8px">A guarantee is missing.</div></div>`,
  "06-flow": `<div class="card" style="left:50%;transform:translateX(-50%);bottom:110px;padding:40px 48px"><div class="k" style="margin-bottom:26px">How Commish works on Solana</div><div class="row">
   <div class="node"><div class="k">Brand</div><div class="t">USDC vault</div></div><div class="arrow">→</div>
   <div class="node" style="border-color:rgba(245,181,68,.5)"><div class="k">Sale recorded</div><div class="t">Commission locked</div></div><div class="arrow">→</div>
   <div class="node" style="border-color:rgba(61,220,151,.6)"><div class="k">Window closes</div><div class="t">Paid to creator</div></div></div></div>`,
  "07-release-rule": `<div class="card" style="${R}"><div class="bar"></div><div class="k">Enforced by the program</div><div class="t" style="margin-top:20px">The brand cannot take it back.</div><div class="t" style="margin-top:12px">Anyone can release it.</div><div class="t grad" style="margin-top:12px">It only goes to the creator.</div></div>`,
  "08-early-payout": `<div class="card" style="${R}"><div class="bar"></div><div class="k">Early payout, one transaction</div><div class="row" style="margin-top:24px;gap:22px"><div><div class="m">Creator gets today</div><div style="font-size:84px;font-weight:800" class="grad">24.25</div></div><div class="arrow">→</div><div><div class="m">Buyer collects at release</div><div style="font-size:84px;font-weight:800">24.75</div></div></div><div class="m" style="margin-top:14px">USDC, on a 25.00 commission. 1% protocol fee.</div></div>`,
  "09-mainnet": `<div class="card" style="${R}"><div class="bar"></div><span class="pill">Live on Solana mainnet</span><div class="mono" style="font-size:21px;margin-top:24px;color:#D4D4D8;white-space:nowrap">CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB</div>
   <div class="row" style="margin-top:30px;gap:44px"><div><div style="font-size:60px;font-weight:800" class="grad">9,296</div><div class="m">bytes, Pinocchio</div></div><div><div style="font-size:60px;font-weight:800">0.049</div><div class="m">SOL to deploy</div></div><div><div style="font-size:60px;font-weight:800">28</div><div class="m">attack tests</div></div></div></div>`,
  "10-creator": `<div class="card" style="${R}"><div class="bar"></div><div class="k">A creator building for creators</div><div style="margin-top:22px;display:grid;grid-template-columns:1fr 1fr;gap:18px 30px">
   <div><div class="t">Objkt</div><div class="m">since 2022</div></div><div><div class="t">Drip</div><div class="m">since 2024</div></div><div><div class="t">Shutterstock</div><div class="m">licensing</div></div><div><div class="t">Upwork</div><div class="m">client work</div></div></div>
   <div class="m" style="margin-top:24px">Informatics student · Superteam campus club lead</div></div>`,
  "11-eight-tried": `<div class="card" style="${R}"><div class="bar"></div><div class="k">Solana affiliate projects in past hackathons</div><div class="row" style="margin-top:18px;gap:40px"><div><div class="big grad">8</div><div class="m">tried</div></div><div><div class="big">0</div><div class="m">placed</div></div></div><div class="t" style="margin-top:22px;font-size:34px">Instant payouts ignore refunds. Commish keeps the window.</div></div>`,
  "12-next": `<div class="card" style="${R}"><div class="bar"></div><div class="k">Next</div><div class="t" style="margin-top:20px">1. First live campaign</div><div class="t" style="margin-top:12px">2. Ten pilots with Solana apps that already pay creators</div></div>`,
  "13-market": `<div class="card" style="${R}"><div class="bar"></div><div class="k">US affiliate marketing spend, 2026</div><div class="big grad" style="margin:18px 0">$13.81B</div><div class="t">1% settled here at a 1% fee: ~$1.4M a year</div><div class="src">Source: eMarketer forecast</div></div>`,
  "14-fee": `<div class="card" style="${R}"><div class="bar"></div><div class="k">Business model</div><div class="big grad" style="margin:18px 0">1%</div><div class="t">taken from each commission at release</div></div>`,
  "99-end-card": `<div style="position:absolute;inset:0;background:#0B0B0E;display:flex;flex-direction:column;align-items:center;justify-content:center">
   <div style="width:180px;height:180px">${mark}</div><div style="font-size:120px;font-weight:800;letter-spacing:-.04em;margin-top:30px">Commish</div>
   <div class="t" style="color:#A1A1AA;font-weight:500;margin-top:10px">Commissions that pay themselves.</div>
   <div class="grad" style="font-size:44px;font-weight:700;margin-top:56px">getcommish.vercel.app</div><div class="m mono" style="margin-top:14px">github.com/bryankwandou/commish</div></div>`,
};
mkdirSync(join(here, "src"), { recursive: true });
for (const [name, body] of Object.entries(scenes)) {
  const html = join(here, "src", `${name}.html`);
  writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`);
  execFileSync(CHROME, ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
    "--window-size=1920,1080", `--screenshot=${join(here, name + ".png")}`, `file://${html}`], { stdio: "ignore" });
  console.log(name);
}
