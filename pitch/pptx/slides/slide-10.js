const pptxgen = require("pptxgenjs");
const { F, M, C, base, badge, source, card } = require("./lib.js");

const slideConfig = {"type": "content", "index": 10, "title": "One founder built the program, app and tests in five days."};
const NOTES = "I'm Bryan Kwandou. I built Commish on my own: the program, the app in four languages and the tests, across five days of public commits. I also publish open-source tools for decks, writing and video editing. The code is the proof, and all of it is on GitHub. The next step is real campaigns.";

// MUST stay synchronous: compile.js does not await.
function createSlide(pres, theme) {
  const slide = base(pres, theme, { n: 10, eyebrow: "Team", headline: slideConfig.title });
  slide.addShape(pres.shapes.OVAL, { x: 0.6, y: 2.05, w: 1.1, h: 1.1, fill: { color: C.panel }, line: { color: theme.accent, width: 1.5 } });
  slide.addText("BK", { x: 0.6, y: 2.05, w: 1.1, h: 1.1, margin: 0, align: "center", valign: "middle", fontSize: 26, fontFace: F, bold: true, color: theme.accent });
  slide.addText("Bryan Kwandou", { x: 1.95, y: 2.2, w: 5, h: 0.45, margin: 0, fontSize: 20, fontFace: F, bold: true, color: theme.primary });
  slide.addText("Founder", { x: 1.95, y: 2.65, w: 5, h: 0.35, margin: 0, fontSize: 13, fontFace: F, color: theme.secondary });
  const proof = [
    ["BUILT", "The Pinocchio program, the four-language app and 26 tests"],
    ["SHIPS", "Open-source tools for builders: Plinth, Lugas, Splicecraft"],
    ["CODE", "github.com/bryankwandou/commish, every commit public"],
  ];
  proof.forEach(([k, v], i) => {
    const y = 3.45 + i * 0.5;
    slide.addText(k, { x: 0.6, y, w: 1.0, h: 0.36, margin: 0, valign: "middle", fontSize: 10, fontFace: M, bold: true, color: theme.accent });
    slide.addText(v, { x: 1.95, y, w: 7.3, h: 0.36, margin: 0, valign: "middle", fontSize: 14, fontFace: F, color: theme.primary });
  });
  slide.addNotes(NOTES);
  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  createSlide(pres, { primary: "F4F4F5", secondary: "A1A1AA", accent: "3DDC97", light: "27272A", bg: "0B0B0E" });
  pres.writeFile({ fileName: "slide-10-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
