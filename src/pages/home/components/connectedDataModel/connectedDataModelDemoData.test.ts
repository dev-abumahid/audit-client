import {
  MOCK_KRIS,
  MOCK_RISKS,
} from "@/dashboard/organization/overview/overviewMockData"
import { MOCK_AUDIT_FINDINGS, MOCK_MITIGATIONS } from "./connectedDataModelMockData"
import { CONNECTED_DEMO_RISKS } from "./connectedDataModelDemoData"

// Locks in what this file's whole reason for existing rests on: every
// connection is found via the real foreign key, not a hand-picked index --
// if connectedDataModelMockData.ts's authored rows ever drift (a risk_id
// typo, a removed row), this catches it as a mismatch rather than silently
// rendering the wrong record or a false empty state.
describe("connectedDataModelDemoData", () => {
  it("selects exactly the 4 intended risks, each a real MOCK_RISKS entry", () => {
    expect(CONNECTED_DEMO_RISKS).toHaveLength(4)
    CONNECTED_DEMO_RISKS.forEach((entry) => {
      expect(MOCK_RISKS).toContainEqual(entry.risk)
    })
  })

  it("finds each risk's KRI via the real risk_id foreign key, not a hardcoded pairing", () => {
    CONNECTED_DEMO_RISKS.forEach((entry) => {
      const expected =
        MOCK_KRIS.find((k) => k.risk_id === entry.risk.id) ?? null
      expect(entry.kri).toEqual(expected)
    })
  })

  it("finds each risk's audit finding via linked_risk_id and mitigation via risk_id", () => {
    CONNECTED_DEMO_RISKS.forEach((entry) => {
      const expectedFinding =
        MOCK_AUDIT_FINDINGS.find((f) => f.linked_risk_id === entry.risk.id) ??
        null
      const expectedMitigation =
        MOCK_MITIGATIONS.find((m) => m.risk_id === entry.risk.id) ?? null
      expect(entry.finding).toEqual(expectedFinding)
      expect(entry.mitigation).toEqual(expectedMitigation)
    })
  })

  it("gives every demo risk a real KRI, finding, and mitigation -- none fall back to null", () => {
    // Each connection above is found via the record's own real FK, so this
    // isn't asserting 4 hardcoded truths -- it's asserting
    // connectedDataModelMockData.ts actually authored a row for every one
    // of the 4 demo risk ids, not just the original CYB-014.
    CONNECTED_DEMO_RISKS.forEach((entry) => {
      expect(entry.kri).not.toBeNull()
      expect(entry.finding).not.toBeNull()
      expect(entry.mitigation).not.toBeNull()
    })
  })

  it("keeps each finding's own content grounded in that specific risk's real description, not interchangeable filler", () => {
    // A word from each risk's own real MOCK_RISKS description should show
    // up somewhere in that risk's own finding -- catches an accidental
    // copy-paste (e.g. every finding text ends up about the VPN
    // concentrator) that toEqual/FK checks above wouldn't.
    const topicWords: Record<string, string> = {
      "risk-1": "VPN",
      "risk-6": "segmentation",
      "risk-2": "resin",
      "risk-7": "crane",
    }
    CONNECTED_DEMO_RISKS.forEach((entry) => {
      const word = topicWords[entry.risk.id]
      const haystack = `${entry.finding!.title} ${entry.finding!.condition} ${entry.finding!.cause}`
      expect(haystack.toLowerCase()).toContain(word.toLowerCase())
    })
  })
})
