import {
  MOCK_AUDIT_FINDINGS,
  MOCK_MITIGATIONS,
} from "./connectedDataModelMockData"

// These rows exist specifically to fill in a real, currently-empty field
// (AuditFinding.linked_risk_id, Mitigation.risk_id) with real-shaped data --
// this test locks in the one property that matters most: they actually
// link to the same hub risk ("risk-1"/CYB-014) the rest of the landing
// page's demos already use, not an arbitrary or mismatched id.
describe("connectedDataModelMockData", () => {
  it("links the mock audit finding to the shared hub risk", () => {
    expect(MOCK_AUDIT_FINDINGS[0].linked_risk_id).toBe("risk-1")
  })

  it("links the mock mitigation to the shared hub risk", () => {
    expect(MOCK_MITIGATIONS[0].risk_id).toBe("risk-1")
  })

  it("uses a real mitigation_type value from the established vocabulary", () => {
    // prevent/detect/correct/transfer/accept -- established on
    // IntelligencePage's mitigations panel, not invented here.
    expect(["prevent", "detect", "correct", "transfer", "accept"]).toContain(
      MOCK_MITIGATIONS[0].mitigation_type
    )
  })
})
