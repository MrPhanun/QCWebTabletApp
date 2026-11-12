// Administration › Customize UI, "PDF / Excel" group: sizes used when the OQC record is written into "OQC Data.xlsx"
// (Excel download and PDF). Each default is what the template / builder used before, so an unchanged value changes nothing.
// [key, default, min, max] — keep in step with the pdf* items of UI_GROUPS in public/js/menu/screens/customize.js
const PDF_DEFS = [
  ['pdfCustFont', 14, 8, 20],       // Customer, Part No (pt)
  ['pdfInfoFont', 10.5, 7, 16],     // LOT №, Quantity, Spot check, Probability
  ['pdfMatFont', 12, 7, 16],        // 1) Material check text
  ['pdfPosFont', 10, 6, 14],        // Length Position (largest; long names still shrink to fit)
  ['pdfSpecFont', 10.5, 7, 16],     // SPEC
  ['pdfSmpFont', 10.5, 7, 16],      // sample values ① .. ⑤
  ['pdfResFont', 9, 6, 14],         // Length Check result row (OK / NG)
  ['pdfItemResFont', 10.5, 7, 16],  // Material / Inspection point results
  ['pdfFootFont', 10.5, 7, 16],     // Remarks, Total determination, Checked by, Inspector
  ['pdfPosW', 135, 100, 180],       // Length Position column width (% of the template's; taken from the samples)
  ['pdfSpecW', 133, 90, 170],       // SPEC column width (% of the template's; taken from / given to Length Position)
  // The next two take no width from other columns: the page scale shrinks instead, to keep one A4 page
  ['pdfNoW', 100, 50, 200],         // № column of both Length Check tables (A:B, Y:Z), % of the template's
  ['pdfSmpW', 100, 60, 170],        // sample columns ① .. ⑤ (both tables, all alike); the two Result boxes follow them
  ['pdfLenRowH', 22.5, 15, 36]      // Length Check row height (pt); the page scale shrinks to keep one A4 page
];
const PDF_DEFAULT = Object.fromEntries(PDF_DEFS.map(([k, d]) => [k, d]));

// Only known keys, numbers within range; anything else is left out (= default)
function cleanPdfOptions(src) {
  const out = {};
  for (const [k, , min, max] of PDF_DEFS) {
    const v = src && src[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max) out[k] = v;
  }
  return out;
}

module.exports = { PDF_DEFS, PDF_DEFAULT, cleanPdfOptions };
