const pptxgen = require("pptxgenjs");
const { F, M, C, base, badge, source, card } = require("./lib.js");

const slideConfig = {"type": "content", "index": 6, "title": "Record the sale, hold it through the window, then release."};
const NOTES = "Three steps. The attestor records the sale, and the program computes the cut, not the caller. The commission sits through the refund window. Then anyone can release it, the creator or a bot, and the money can only land in the payee's own USDC account. If this website went offline tomorrow, creators could still collect.";

// MUST stay synchronous: compile.js does not await.
function createSlide(pres, theme) {
  const slide = base(pres, theme, { n: 6, eyebrow: "In use", headline: slideConfig.title });
  const steps = [
    ["01", "Record", theme.primary, "The brand's server signs it. The program sets the cut from the campaign rate.", null],
    ["02", "Hold", C.held, "A refund inside the window cancels it.", null],
    ["03", "Release", theme.accent, "Anyone can trigger it. USDC goes only to the payee.", theme.accent],
  ];
  steps.forEach(([num, title, color, text, edge], i) => {
    const x = 0.6 + i * 3.0;
    card(pres, slide, theme, { x, y: 2.15, w: 2.6, h: 2.25 }, edge);
    slide.addText(num, { x: x + 0.25, y: 2.35, w: 1.0, h: 0.28, margin: 0, fontSize: 10, fontFace: M, color: theme.secondary });
    slide.addText(title, { x: x + 0.25, y: 2.7, w: 2.1, h: 0.42, margin: 0, fontSize: 20, fontFace: F, bold: true, color });
    slide.addText(text, { x: x + 0.25, y: 3.2, w: 2.15, h: 1.05, margin: 0, valign: "top", fontSize: 12, fontFace: F, color: theme.secondary });
    if (i < 2) slide.addText("→", { x: x + 2.6, y: 3.0, w: 0.4, h: 0.5, margin: 0, align: "center", valign: "middle", fontSize: 20, fontFace: F, color: theme.secondary });
  });
  slide.addText("record_sale  ·  cancel  ·  release", { x: 0.6, y: 4.6, w: 8.4, h: 0.3, margin: 0, fontSize: 10, fontFace: M, color: C.faint });
  slide.addNotes(NOTES);
  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  createSlide(pres, { primary: "F4F4F5", secondary: "A1A1AA", accent: "3DDC97", light: "27272A", bg: "0B0B0E" });
  pres.writeFile({ fileName: "slide-06-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
