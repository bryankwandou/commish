const pptxgen = require("pptxgenjs");
const { F, M, C, base, badge, source, card } = require("./lib.js");

const slideConfig = {"type": "cover", "index": 1, "title": "Affiliate commissions that pay themselves, settled in USDC on Solana."};
const NOTES = "I'm Bryan, and this is Commish. When a creator sends a buyer to a shop, the commission they earn is a promise in the brand's spreadsheet. Commish turns it into money locked on Solana the moment the sale is recorded, and paid out in USDC when the refund window closes.";

// MUST stay synchronous: compile.js does not await.
function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };
  slide.addImage({ path: __dirname + "/imgs/mark.png", x: 4.08, y: 1.05, w: 0.5, h: 0.5 });
  slide.addText("commish", { x: 4.68, y: 1.05, w: 1.6, h: 0.5, margin: 0, valign: "middle", fontSize: 22, fontFace: F, bold: true, color: theme.primary });
  slide.addText("Affiliate commissions\nthat pay themselves,\nsettled in USDC on Solana.", { x: 1.0, y: 1.72, w: 8.0, h: 1.6, margin: 0, align: "center", valign: "middle", fit: "shrink", fontSize: 36, fontFace: F, bold: true, color: theme.primary });
  slide.addText("Bryan Kwandou, founder · Colosseum Crypto World's Fair", { x: 1.0, y: 3.42, w: 8.0, h: 0.35, margin: 0, align: "center", fontSize: 13, fontFace: F, color: theme.secondary });
  const chips = [["Recorded", theme.secondary], ["Held", C.held], ["Paid", theme.accent]];
  chips.forEach(([label, color], i) => {
    const x = 3.125 + i * 1.3;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.95, w: 1.15, h: 0.36, rectRadius: 0.18, fill: { color: theme.bg }, line: { color, width: 1 } });
    slide.addText(label, { x, y: 3.95, w: 1.15, h: 0.36, margin: 0, align: "center", valign: "middle", fontSize: 11, fontFace: F, bold: true, color });
  });
  slide.addText("getcommish.vercel.app  ·  github.com/bryankwandou/commish", { x: 1.0, y: 4.95, w: 8.0, h: 0.3, margin: 0, align: "center", fontSize: 10, fontFace: M, color: C.faint });
  slide.addNotes(NOTES);
  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  createSlide(pres, { primary: "F4F4F5", secondary: "A1A1AA", accent: "3DDC97", light: "27272A", bg: "0B0B0E" });
  pres.writeFile({ fileName: "slide-01-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
