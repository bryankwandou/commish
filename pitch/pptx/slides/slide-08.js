const pptxgen = require("pptxgenjs");
const { F, M, C, base, badge, source, card } = require("./lib.js");

const slideConfig = {"type": "content", "index": 8, "title": "At least eight Solana affiliate projects entered Colosseum before us. None placed."};
const NOTES = "We checked before building. Colosseum's project search turns up eight earlier Solana affiliate or referral projects, and none placed [S7]. Three of them promised instant payouts, which no brand accepts while one online order in five comes back. Commish keeps the refund window brands already use, and guarantees the money inside it.";

// MUST stay synchronous: compile.js does not await.
function createSlide(pres, theme) {
  const slide = base(pres, theme, { n: 8, eyebrow: "Who else", headline: slideConfig.title });
  const line = () => ({ type: "solid", pt: 1, color: theme.light });
  const none = () => ({ type: "none" });
  const cell = (text, opts) => ({ text, options: { fontFace: F, fontSize: 12, color: theme.primary, valign: "middle", border: [none(), none(), line(), none()], margin: [0.04, 0.1, 0.04, 0], ...opts } });
  const head = (text) => cell(text, { fontSize: 9, bold: true, color: theme.secondary, charSpacing: 1 });
  const data = [
    ["SuperLink", "Radar 2024", "Revenue share via Blinks"],
    ["Earnify", "Radar 2024", "Web3 affiliate dashboard"],
    ["Sendit", "Radar 2024", "Marketplace with affiliates"],
    ["Redio", "Cypherpunk 2025", "Instant affiliate payouts"],
    ["Coinfiliate", "Cypherpunk 2025", "USDC rewards to shoppers"],
    ["Three more", "2024-2025", "Blinks Deals, Traxeo, Reflink"],
  ];
  const rows = [[head("PROJECT"), head("HACKATHON"), head("WHAT IT OFFERED"), head("PLACED")]];
  data.forEach(([a, b, c]) => rows.push([cell(a, { bold: true }), cell(b, { color: theme.secondary }), cell(c), cell("No", { color: C.faint })]));
  slide.addTable(rows, { x: 0.6, y: 1.95, w: 8.8, colW: [1.8, 1.9, 4.1, 1.0], rowH: [0.3, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4] });
  source(slide, "Source: Colosseum Copilot API and Arena, 2026-09-27 [S7]");
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
