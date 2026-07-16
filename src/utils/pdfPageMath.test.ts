import { computePdfPagePlacements } from "./pdfPageMath"

describe("computePdfPagePlacements (ticket #63 — PDF Download review fix)", () => {
  it("scales proportionally to the canvas's real aspect ratio instead of forcing a fixed 210x297 box", () => {
    // A section that's roughly as tall as one A4 page at 2x scale (canvas is
    // in device pixels, not mm — width/height ratio is what matters).
    const { imgHeightMm, positionsMm } = computePdfPagePlacements(1588, 2245)

    expect(imgHeightMm).toBeCloseTo((2245 * 210) / 1588, 1)
    expect(positionsMm).toEqual([0])
  })

  it("splits a section taller than one A4 page across multiple placements instead of squishing it", () => {
    // Roughly double the height of an A4-proportioned canvas — the old fixed
    // 0,0,210,297 addImage call would have squished this into one page.
    const { imgHeightMm, positionsMm } = computePdfPagePlacements(1588, 4490)

    expect(imgHeightMm).toBeGreaterThan(297)
    expect(positionsMm.length).toBe(2)
    expect(positionsMm[0]).toBe(0)
    // Second placement's offset is negative (shifts the same tall image up so
    // its remaining content lands on the second PDF page).
    expect(positionsMm[1]).toBeLessThan(0)
    expect(positionsMm[1]).toBeCloseTo(-297, 1)
  })

  it("does not squish a short section either — it's a fraction of a page, not stretched to fill 297mm", () => {
    const { imgHeightMm, positionsMm } = computePdfPagePlacements(1588, 400)

    expect(imgHeightMm).toBeLessThan(297)
    expect(positionsMm).toEqual([0])
  })

  it("throws instead of hanging when the canvas has zero width (round-2 review fix)", () => {
    // A zero-width canvas would divide out to Infinity, and the pagination
    // loop's `while (heightLeft > 0)` never terminates for Infinity —
    // this must fail loudly instead of hanging the tab.
    expect(() => computePdfPagePlacements(0, 500)).toThrow()
  })

  it("throws for a negative or NaN width rather than producing garbage output", () => {
    expect(() => computePdfPagePlacements(-10, 500)).toThrow()
    expect(() => computePdfPagePlacements(NaN, 500)).toThrow()
  })
})
