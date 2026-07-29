import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useMyOrgRole } from "@/hooks/useMyOrgRole"
import { useUpdateAuditEngagementMutation } from "@/redux/apis/organization/audit.api"
import { useUpdateComplianceMutation } from "@/redux/apis/organization/compliance.api"
import { useUpdateFindingByIdMutation } from "@/redux/apis/organization/findings.api"
import { useGetThreeLinesOfDefenseQuery } from "@/redux/apis/organization/governance.api"
import { useUpdateKriMutation } from "@/redux/apis/organization/kri.api"
import { useUpdateRiskMutation } from "@/redux/apis/organization/risk.api"
import type { LineOfDefense } from "@/types/organization"
import { COMPLIANCE_DOMAINS } from "@/utils/complianceConfig"
import { getEnumLabel } from "@/utils/enumLabel"
import {
  FINDING_PRIORITY_LABEL_KEYS,
  FINDING_STATUS_LABEL_KEYS,
} from "@/utils/findingLabels"
import { RISK_CATEGORIES } from "@/utils/riskConfig"
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  Loader2,
  Scale,
  Shield,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

// Backend enum/domain values with no existing shared label map elsewhere in
// the app (unlike risk category / compliance domain & status / action
// priority & status, all reused from riskConfig.ts, complianceConfig.ts and
// findingLabels.ts below). Kept local since ThreeLinesOfDefensePage is
// currently the only place rendering these as plain text rather than a
// styled badge -- follows the same `{ value: i18nKey }` + getEnumLabel()
// convention as the shared maps.
const RISK_STATUS_LABEL_KEYS: Record<string, string> = {
  open: "organization.riskRegister.statusOpen",
  in_progress: "organization.riskRegister.statusInProgress",
  completed: "organization.riskRegister.statusCompleted",
  closed: "organization.riskRegister.statusClosed",
}

const KRI_STATUS_LABEL_KEYS: Record<string, string> = {
  ALERT: "organization.kri.status.alert",
  WARNING: "organization.kri.status.warning",
  OK: "organization.kri.status.ok",
}

const AUDIT_ENGAGEMENT_STATUS_LABEL_KEYS: Record<string, string> = {
  planned: "organization.audit.statusPlanned",
  in_progress: "organization.audit.statusInProgress",
  completed: "organization.audit.statusCompleted",
}

const COMPLIANCE_STATUS_LABEL_KEYS: Record<string, string> = {
  compliant: "organization.compliance.status.compliant",
  in_progress: "organization.compliance.status.in_progress",
  non_compliant: "organization.compliance.status.non_compliant",
  not_applicable: "organization.compliance.status.not_applicable",
}

function riskCategoryLabel(t: (key: string) => string, category: string): string {
  const cat = RISK_CATEGORIES[category as keyof typeof RISK_CATEGORIES]
  return cat ? t(`organization.riskCategories.${cat.labelKey}`) : category
}

function complianceDomainLabel(t: (key: string) => string, domain: string): string {
  return COMPLIANCE_DOMAINS[domain]
    ? t(`organization.compliance.domains.${domain}`)
    : domain
}

type EntityKind = "risk" | "action" | "kri" | "compliance" | "audit"

// aexa-frontend#208/#209: GOVERNING_BODY added as a 4th column -- the IIA's
// 2020 update's headline structural addition, an explicit governing body
// sitting above the three lines.
const LINES: LineOfDefense[] = ["FIRST", "SECOND", "THIRD", "GOVERNING_BODY"]

const LINE_TITLE_KEY: Record<LineOfDefense, string> = {
  FIRST: "organization.threeLinesOfDefense.lines.first",
  SECOND: "organization.threeLinesOfDefense.lines.second",
  THIRD: "organization.threeLinesOfDefense.lines.third",
  GOVERNING_BODY: "organization.threeLinesOfDefense.lines.governingBody",
}

const MOVE_TO_KEY: Record<LineOfDefense, string> = {
  FIRST: "organization.threeLinesOfDefense.moveToFirst",
  SECOND: "organization.threeLinesOfDefense.moveToSecond",
  THIRD: "organization.threeLinesOfDefense.moveToThird",
  GOVERNING_BODY: "organization.threeLinesOfDefense.moveToGoverningBody",
}

// aexa-server#208: reassigning line_of_defense is no longer a single
// ADMIN-or-LEAD_AUDITOR check for every entity type. Risk/Kri/Compliance
// ("management line") now require ADMIN specifically
// (assertCanReassignLineOfDefense(ctx, 'MANAGEMENT_LINE')); AuditEngagement
// ("audit line") now requires LEAD_AUDITOR specifically
// (..., 'AUDIT_LINE') -- preserving internal audit's independent reporting
// line to the governing body, per the IIA Three Lines Model, rather than
// letting the same admin who owns operational risk also reclassify audit
// engagements. Action is unchanged (still ADMIN-or-LEAD_AUDITOR via
// assertCanWriteOrgResource) since it covers both first- and third-line-like
// items by design. Gating the button on the caller's real permission (rather
// than showing it and letting a 403 happen) is the "graceful handling" this
// ticket asked for.
function canReassignEntity(entityType: EntityKind, role: string | undefined): boolean {
  switch (entityType) {
    case "risk":
    case "kri":
    case "compliance":
      return role === "ADMIN"
    case "audit":
      return role === "LEAD_AUDITOR"
    case "action":
      return role === "ADMIN" || role === "LEAD_AUDITOR"
  }
}

function getErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { data?: { message?: string } })?.data?.message
  return message || fallback
}

interface ItemRowProps {
  title: string
  meta: string
  currentLine: LineOfDefense | null
  canReassign: boolean
  isPending: boolean
  onReassign: (line: LineOfDefense) => void
}

function ItemRow({
  title,
  meta,
  currentLine,
  canReassign,
  isPending,
  onReassign,
}: ItemRowProps) {
  const { t } = useTranslation()
  const otherLines = LINES.filter((line) => line !== currentLine)

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium" title={title}>
          {title}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{meta}</p>
      </div>
      {canReassign && (
        <div className="flex shrink-0 gap-1">
          {otherLines.map((line) => (
            <button
              key={line}
              type="button"
              disabled={isPending}
              onClick={() => onReassign(line)}
              className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                t(MOVE_TO_KEY[line])
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Section({
  icon: Icon,
  label,
  count,
  emptyLabel,
  children,
}: {
  icon: React.ElementType
  label: string
  count: number
  emptyLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </h4>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="text-[11px] text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-1">{children}</div>
      )}
    </div>
  )
}

export default function ThreeLinesOfDefensePage() {
  const { t } = useTranslation()
  const role = useMyOrgRole()
  const canReassignRisk = canReassignEntity("risk", role)
  const canReassignKri = canReassignEntity("kri", role)
  const canReassignCompliance = canReassignEntity("compliance", role)
  const canReassignAudit = canReassignEntity("audit", role)
  const canReassignAction = canReassignEntity("action", role)

  const { data, isLoading } = useGetThreeLinesOfDefenseQuery()
  const [updateRisk] = useUpdateRiskMutation()
  const [updateFindingById] = useUpdateFindingByIdMutation()
  const [updateKri] = useUpdateKriMutation()
  const [updateCompliance] = useUpdateComplianceMutation()
  const [updateAuditEngagement] = useUpdateAuditEngagementMutation()

  const [pendingId, setPendingId] = useState<string | null>(null)

  const risks = data?.data?.risks ?? []
  const actions = data?.data?.actions ?? []
  const kris = data?.data?.kris ?? []
  const complianceObligations = data?.data?.complianceObligations ?? []
  const auditEngagements = data?.data?.auditEngagements ?? []

  const classifiedActions = actions.filter((a) => a.line_of_defense !== null)
  const unclassifiedActions = actions.filter((a) => a.line_of_defense === null)

  const reassign = async (entityType: EntityKind, id: string, line: LineOfDefense) => {
    setPendingId(id)
    try {
      switch (entityType) {
        case "risk":
          await updateRisk({ id, data: { line_of_defense: line } }).unwrap()
          break
        case "action":
          await updateFindingById({ id, body: { line_of_defense: line } }).unwrap()
          break
        case "kri":
          await updateKri({ id, data: { line_of_defense: line } }).unwrap()
          break
        case "compliance":
          await updateCompliance({ id, data: { line_of_defense: line } }).unwrap()
          break
        case "audit":
          await updateAuditEngagement({ id, data: { line_of_defense: line } }).unwrap()
          break
      }
      toast.success(t("organization.threeLinesOfDefense.toast.reassignSuccess"))
    } catch (err) {
      toast.error(
        getErrorMessage(err, t("organization.threeLinesOfDefense.toast.reassignFailed"))
      )
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">
          {t("organization.threeLinesOfDefense.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("organization.threeLinesOfDefense.subtitle")}
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("organization.threeLinesOfDefense.loading")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {LINES.map((line) => {
              const lineRisks = risks.filter((r) => r.line_of_defense === line)
              const lineActions = classifiedActions.filter(
                (a) => a.line_of_defense === line
              )
              const lineKris = kris.filter((k) => k.line_of_defense === line)
              const lineCompliance = complianceObligations.filter(
                (c) => c.line_of_defense === line
              )
              const lineAudits = auditEngagements.filter(
                (a) => a.line_of_defense === line
              )
              const totalCount =
                lineRisks.length +
                lineActions.length +
                lineKris.length +
                lineCompliance.length +
                lineAudits.length

              return (
                <Card key={line}>
                  <CardHeader>
                    <CardTitle>{t(LINE_TITLE_KEY[line])}</CardTitle>
                    <CardDescription>
                      {t("organization.threeLinesOfDefense.itemCount", {
                        count: totalCount,
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Section
                      icon={Shield}
                      label={t("organization.threeLinesOfDefense.sections.risks")}
                      count={lineRisks.length}
                      emptyLabel={t("organization.threeLinesOfDefense.empty")}
                    >
                      {lineRisks.map((risk) => (
                        <ItemRow
                          key={risk.id}
                          title={risk.title}
                          meta={`${riskCategoryLabel(t, risk.category)} · ${getEnumLabel(t, RISK_STATUS_LABEL_KEYS, risk.status)}`}
                          currentLine={risk.line_of_defense}
                          canReassign={canReassignRisk}
                          isPending={pendingId === risk.id}
                          onReassign={(nextLine) =>
                            reassign("risk", risk.id, nextLine)
                          }
                        />
                      ))}
                    </Section>

                    <Section
                      icon={AlertTriangle}
                      label={t("organization.threeLinesOfDefense.sections.actions")}
                      count={lineActions.length}
                      emptyLabel={t("organization.threeLinesOfDefense.empty")}
                    >
                      {lineActions.map((action) => (
                        <ItemRow
                          key={action.id}
                          title={action.title}
                          meta={`${getEnumLabel(t, FINDING_PRIORITY_LABEL_KEYS, action.priority)} · ${getEnumLabel(t, FINDING_STATUS_LABEL_KEYS, action.status)}`}
                          currentLine={action.line_of_defense}
                          canReassign={canReassignAction}
                          isPending={pendingId === action.id}
                          onReassign={(nextLine) =>
                            reassign("action", action.id, nextLine)
                          }
                        />
                      ))}
                    </Section>

                    <Section
                      icon={Activity}
                      label={t("organization.threeLinesOfDefense.sections.kris")}
                      count={lineKris.length}
                      emptyLabel={t("organization.threeLinesOfDefense.empty")}
                    >
                      {lineKris.map((kri) => (
                        <ItemRow
                          key={kri.id}
                          title={kri.title}
                          meta={`${kri.unit} · ${getEnumLabel(t, KRI_STATUS_LABEL_KEYS, kri.status)}`}
                          currentLine={kri.line_of_defense}
                          canReassign={canReassignKri}
                          isPending={pendingId === kri.id}
                          onReassign={(nextLine) =>
                            reassign("kri", kri.id, nextLine)
                          }
                        />
                      ))}
                    </Section>

                    <Section
                      icon={Scale}
                      label={t("organization.threeLinesOfDefense.sections.compliance")}
                      count={lineCompliance.length}
                      emptyLabel={t("organization.threeLinesOfDefense.empty")}
                    >
                      {lineCompliance.map((obligation) => (
                        <ItemRow
                          key={obligation.id}
                          title={obligation.title}
                          meta={`${complianceDomainLabel(t, obligation.domain)} · ${getEnumLabel(t, COMPLIANCE_STATUS_LABEL_KEYS, obligation.status)}`}
                          currentLine={obligation.line_of_defense}
                          canReassign={canReassignCompliance}
                          isPending={pendingId === obligation.id}
                          onReassign={(nextLine) =>
                            reassign("compliance", obligation.id, nextLine)
                          }
                        />
                      ))}
                    </Section>

                    <Section
                      icon={ClipboardCheck}
                      label={t("organization.threeLinesOfDefense.sections.audits")}
                      count={lineAudits.length}
                      emptyLabel={t("organization.threeLinesOfDefense.empty")}
                    >
                      {lineAudits.map((engagement) => (
                        <ItemRow
                          key={engagement.id}
                          title={engagement.title}
                          meta={`${engagement.lead_auditor ?? t("organization.threeLinesOfDefense.noLeadAuditor")} · ${getEnumLabel(t, AUDIT_ENGAGEMENT_STATUS_LABEL_KEYS, engagement.status)}`}
                          currentLine={engagement.line_of_defense}
                          canReassign={canReassignAudit}
                          isPending={pendingId === engagement.id}
                          onReassign={(nextLine) =>
                            reassign("audit", engagement.id, nextLine)
                          }
                        />
                      ))}
                    </Section>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Actions predating #97 have no line_of_defense yet -- surfaced as
              its own bucket rather than hidden or force-defaulted into a line
              (see governance.service.ts's doc comment on aexa-server). */}
          <Card>
            <CardHeader>
              <CardTitle>
                {t("organization.threeLinesOfDefense.unclassified.title")}
              </CardTitle>
              <CardDescription>
                {t("organization.threeLinesOfDefense.unclassified.subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Section
                icon={AlertTriangle}
                label={t("organization.threeLinesOfDefense.sections.actions")}
                count={unclassifiedActions.length}
                emptyLabel={t("organization.threeLinesOfDefense.unclassified.empty")}
              >
                {unclassifiedActions.map((action) => (
                  <ItemRow
                    key={action.id}
                    title={action.title}
                    meta={`${getEnumLabel(t, FINDING_PRIORITY_LABEL_KEYS, action.priority)} · ${getEnumLabel(t, FINDING_STATUS_LABEL_KEYS, action.status)}`}
                    currentLine={null}
                    canReassign={canReassignAction}
                    isPending={pendingId === action.id}
                    onReassign={(nextLine) =>
                      reassign("action", action.id, nextLine)
                    }
                  />
                ))}
              </Section>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
