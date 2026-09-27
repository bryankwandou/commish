const pptxgen = require("pptxgenjs");
const { F, M, C, base, badge, source, card } = require("./lib.js");

const slideConfig = {"type": "content", "index": 7, "title": "A creator who can't wait sells the commission for cash today."};
const NOTES = "A pending commission is money owed on a known date, so it can be sold. Here the creator sells a twenty-five dollar commission for 24.25 and is paid right away. The buyer becomes the payee, collects the full amount at release, and takes over the refund risk. It all settles in one transaction.";

// MUST stay synchronous: compile.js does not await.
function createSlide(pres, theme) {
  const slide = base(pres, theme, { n: 7, eyebrow: "Early payout", headline: slideConfig.title });
  const rows = [["Creator, paid today", "24.25 USDC", 0.97, theme.accent], ["Buyer, paid at release", "25.00 USDC", 1.0, C.bar]];
  rows.forEach(([label, value, frac, color], i) => {
    const y = 2.45 + i * 0.8;
    slide.addText(label, { x: 0.6, y, w: 2.3, h: 0.42, margin: 0, valign: "middle", fontSize: 14, fontFace: F, color: theme.primary });
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 2.95, y: y + 0.03, w: 5.0, h: 0.36, rectRadius: 0.05, fill: { color: C.panel } });
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 2.95, y: y + 0.03, w: 5.0 * frac, h: 0.36, rectRadius: 0.05, fill: { color } });
    slide.addText(value, { x: 8.1, y, w: 1.4, h: 0.42, margin: 0, valign: "middle", fontSize: 14, fontFace: M, bold: true, color: theme.primary });
  });
  slide.addText("The buyer becomes the payee and carries the refund risk.", { x: 2.95, y: 4.2, w: 6.0, h: 0.35, margin: 0, fontSize: 12, fontFace: F, color: theme.secondary });
  source(slide, "Example: a 25.00 USDC commission sold at a 3% discount. Illustration, not outside data.");
  slide.addNotes(NOTES);
  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  createSlide(pres, { primary: "F4F4F5", secondary: "A1A1AA", accent: "3DDC97", light: "27272A", bg: "0B0B0E" });
  pres.writeFile({ fileName: "slide-07-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
