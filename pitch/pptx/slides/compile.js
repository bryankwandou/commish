const pptxgen = require("pptxgenjs");
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "Commish: pitch";
pres.author = "Bryan Kwandou";

// Commish brand mapped onto the skill's theme keys: primary is the title
// color, secondary the body color, light the panel and line color.
const theme = {
  primary: "F4F4F5",
  secondary: "A1A1AA",
  accent: "3DDC97",
  light: "27272A",
  bg: "0B0B0E",
};

for (let i = 1; i <= 12; i++) {
  const num = String(i).padStart(2, "0");
  require(`./slide-${num}.js`).createSlide(pres, theme);
}

pres.writeFile({ fileName: __dirname + "/output/commish-pitch-editable.pptx" }).then((f) => console.log("wrote", f));
