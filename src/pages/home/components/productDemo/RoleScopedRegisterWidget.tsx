import type { KeyboardEvent } from "react"
import { useRef, useState } from "react"
import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MOCK_RISKS } from "@/dashboard/organization/risk/riskMatrixMockData"
import { canWriteOrgResource } from "@/hooks/useMyOrgRole"
import type { OrgRole } from "@/types/organizationMember"
import { riskCategoryLabel } from "@/utils/riskConfig"
import { getRiskSeverityLevel } from "@/utils/riskScoring"
import { SEVERITY_STYLES } from "@/utils/severityStyles"

// Landing overhaul PR4: canWriteOrgResource is the real, unmodified gate
// from useMyOrgRole.ts -- zero new logic. The demo can't use useMyOrgRole()
// itself (it hits real useGetMeQuery/useGetAllOrgUsersQuery endpoints,
// meaningless without a signed-in session), so the role here is a local
// toggle instead of a resolved session; the gating function it feeds is
// identical to what a real signed-in user's role would drive.
//
// Only ADMIN/LEAD_AUDITOR/LIGHT_USER are offered (not the 4th real role,
// VIEWER) -- matches this app's own established public-facing copy
// (HeroFeatures: "Admin, Lead Auditor, and Light user roles"), which never
// names VIEWER as a distinct concept to a visitor.
const ROLES: OrgRole[] = ["ADMIN", "LEAD_AUDITOR", "LIGHT_USER"]
const DEMO_RISKS = MOCK_RISKS.slice(0, 5)

// CEO feedback: canWriteOrgResource alone (ADMIN || LEAD_AUDITOR) made
// these two roles render identically -- every row showed the same Edit
// button for both. The real app's own maker-checker gate
// (RiskApprovalControls.tsx: `canSubmit = ADMIN || LEAD_AUDITOR`, but
// `isAdmin = role === "ADMIN"` gates the actual approve/reject decision)
// is a real, already-shipped distinction between these two roles -- one
// demo row is flagged as pending approval to surface it: Lead Auditor
// (who submitted it) sees a read-only "Pending" badge, Admin sees real
// Approve/Reject controls. Every other row is unaffected, same Edit
// button either role already had.
const PENDING_APPROVAL_REF = DEMO_RISKS[1]?.ref

