const pptxgen = require("pptxgenjs");
const { F, M, C, base, badge, source, card } = require("./lib.js");

const slideConfig = {"type": "content", "index": 10, "title": "Built by a creator who gets paid on other people's schedules."};
const NOTES = "I'm Bryan Kwandou. I've sold my own art on Objkt since 2022 and on Drip since 2024, and I earn through Shutterstock and Upwork, so every payout I get runs on someone else's schedule. I study informatics in Makassar and lead the Superteam campus club there. I built Commish's program, app and tests myself.";

// MUST stay synchronous: compile.js does not await.
function createSlide(pres, theme) {
  const slide = base(pres, theme, { n: 10, eyebrow: "Team", headline: slideConfig.title });
  slide.addShape(pres.shapes.OVAL, { x: 0.6, y: 2.05, w: 1.1, h: 1.1, fill: { color: C.panel }, line: { color: theme.accent, width: 1.5 } });
  slide.addText("BK", { x: 0.6, y: 2.05, w: 1.1, h: 1.1, margin: 0, align: "center", valign: "middle", fontSize: 26, fontFace: F, bold: true, color: theme.accent });
  slide.addText("Bryan Kwandou", { x: 1.95, y: 2.2, w: 5, h: 0.45, margin: 0, fontSize: 20, fontFace: F, bold: true, color: theme.primary });
  slide.addText("Founder · Makassar, Indonesia", { x: 1.95, y: 2.65, w: 5, h: 0.35, margin: 0, fontSize: 13, fontFace: F, color: theme.secondary });
  const proof = [
    ["CREATOR", "NFT art on Objkt since 2022 and Drip since 2024; Shutterstock, Upwork"],
    ["BUILDER", "Informatics, Atma Jaya Makassar; Superteam campus lead"],
    ["SHIPPED", "The program, the app and 26 tests: github.com/bryankwandou/commish"],
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
