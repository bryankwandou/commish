const pptxgen = require("pptxgenjs");
const { F, M, C, base, badge, source, card } = require("./lib.js");

const slideConfig = {"type": "summary", "index": 11, "title": "Next: ten Solana brands run their creator payouts through Commish."};
const NOTES = "Here's the plan. The program and the app are done. Next is the mainnet deploy and a first live campaign, then ten pilots with Solana apps that already pay creators and hold USDC. After that, an audit and a Shopify integration through order webhooks. If you run an affiliate program, try it at getcommish.vercel.app.";

// MUST stay synchronous: compile.js does not await.
function createSlide(pres, theme) {
  const slide = base(pres, theme, { n: 11, eyebrow: "Next", headline: slideConfig.title });
  slide.addShape(pres.shapes.LINE, { x: 0.6, y: 2.45, w: 8.8, h: 0, line: { color: theme.light, width: 2 } });
  const steps = [["Sep 2026", "Program and app built, 26 tests pass", true], ["Oct 2026", "Mainnet deploy and the first live campaign", false], ["Q4 2026", "Ten pilots with Solana apps that already pay creators", false], ["2027", "Audit, then a Shopify integration through order webhooks", false]];
  steps.forEach(([when, what, hi], i) => {
    const x = 0.6 + i * 2.25;
    slide.addShape(pres.shapes.OVAL, { x, y: 2.34, w: 0.22, h: 0.22, fill: { color: hi ? theme.accent : theme.bg }, line: { color: hi ? theme.accent : theme.secondary, width: 1.5 } });
    slide.addText(when, { x, y: 2.75, w: 2.0, h: 0.4, margin: 0, fontSize: 17, fontFace: F, bold: true, color: hi ? theme.accent : theme.primary });
    slide.addText(what, { x, y: 3.18, w: 1.95, h: 0.9, margin: 0, valign: "top", fontSize: 11, fontFace: F, color: theme.secondary });
  });
  slide.addText("getcommish.vercel.app", { x: 0.6, y: 4.45, w: 5, h: 0.4, margin: 0, fontSize: 16, fontFace: M, bold: true, color: theme.accent });
  source(slide, "Source: team plan, not outside data");
  slide.addNotes(NOTES);
  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  createSlide(pres, { primary: "F4F4F5", secondary: "A1A1AA", accent: "3DDC97", light: "27272A", bg: "0B0B0E" });
  pres.writeFile({ fileName: "slide-11-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
