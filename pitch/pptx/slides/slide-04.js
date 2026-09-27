const pptxgen = require("pptxgenjs");
const { F, M, C, base, badge, source, card } = require("./lib.js");

const slideConfig = {"type": "content", "index": 4, "title": "Each sale reserves the creator's cut where the brand can't spend it."};
const NOTES = "Here's what changes. A brand funds a campaign vault in USDC. When a referred order is paid, the brand's server records it, and the program sets aside the creator's cut in its own account. From then on the brand can withdraw everything except what it owes. A refund inside the window cancels the commission.";

// MUST stay synchronous: compile.js does not await.
function createSlide(pres, theme) {
  const slide = base(pres, theme, { n: 4, eyebrow: "Product", headline: slideConfig.title });
  slide.addImage({ path: __dirname + "/imgs/commission-held.png", x: 0.6, y: 1.95, w: 3.43, h: 3.0 });
  const points = [
    ["RESERVED", C.held, "The cut sits in its own account. Withdrawals stop at the reserved amount."],
    ["THEN", theme.accent, "A refund inside the window cancels it. After the window it can only be paid."],
  ];
  points.forEach(([label, color, text], i) => {
    const y = 2.2 + i * 1.3;
    slide.addText(label, { x: 4.6, y, w: 4.5, h: 0.28, margin: 0, fontSize: 10, fontFace: M, bold: true, charSpacing: 1, color });
    slide.addText(text, { x: 4.6, y: y + 0.32, w: 4.5, h: 0.75, margin: 0, valign: "top", fontSize: 15, fontFace: F, color: theme.primary });
  });
  source(slide, "The commission card on getcommish.vercel.app, held inside the refund window");
  slide.addNotes(NOTES);
  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  createSlide(pres, { primary: "F4F4F5", secondary: "A1A1AA", accent: "3DDC97", light: "27272A", bg: "0B0B0E" });
  pres.writeFile({ fileName: "slide-04-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
