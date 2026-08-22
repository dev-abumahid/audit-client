import {
  MOCK_KRIS,
  MOCK_RISKS,
} from "@/dashboard/organization/overview/overviewMockData"
import type { AuditFinding, KRI, Mitigation, Risk } from "@/types/organization"
import { MOCK_AUDIT_FINDINGS, MOCK_MITIGATIONS } from "./connectedDataModelMockData"

// Landing overhaul (connected-data-model redesign): the 4 risks a visitor
// can select. Chosen by inspecting which risks in the real mock dataset
// actually have connected records, not picked first and then backfilled --
// CYB-014 is the only risk anywhere in this codebase's mock data with an
// AuditFinding + Mitigation (see connectedDataModelMockData.ts's own
// comment on why only that one risk got those two rows authored). The
// other three are real risks with a real, already-existing KRI
// (MOCK_KRIS, overviewMockData.ts) and genuinely nothing else connected --
// each renders its Finding/Mitigation child slot as a truthful "not linked"
// state rather than fabricating rows to make all four look the same.
// Ordered by residual_score descending (79/63/58/30) so severity reads as
// a visible gradient across the selector, not an arbitrary order.
const DEMO_RISK_IDS = ["risk-1", "risk-6", "risk-2", "risk-7"] as const

export interface ConnectedDemoEntry {
  risk: Risk
  // null, not a placeholder object -- every consumer must handle "this risk
  // genuinely has no connected record of this type" as a real, renderable
  // state, since 3 of the 4 demo risks are in exactly that state for
  // finding/mitigation.
  kri: KRI | null
  finding: AuditFinding | null
  mitigation: Mitigation | null
}

// Connections are found by filtering on the real foreign key
// (KRI.risk_id / AuditFinding.linked_risk_id / Mitigation.risk_id), not
// hand-mapped by risk index -- if the mock data ever changes, this stays
// correct instead of silently pointing at the wrong record.
export const CONNECTED_DEMO_RISKS: ConnectedDemoEntry[] = DEMO_RISK_IDS.map(
  (id) => {
    const risk = MOCK_RISKS.find((r) => r.id === id)
    if (!risk) {
      throw new Error(`connectedDataModelDemoData: no MOCK_RISKS entry for ${id}`)
    }
    return {
      risk,
      kri: MOCK_KRIS.find((k) => k.risk_id === id) ?? null,
      finding: MOCK_AUDIT_FINDINGS.find((f) => f.linked_risk_id === id) ?? null,
      mitigation: MOCK_MITIGATIONS.find((m) => m.risk_id === id) ?? null,
    }
  }
)
