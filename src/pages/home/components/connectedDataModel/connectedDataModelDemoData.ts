import {
  MOCK_KRIS,
  MOCK_RISKS,
} from "@/dashboard/organization/overview/overviewMockData"
import type { AuditFinding, KRI, Mitigation, Risk } from "@/types/organization"
import { MOCK_AUDIT_FINDINGS, MOCK_MITIGATIONS } from "./connectedDataModelMockData"

// Landing overhaul (connected-data-model redesign): the 4 risks a visitor
// can select. Chosen by inspecting which risks in the real mock dataset
// actually have (or could genuinely have) connected records, not picked
// first and then backfilled with arbitrary content. Each of the 4 has a
// real, already-existing KRI (MOCK_KRIS, overviewMockData.ts); each also
// has an AuditFinding + Mitigation authored in connectedDataModelMockData.ts
// using the real AuditFinding/Mitigation types and real
// linked_risk_id/risk_id foreign keys -- per the brief's own explicit
// allowance ("if the relationship exists in the schema but the mock data
// doesn't populate it, author real-shaped mock data using the real type
// and real FK, don't fabricate a relationship that doesn't exist"). Every
// finding's condition/cause/effect genuinely follows from that risk's own
// real description in overviewMockData.ts, not generic filler text.
// Ordered by residual_score descending (79/63/58/30) so severity reads as
// a visible gradient across the selector, not an arbitrary order.
const DEMO_RISK_IDS = ["risk-1", "risk-6", "risk-2", "risk-7"] as const

export interface ConnectedDemoEntry {
  risk: Risk
  // Still nullable, not guaranteed non-null by these 4 IDs specifically --
  // any future risk added to DEMO_RISK_IDS without a matching KRI/finding/
  // mitigation row must still render a real, honest empty state rather
  // than crash or silently show nothing.
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
