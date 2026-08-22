import {
  MOCK_KRIS,
  MOCK_RISKS,
} from "@/dashboard/organization/overview/overviewMockData"
import { MOCK_AUDIT_FINDINGS, MOCK_MITIGATIONS } from "./connectedDataModelMockData"
import { CONNECTED_DEMO_RISKS } from "./connectedDataModelDemoData"

// Locks in the two things that matter for this file's whole reason for
// existing: (1) every connection is found via the real foreign key, not a
// hand-picked index, and (2) the asymmetry across the 4 demo risks is real
// -- not every risk has a finding/mitigation, and this file must not paper
// over that.
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

  it("does not fabricate uniformity -- at least one demo risk has no finding/mitigation", () => {
    const withoutFinding = CONNECTED_DEMO_RISKS.filter((e) => e.finding === null)
    const withoutMitigation = CONNECTED_DEMO_RISKS.filter(
      (e) => e.mitigation === null
    )
    expect(withoutFinding.length).toBeGreaterThan(0)
    expect(withoutMitigation.length).toBeGreaterThan(0)
    // ...but every demo risk does have a KRI -- that's the one relationship
    // real enough in the mock data to guarantee for all 4.
    CONNECTED_DEMO_RISKS.forEach((entry) => expect(entry.kri).not.toBeNull())
  })
})
