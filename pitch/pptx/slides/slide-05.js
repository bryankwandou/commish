const pptxgen = require("pptxgenjs");
const { F, M, C, base, badge, source, card } = require("./lib.js");

const slideConfig = {"type": "content", "index": 5, "title": "Affiliates pick programs that pay reliably. Commish makes that provable."};
const NOTES = "Why would a brand lock its own money? Because affiliates choose programs by whether they get paid. In a PerformanceIN survey of 3,200 affiliates in crypto, forex and gambling, 73 percent said payout reliability was their main reason to switch programs [S8]. A Commish campaign shows its reserved and paid totals on-chain, so a brand can prove it pays before a creator signs up.";

// MUST stay synchronous: compile.js does not await.
function createSlide(pres, theme) {
  const slide = base(pres, theme, { n: 5, eyebrow: "Why brands opt in", headline: slideConfig.title });
  slide.addText("73%", { x: 0.6, y: 1.95, w: 4.8, h: 1.6, margin: 0, valign: "middle", fontSize: 100, fontFace: F, bold: true, color: theme.accent });
  slide.addText("of affiliates in crypto, forex and gambling programs switch mainly over payout reliability", { x: 0.6, y: 3.6, w: 4.9, h: 0.6, margin: 0, valign: "top", fontSize: 14, fontFace: F, color: theme.secondary });
  slide.addText("On-chain reserved and paid totals let a brand prove it pays.", { x: 5.75, y: 2.45, w: 3.6, h: 1.2, margin: 0, valign: "top", fontSize: 18, fontFace: F, color: theme.secondary });
  source(slide, "Source: PerformanceIN 2025 survey of 3,200 affiliates, via TheFinRate [S8]");
  slide.addNotes(NOTES);
  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  createSlide(pres, { primary: "F4F4F5", secondary: "A1A1AA", accent: "3DDC97", light: "27272A", bg: "0B0B0E" });
  pres.writeFile({ fileName: "slide-05-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
