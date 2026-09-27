// Shared building blocks for the Commish deck. Every option object is built
// fresh per call because PptxGenJS mutates the objects it receives.
const F = "Arial";
const M = "Consolas";
const C = { panel: "141417", faint: "71717A", held: "F5B544", bar: "52525B" };

function base(pres, theme, { n, eyebrow, headline }) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };
  if (eyebrow) {
    slide.addText(eyebrow.toUpperCase(), {
      x: 0.6, y: 0.42, w: 6, h: 0.28, margin: 0,
      fontSize: 10, fontFace: F, bold: true, charSpacing: 2, color: theme.secondary,
    });
  }
  if (headline) {
    slide.addText(headline, {
      x: 0.6, y: 0.74, w: 8.2, h: 1.0, margin: 0, valign: "top", fit: "shrink",
      fontSize: 28, fontFace: F, bold: true, color: theme.primary,
    });
  }
  if (n) badge(pres, slide, theme, n);
  return slide;
}

function badge(pres, slide, theme, n) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 9.1, y: 5.15, w: 0.6, h: 0.3, rectRadius: 0.15, fill: { color: theme.light },
  });
  slide.addText(String(n).padStart(2, "0"), {
    x: 9.1, y: 5.15, w: 0.6, h: 0.3, margin: 0, align: "center", valign: "middle",
    fontSize: 10, fontFace: M, bold: true, color: theme.secondary,
  });
}

function source(slide, text) {
  slide.addText(text, {
    x: 0.6, y: 5.12, w: 8.3, h: 0.3, margin: 0, valign: "middle",
    fontSize: 9, fontFace: F, color: C.faint,
  });
}

function card(pres, slide, theme, box, accent) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    ...box, rectRadius: 0.1, fill: { color: C.panel },
    line: { color: accent || theme.light, width: accent ? 1.5 : 1 },
  });
}

module.exports = { F, M, C, base, badge, source, card };
