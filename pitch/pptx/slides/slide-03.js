const pptxgen = require("pptxgenjs");
const { F, M, C, base, badge, source, card } = require("./lib.js");

const slideConfig = {"type": "content", "index": 3, "title": "Brands hold commissions because one in five online orders comes back."};
const NOTES = "Brands don't wait to be difficult. About nineteen percent of online sales in the US come back [S2], and nobody wants to pay commission on a refund. So the hold is fair. What's missing is a guarantee: during that hold, the money is still the brand's to spend.";

// MUST stay synchronous: compile.js does not await.
function createSlide(pres, theme) {
  const slide = base(pres, theme, { n: 3, eyebrow: "Why brands wait", headline: slideConfig.title });
  slide.addText("19.3%", { x: 0.6, y: 1.95, w: 4.8, h: 1.6, margin: 0, valign: "middle", fontSize: 100, fontFace: F, bold: true, color: theme.accent });
  slide.addText("of US online sales were expected to be returned in 2025", { x: 0.6, y: 3.6, w: 4.9, h: 0.6, margin: 0, valign: "top", fontSize: 14, fontFace: F, color: theme.secondary });
  for (let i = 0; i < 5; i++) {
    const back = i === 4;
    const x = 5.75 + i * 0.72;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.45, w: 0.56, h: 0.56, rectRadius: 0.08, fill: { color: back ? C.held : theme.light } });
    slide.addText(back ? "back" : "kept", { x: x - 0.1, y: 3.08, w: 0.76, h: 0.26, margin: 0, align: "center", fontSize: 10, fontFace: M, color: back ? C.held : theme.secondary });
  }
  slide.addText("Commission paid on a returned order is money the brand does not get back.", { x: 5.75, y: 3.6, w: 3.5, h: 0.6, margin: 0, valign: "top", fontSize: 12, fontFace: F, color: theme.secondary });
  source(slide, "Source: National Retail Federation, 2025 returns report [S2]");
  slide.addNotes(NOTES);
  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  createSlide(pres, { primary: "F4F4F5", secondary: "A1A1AA", accent: "3DDC97", light: "27272A", bg: "0B0B0E" });
  pres.writeFile({ fileName: "slide-03-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
