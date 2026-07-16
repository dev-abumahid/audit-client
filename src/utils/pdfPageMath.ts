export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297

// `.page` divs (see buildInspectionPdfHtml's CSS) have a min-height, not a
// max — a section with enough content (long answers, many questions) grows
// taller than one A4 page. Scaling proportionally to the canvas's real aspect
// ratio (rather than forcing every capture into a fixed 210x297 box) avoids
// squishing that content; if a section is still taller than one PDF page,
// this returns one image placement per additional page needed, the same way
// TemplateReportPage.tsx slices its single tall canvas.
export function computePdfPagePlacements(
  canvasWidthPx: number,
  canvasHeightPx: number
): { imgHeightMm: number; positionsMm: number[] } {
  if (!(canvasWidthPx > 0)) {
    // A zero (or negative/NaN) width would divide out to Infinity/NaN below,
    // and `while (heightLeft > 0)` never terminates for Infinity — an
    // infinite loop hanging the tab, not a graceful failure. A captured
    // .page element with no rendered width (e.g. an empty section) should
    // fail loudly instead.
    throw new Error(
      `Cannot compute PDF page layout: canvas has invalid width (${canvasWidthPx})`
    )
  }
  const imgHeightMm = (canvasHeightPx * A4_WIDTH_MM) / canvasWidthPx
  const positionsMm: number[] = [0]
  let heightLeft = imgHeightMm - A4_HEIGHT_MM
  while (heightLeft > 0) {
    positionsMm.push(heightLeft - imgHeightMm)
    heightLeft -= A4_HEIGHT_MM
  }
  return { imgHeightMm, positionsMm }
}
