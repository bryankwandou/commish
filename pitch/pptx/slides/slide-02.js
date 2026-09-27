const pptxgen = require("pptxgenjs");
const { F, M, C, base, badge, source, card } = require("./lib.js");

const slideConfig = {"type": "content", "index": 2, "title": "Amazon pays its affiliates about 60 days after the month closes."};
const NOTES = "Take the biggest affiliate program there is. Amazon pays commission about sixty days after the end of the month it was earned [S1]. A sale on January 2nd becomes money around the end of March. And until the brand pays, the creator has nothing but the brand's word that it will.";

// MUST stay synchronous: compile.js does not await.
function createSlide(pres, theme) {
  const slide = base(pres, theme, { n: 2, eyebrow: "Problem", headline: slideConfig.title });
  slide.addText("60 days", { x: 0.6, y: 2.0, w: 5.2, h: 1.7, margin: 0, valign: "middle", fontSize: 100, fontFace: F, bold: true, color: theme.accent });
  slide.addShape(pres.shapes.LINE, { x: 6.55, y: 2.2, w: 0, h: 2.2, line: { color: theme.light, width: 2 } });
  const steps = [["Jan 2", "Sale made", false], ["Jan 31", "Month closes", false], ["+60 days", "Commission paid", true]];
  steps.forEach(([when, what, hi], i) => {
    const y = 2.05 + i * 1.08;
    slide.addShape(pres.shapes.OVAL, { x: 6.44, y: y + 0.08, w: 0.22, h: 0.22, fill: { color: hi ? theme.accent : theme.bg }, line: { color: hi ? theme.accent : theme.secondary, width: 1.5 } });
    slide.addText(when, { x: 6.9, y, w: 2.5, h: 0.36, margin: 0, fontSize: 16, fontFace: F, bold: true, color: hi ? theme.accent : theme.primary });
    slide.addText(what, { x: 6.9, y: y + 0.36, w: 2.5, h: 0.3, margin: 0, fontSize: 12, fontFace: F, color: theme.secondary });
  });
  source(slide, "Source: Amazon Associates Central, payment help page [S1]");
  slide.addNotes(NOTES);
  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  createSlide(pres, { primary: "F4F4F5", secondary: "A1A1AA", accent: "3DDC97", light: "27272A", bg: "0B0B0E" });
  pres.writeFile({ fileName: "slide-02-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
