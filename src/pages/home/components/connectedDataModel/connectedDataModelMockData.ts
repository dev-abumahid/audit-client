import type { AuditFinding, Mitigation } from "@/types/organization"

// Landing overhaul PR8 (theme-improvement-initiative): the Connected Data
// Model interaction needs to show a risk linked out to a KRI, an audit
// finding, and a mitigation -- but of those four hops, only Risk -> KRI is
// both a real field AND already populated in this codebase's mock data
// (riskMatrixMockData.ts / overviewMockData.ts). Direct research into the
// other two:
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
// This file authors one real-shaped row of each per demo risk (all 4 used
// by connectedDataModelDemoData.ts), with linked_risk_id/risk_id populated
// against real risk ids -- filling in a real, currently-empty field with
// real-shaped data, not inventing a relationship that doesn't exist. Each
// finding's condition/cause/effect/recommendation is written to genuinely
// follow from that risk's own real description in overviewMockData.ts
// (e.g. CYB-009's finding is about the exact OT/IT segmentation gap
// CYB-009 itself describes), not generic placeholder text. Explicitly NOT
// claiming these rows exist in any real organization's data today.
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
  {
    id: "finding-cdm-2",
    organization_id: "org-demo",
    user_id: "user-demo",
    engagement_id: "audit-cdm-2",
    ref: "AUD-009-F1",
    title: "OT/IT network segmentation gap confirmed at Austin plant floor",
    criteria: "Plant-floor control systems must sit on a network segment isolated from corporate IT.",
    condition: "Production-line PLCs share a flat network with office workstations; no firewall boundary present between the two.",
    effect: "A compromised office endpoint has direct network reachability to plant-floor control systems.",
    cause: "OT/IT segmentation project was deprioritized during the last network refresh.",
    recommendation: "Deploy a dedicated OT VLAN with firewall-enforced boundary between IT and OT zones.",
    severity: "high",
    status: "open",
    owner: "IT Security",
    due_date: "2026-10-01T00:00:00.000Z",
    closed_at: null,
    linked_risk_id: "risk-6",
    link_type: "CAUSES",
    delta: 0,
    ai_generated: false,
    is_edited: false,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
  },
  {
    id: "finding-cdm-3",
    organization_id: "org-demo",
    user_id: "user-demo",
    engagement_id: "audit-cdm-3",
    ref: "AUD-007-F1",
    title: "No qualified backup resin supplier identified",
    criteria: "A qualified backup supplier must be identified within 12 months of single-sourcing a critical material.",
    condition: "The Rotterdam plant's resin supplier has been single-sourced for over 3 years with no backup-qualification effort started.",
    effect: "A supply disruption from this vendor would halt Rotterdam production with no fallback source.",
    cause: "Backup-supplier qualification was not tracked after the original vendor onboarding.",
    recommendation: "Initiate technical and commercial qualification of a second resin supplier.",
    severity: "high",
    status: "open",
    owner: "Procurement",
    due_date: "2026-11-01T00:00:00.000Z",
    closed_at: null,
    linked_risk_id: "risk-2",
    link_type: "CAUSES",
    delta: 0,
    ai_generated: false,
    is_edited: false,
    created_at: "2026-07-05T00:00:00.000Z",
    updated_at: "2026-07-05T00:00:00.000Z",
  },
  {
    id: "finding-cdm-4",
    organization_id: "org-demo",
    user_id: "user-demo",
    engagement_id: "audit-cdm-4",
    ref: "AUD-004-F1",
    title: "No cross-trained backup for certified crane operation",
    criteria: "Safety-critical certifications required for a single operating role must have at least one cross-trained backup.",
    condition: "Only one employee at the Rotterdam plant holds the required heavy-lift certification.",
    effect: "That operator's absence or departure would halt all heavy-lift operations with no certified backup available.",
    cause: "Cross-training budget was not allocated in the last training cycle.",
    recommendation: "Cross-train and certify a second operator for heavy-lift operations.",
    severity: "medium",
    status: "closed",
    owner: "Rotterdam Ops",
    due_date: "2026-06-30T00:00:00.000Z",
    closed_at: "2026-06-18T00:00:00.000Z",
    linked_risk_id: "risk-7",
    link_type: "CAUSES",
    delta: 0,
    ai_generated: false,
    is_edited: false,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-06-18T00:00:00.000Z",
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
  {
    id: "mitigation-cdm-2",
    organization_id: "org-demo",
    user_id: "user-demo",
    risk_id: "risk-6",
    title: "Deploy OT/IT network segmentation",
    description: "Install a dedicated OT VLAN with a firewall-enforced boundary between office and plant-floor networks.",
    mitigation_type: "prevent",
    status: "planned",
    priority: "high",
    owner: "IT Security",
    cost_estimate: 22000,
    effectiveness_score: 0.75,
    risk_reduction: 0.4,
    due_date: "2026-10-15T00:00:00.000Z",
    completed_date: null,
    is_ai_suggested: false,
    is_edited: false,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
  },
  {
    id: "mitigation-cdm-3",
    organization_id: "org-demo",
    user_id: "user-demo",
    risk_id: "risk-2",
    title: "Qualify a second resin supplier",
    description: "Begin technical and commercial qualification of a backup resin supplier to remove the single-source dependency.",
    mitigation_type: "prevent",
    status: "in_progress",
    priority: "high",
    owner: "Procurement",
    cost_estimate: 15000,
    effectiveness_score: 0.7,
    risk_reduction: 0.3,
    due_date: "2026-11-01T00:00:00.000Z",
    completed_date: null,
    is_ai_suggested: false,
    is_edited: false,
    created_at: "2026-07-05T00:00:00.000Z",
    updated_at: "2026-08-10T00:00:00.000Z",
  },
  {
    id: "mitigation-cdm-4",
    organization_id: "org-demo",
    user_id: "user-demo",
    risk_id: "risk-7",
    title: "Cross-train a second certified crane operator",
    description: "Enroll a second operator in heavy-lift certification training to remove the single-point-of-failure risk.",
    mitigation_type: "prevent",
    status: "completed",
    priority: "medium",
    owner: "Rotterdam Ops",
    cost_estimate: 3500,
    effectiveness_score: 0.85,
    risk_reduction: 0.5,
    due_date: "2026-06-30T00:00:00.000Z",
    completed_date: "2026-06-18T00:00:00.000Z",
    is_ai_suggested: false,
    is_edited: false,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-06-18T00:00:00.000Z",
  },
]
