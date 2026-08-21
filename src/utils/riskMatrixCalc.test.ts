import type { Risk } from "@/types/organization"
import {
  getMatrixColor,
  hasValidRiskScore,
  LABEL_KEYS,
  mapRiskToCell,
  parseMatrixSize,
} from "./riskMatrixCalc"

// Extraction from RiskMatrixView.tsx (landing overhaul PR3) -- these cases
// mirror the real page's own behavior at the boundaries the color-tuning
// history (see this file's own comments) specifically called out, so a
// future edit to the extracted copy can't silently drift from what's
// documented as correct.
describe("getMatrixColor", () => {
  it("returns the low tier for the lowest cell in any matrix size", () => {
    expect(getMatrixColor(0, 0, 5)).toBe("bg-risk-low/55")
    expect(getMatrixColor(0, 0, 3)).toBe("bg-risk-low/55")
  })

  it("returns the critical tier for the highest cell", () => {
    expect(getMatrixColor(4, 4, 5)).toBe(
      "bg-risk-critical/90 dark:bg-risk-critical/85"
    )
  })

  it("scales thresholds by matrix size, not a fixed cell index", () => {
    // In a 3x3 matrix, the center cell (1,1) scores (2/3)*(2/3) = 0.444,
    // above the 0.36 high threshold -- high tier, not critical or medium.
    expect(getMatrixColor(1, 1, 3)).toBe("bg-risk-high/80 dark:bg-risk-high/63")
  })
})

function makeRisk(overrides: Partial<Risk> = {}): Risk {
  return {
    id: "risk-1",
    ref: "TEST-001",
    name: "Test risk",
    probability: 50,
    inherent_score: 50,
    residual_score: 50,
    category: "cyber",
    ...overrides,
  } as Risk
}

describe("hasValidRiskScore", () => {
  it("is true when probability, inherent_score, and residual_score are all valid", () => {
    expect(hasValidRiskScore(makeRisk())).toBe(true)
  })

  it("is false when residual_score is malformed, even if the other two are valid", () => {
    expect(
      hasValidRiskScore(makeRisk({ residual_score: null as unknown as number }))
    ).toBe(false)
  })
})

describe("mapRiskToCell", () => {
  it("normalizes 0-100 probability/inherent_score onto the grid, not a raw multiply", () => {
    // Regression case from this file's own history: probability=50,
    // inherent_score=50 on a 5x5 grid should land at the CENTER cell
    // (row 2, col 2), not clamp to an edge.
    const risk = makeRisk({ probability: 50, inherent_score: 50 })
    expect(mapRiskToCell(risk, 5)).toEqual({ row: 2, col: 2 })
  })

  it("falls back to the lowest cell for a missing/malformed score", () => {
    const risk = makeRisk({
      probability: null as unknown as number,
      inherent_score: undefined as unknown as number,
    })
    expect(mapRiskToCell(risk, 5)).toEqual({ row: 0, col: 0 })
  })
})

describe("parseMatrixSize", () => {
  it("accepts 3, 4, or 5", () => {
    expect(parseMatrixSize("3")).toBe(3)
    expect(parseMatrixSize("4")).toBe(4)
    expect(parseMatrixSize("5")).toBe(5)
  })

  it("returns null for anything else, including missing/malformed values", () => {
    expect(parseMatrixSize(null)).toBeNull()
    expect(parseMatrixSize("7")).toBeNull()
    expect(parseMatrixSize("not-a-number")).toBeNull()
  })
})

describe("LABEL_KEYS", () => {
  it("has exactly as many likelihood/impact labels as the matrix size", () => {
    expect(LABEL_KEYS[3].likelihood).toHaveLength(3)
    expect(LABEL_KEYS[3].impact).toHaveLength(3)
    expect(LABEL_KEYS[5].likelihood).toHaveLength(5)
    expect(LABEL_KEYS[5].impact).toHaveLength(5)
  })
})
