const pptxgen = require("pptxgenjs");
const { F, M, C, base, badge, source, card } = require("./lib.js");

const slideConfig = {"type": "content", "index": 8, "title": "One 9,296-byte program enforces the rules, and 26 tests attack them."};
const NOTES = "All of it is one Solana program written with Pinocchio: 9,296 bytes, small enough that deploying it to mainnet costs under 0.05 SOL. Each rule here is checked on-chain, and the test suite has an attack for each one that has to fail. A transaction's base fee is 5,000 lamports per signature [S6], cheap enough to run for every order.";

// MUST stay synchronous: compile.js does not await.
function createSlide(pres, theme) {
  const slide = base(pres, theme, { n: 8, eyebrow: "How it works", headline: slideConfig.title });
  const line = () => ({ type: "solid", pt: 1, color: theme.light });
  const none = () => ({ type: "none" });
  const cell = (text, opts) => ({ text, options: { fontFace: F, fontSize: 12, color: theme.primary, valign: "middle", border: [none(), none(), line(), none()], margin: [0.06, 0.1, 0.06, 0], ...opts } });
  const head = (text) => cell(text, { fontSize: 9, bold: true, color: theme.secondary, charSpacing: 1 });
  const rows = [
    [head("RULE"), head("ON-CHAIN CHECK")],
    [cell("Owed money stays locked"), cell("Withdrawals stop at the reserved amount")],
    [cell("One order, one commission"), cell("Address derived from the order hash")],
    [cell("Payouts can't be redirected", { color: theme.accent, bold: true }), cell("Destination must belong to the payee", { color: theme.accent, bold: true })],
  ];
  slide.addTable(rows, { x: 0.6, y: 2.05, w: 5.7, colW: [2.4, 3.3], rowH: [0.34, 0.52, 0.52, 0.52] });
  const stats = [["9,296", "bytes, deploy under 0.05 SOL"], ["6", "instructions"], ["26", "tests, most of them attacks"]];
  stats.forEach(([v, k], i) => {
    const y = 2.0 + i * 0.95;
    card(pres, slide, theme, { x: 6.75, y, w: 2.65, h: 0.8 });
    slide.addText(v, { x: 6.95, y: y + 0.06, w: 2.3, h: 0.42, margin: 0, fontSize: 22, fontFace: F, bold: true, color: theme.primary });
    slide.addText(k, { x: 6.95, y: y + 0.46, w: 2.35, h: 0.28, margin: 0, fontSize: 10, fontFace: F, color: theme.secondary });
  });
  source(slide, "Source: program/ in github.com/bryankwandou/commish; base fee [S6]");
  slide.addNotes(NOTES);
  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  createSlide(pres, { primary: "F4F4F5", secondary: "A1A1AA", accent: "3DDC97", light: "27272A", bg: "0B0B0E" });
  pres.writeFile({ fileName: "slide-08-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