export default function RoleScopedRegisterWidget() {
  const { t } = useTranslation()
  const [role, setRole] = useState<OrgRole>("ADMIN")
  const canWrite = canWriteOrgResource(role)
  // Same real distinction RiskApprovalControls.tsx's own `isAdmin` gates:
  // ADMIN and LEAD_AUDITOR share canWriteOrgResource, but only ADMIN can
  // decide (approve/reject) a pending risk.
  const isAdmin = role === "ADMIN"
  const roleRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Review finding on PR #1017: role="radiogroup"/role="radio" implies the
  // same ARIA APG arrow-key navigation + roving tabindex pattern DemoTabs.tsx
  // already got fixed for in the prior PR's review round -- this widget had
  // the identical gap (each "radio" its own separate Tab stop, no arrow-key
  // activation). Same fix, mirrored here.
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      nextIndex = (index + 1) % ROLES.length
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      nextIndex = (index - 1 + ROLES.length) % ROLES.length
    else if (e.key === "Home") nextIndex = 0
    else if (e.key === "End") nextIndex = ROLES.length - 1
    if (nextIndex === null) return

    e.preventDefault()
    const nextRole = ROLES[nextIndex]
    setRole(nextRole)
    roleRefs.current[nextRole]?.focus()
  }

  return (
    <div className="rounded-[11px] bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        {/* Review finding on PR #1025: demoted from <h3> -- this widget only
            mounts under ProductDemoSection's DemoMoment, which already
            supplies the real section <h3> right above it. See
            KriThresholdSliderWidget's identical fix for the full
            reasoning. */}
        <p className="text-sm font-semibold text-foreground">
          {t("home.productDemo.roleRegister.title")}
        </p>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {t("home.productDemo.roleRegister.hint")}
      </p>

      <div role="radiogroup" className="mb-4 flex gap-1.5">
        {ROLES.map((r, index) => {
          const isActive = r === role
          return (
            // active:scale-95 -- design-team finding: a color-only
            // transition on click gave no tactile "this was pressed" cue,
            // unlike the FAQ accordion's icon or the CDM cards' hover
            // state elsewhere on the page. motion-reduce override keeps
            // the reduced-motion opt-out intact.
            <button
              key={r}
              ref={(el) => {
                roleRefs.current[r] = el
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setRole(r)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`focus-ring flex min-h-11 items-center rounded-full px-4 text-xs font-medium transition-all duration-150 ease-out active:scale-95 motion-reduce:active:scale-100 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {t(`home.productDemo.roleRegister.roles.${r}`)}
            </button>
          )
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 pr-2 font-medium">
                {t("home.productDemo.roleRegister.columns.ref")}
              </th>
              <th className="py-1.5 pr-2 font-medium">
                {t("home.productDemo.roleRegister.columns.name")}
              </th>
              <th className="py-1.5 pr-2 font-medium">
                {t("home.productDemo.roleRegister.columns.severity")}
              </th>
              {/* Column/action collapse (opacity + width), not an instant
                  vanish -- v3 motion plan: this is the demo where motion
                  should teach the product (permissions visibly reshaping
                  the interface), not just decorate a state change. */}
              <th
                className={`overflow-hidden py-1.5 pr-2 font-medium transition-all duration-200 ease-out motion-reduce:transition-none ${
                  canWrite ? "w-16 opacity-100" : "w-0 opacity-0"
                }`}
              >
                {t("home.productDemo.roleRegister.columns.action")}
              </th>
            </tr>
          </thead>
          <tbody>
            {DEMO_RISKS.map((risk) => {
              const severity = getRiskSeverityLevel(risk.residual_score)
              return (
                <tr key={risk.id} className="border-b border-border/50">
                  <td className="py-2 pr-2 font-mono-data text-muted-foreground">
                    {risk.ref}
                  </td>
                  <td className="py-2 pr-2 text-foreground">
                    <span className="line-clamp-1">{risk.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {riskCategoryLabel(t, risk.category)}
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_STYLES[severity].bg} ${SEVERITY_STYLES[severity].text}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES[severity].dot}`}
                      />
                      {t(`riskLevel.${severity}`)}
                    </span>
                  </td>
                  <td
                    className={`overflow-hidden py-2 pr-2 transition-all duration-200 ease-out motion-reduce:transition-none ${
                      canWrite
                        ? risk.ref === PENDING_APPROVAL_REF
                          ? "w-32 opacity-100"
                          : "w-16 opacity-100"
                        : "w-0 opacity-0"
                    }`}
                  >
                    {/* No conditional tabIndex needed here -- the
                        surrounding `canWrite &&` already guarantees this
                        button only exists in the DOM when canWrite is true,
                        so it's never reachable in a hidden state to guard
                        against. */}
                    {canWrite && risk.ref === PENDING_APPROVAL_REF ? (
                      isAdmin ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={t(
                              "home.productDemo.roleRegister.approveButton"
                            )}
                            className="focus-ring flex h-11 w-11 items-center justify-center rounded-md border border-risk-low/40 bg-risk-low/10 text-risk-low hover:bg-risk-low/20"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={t(
                              "home.productDemo.roleRegister.rejectButton"
                            )}
                            className="focus-ring flex h-11 w-11 items-center justify-center rounded-md border border-risk-critical/40 bg-risk-critical/10 text-risk-critical hover:bg-risk-critical/20"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {t("home.productDemo.roleRegister.pendingBadge")}
                        </span>
                      )
                    ) : (
                      canWrite && (
                        <button
                          type="button"
                          className="focus-ring inline-flex min-h-11 items-center rounded-md border border-border px-2 text-[10px] text-foreground hover:bg-muted"
                        >
                          {t("home.productDemo.roleRegister.editButton")}
                        </button>
                      )
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        {role === "LIGHT_USER"
          ? t("home.productDemo.roleRegister.captionReadOnly")
          : isAdmin
            ? t("home.productDemo.roleRegister.captionAdmin")
            : t("home.productDemo.roleRegister.captionLeadAuditor")}
      </p>
    </div>
  )
}
