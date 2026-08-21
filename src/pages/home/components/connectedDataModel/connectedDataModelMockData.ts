import type { AuditFinding, Mitigation } from "@/types/organization"

// Landing overhaul PR8 (theme-improvement-initiative): the Connected Data
// Model interaction (PR9) needs to show a risk linked out to a KRI, an
// audit finding, and a mitigation -- but of those four hops, only
// Risk -> KRI is both a real field AND already populated in this
// codebase's mock data (riskMatrixMockData.ts / overviewMockData.ts).
// Direct research into the other two:
//
// - AuditFinding.linked_risk_id (src/types/organization.d.ts) is a real
//   field on a real type -- confirmed against aexa-server's schema via
//   riskLink.api.ts's own comment referencing "Fullbloom's AuditFinding".
//   But no page in this frontend renders AuditFinding today; the live
//   findings UI (AllFindingsPage) uses a *different* real type, IAction
//   (src/types/finding.d.ts), whose FKs are inspectionId/siteId/
//   questionId/auditEngagementId/complianceObligationId -- no risk link
//   at all. Zero mock AuditFinding rows exist anywhere to import.
// - Mitigation.risk_id is likewise real and rendered (a differently-shaped
//   AI-suggestion result, not this exact type) on IntelligencePage's
//   mitigations panel, which established the real mitigation_type
//   vocabulary (prevent/detect/correct/transfer/accept) and priority
//   levels reused below. Zero mock Mitigation rows exist to import either.
//
// This file authors ONE real-shaped row of each, with linked_risk_id/
// risk_id populated against "risk-1" (CYB-014, ref of the same hub risk
// RiskGraphWidget and the KRI slider already use) -- filling in a real,
// currently-empty field with real-shaped data, not inventing a
// relationship that doesn't exist. Explicitly NOT claiming these rows
// exist in any real organization's data today.
export const MOCK_AUDIT_FINDINGS: AuditFinding[] = [
  {
    id: "finding-cdm-1",
    organization_id: "org-demo",
    user_id: "user-demo",
    engagement_id: "audit-cdm-1",
    ref: "AUD-014-F1",
    title: "VPN concentrator patch level not current",
    criteria: "Vendor security patches applied within 30 days of release.",
    condition: "VPN concentrator is 3 major versions behind the current release.",
    effect: "Known remote-code-execution path remains exploitable.",
    cause: "No automated patch-compliance check on network appliances.",
    recommendation: "Apply vendor patches and add the device to the patch-compliance scan.",
    severity: "critical",
    status: "open",
    owner: "Security Engineering",
    due_date: "2026-09-15T00:00:00.000Z",
    closed_at: null,
    linked_risk_id: "risk-1",
    link_type: "CAUSES",
    delta: 0,
    ai_generated: false,
    is_edited: false,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  },
]

export const MOCK_MITIGATIONS: Mitigation[] = [
  {
    id: "mitigation-cdm-1",
    organization_id: "org-demo",
    user_id: "user-demo",
    risk_id: "risk-1",
    title: "Patch and isolate the VPN concentrator",
    description: "Apply the vendor's latest firmware and move the device behind a jump host.",
    mitigation_type: "correct",
    status: "in_progress",
    priority: "critical",
    owner: "Security Engineering",
    cost_estimate: 4000,
    effectiveness_score: 0.8,
    risk_reduction: 0.35,
    due_date: "2026-09-15T00:00:00.000Z",
    completed_date: null,
    is_ai_suggested: false,
    is_edited: false,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-05T00:00:00.000Z",
  },
]
