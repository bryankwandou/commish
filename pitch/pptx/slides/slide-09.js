const pptxgen = require("pptxgenjs");
const { F, M, C, base, badge, source, card } = require("./lib.js");

const slideConfig = {"type": "content", "index": 9, "title": "US brands will spend $13.81 billion on affiliate marketing in 2026."};
const NOTES = "US affiliate spend alone is forecast at about fourteen billion dollars this year [S3], and Goldman Sachs counts fifty million creators worldwide [S4]. Our own plan is a one percent fee on each payout. If one percent of US affiliate spend settled through Commish, that's about 1.4 million dollars a year. Dollar stablecoins have had a US law behind them since July 2025 [S5].";

// MUST stay synchronous: compile.js does not await.
function createSlide(pres, theme) {
  const slide = base(pres, theme, { n: 9, eyebrow: "Market", headline: slideConfig.title });
  slide.addText("$13.81B", { x: 0.6, y: 1.85, w: 6.0, h: 1.5, margin: 0, valign: "middle", fontSize: 84, fontFace: F, bold: true, color: theme.accent });
  const chips = [["$13.81B", "US affiliate spend"], ["1%", "settled on Commish"], ["1%", "fee on each payout"], ["$1.38M", "a year"]];
  chips.forEach(([v, k], i) => {
    const x = 0.6 + i * 2.2;
    const last = i === chips.length - 1;
    card(pres, slide, theme, { x, y: 3.65, w: 1.8, h: 0.95 }, last ? theme.accent : null);
    slide.addText(v, { x: x + 0.15, y: 3.73, w: 1.55, h: 0.45, margin: 0, fontSize: 20, fontFace: F, bold: true, color: last ? theme.accent : theme.primary });
    slide.addText(k, { x: x + 0.15, y: 4.18, w: 1.6, h: 0.3, margin: 0, fontSize: 10, fontFace: F, color: theme.secondary });
    if (!last) slide.addText(i === 2 ? "=" : "×", { x: x + 1.8, y: 3.9, w: 0.4, h: 0.45, margin: 0, align: "center", valign: "middle", fontSize: 18, fontFace: F, color: theme.secondary });
  });
  source(slide, "Source: eMarketer forecast via Post Affiliate Pro [S3]. Share and fee are team plan, not outside data.");
  slide.addNotes(NOTES);
  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  createSlide(pres, { primary: "F4F4F5", secondary: "A1A1AA", accent: "3DDC97", light: "27272A", bg: "0B0B0E" });
  pres.writeFile({ fileName: "slide-09-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
