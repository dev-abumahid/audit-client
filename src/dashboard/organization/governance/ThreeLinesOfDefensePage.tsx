import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { riskCategoryLabel } from "@/utils/riskConfig"
import { SEVERITY_STYLES, type SeverityLevel } from "@/utils/severityStyles"
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  ClipboardCheck,
  Loader2,
  Scale,
  Shield,
} from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
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

function complianceDomainLabel(
  t: (key: string) => string,
  domain: string
): string {
  return COMPLIANCE_DOMAINS[domain]
    ? t(`organization.compliance.domains.${domain}`)
    : domain
}

// Maps each entity type's own status enum (see the *_STATUS_LABEL_KEYS maps
// above) to a shared SeverityLevel, so ItemRow can show a consistent
// at-a-glance severity dot across all 5 entity types on this board -- same
// dot color source as RiskBadge/severityBadgeClasses (src/utils/severityStyles.ts).
const RISK_STATUS_SEVERITY: Record<string, SeverityLevel> = {
  open: "medium",
  in_progress: "info",
  completed: "low",
  closed: "neutral",
}
const KRI_STATUS_SEVERITY: Record<string, SeverityLevel> = {
  ALERT: "critical",
  WARNING: "medium",
  OK: "low",
}
const AUDIT_STATUS_SEVERITY: Record<string, SeverityLevel> = {
  planned: "info",
  in_progress: "medium",
  completed: "low",
}
const COMPLIANCE_STATUS_SEVERITY: Record<string, SeverityLevel> = {
  non_compliant: "critical",
  in_progress: "medium",
  compliant: "low",
  not_applicable: "neutral",
}
// Same mapping as FindingDetails.tsx/AllFindingsPage.tsx's STATUS_STYLE.
const ACTION_STATUS_SEVERITY: Record<string, SeverityLevel> = {
  TO_DO: "medium",
  IN_PROGRESS: "info",
  COMPLETE: "low",
  CANT_DO: "critical",
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
function canReassignEntity(
  entityType: EntityKind,
  role: string | undefined
): boolean {
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

// quality-bar-loop round 3 (efficiency, round-1 finding): grouping each
// entity list by line_of_defense once (O(n)) replaces the previous 4 calls
// to `.filter()` per entity type per render (20 total across all 4 lines x
// 5 entity types) with an O(1) lookup per line inside the LINES.map below.
function groupByLine<T extends { line_of_defense: LineOfDefense | null }>(
  items: T[]
): Record<LineOfDefense, T[]> {
  const grouped: Record<LineOfDefense, T[]> = {
    FIRST: [],
    SECOND: [],
    THIRD: [],
    GOVERNING_BODY: [],
  }
  for (const item of items) {
    // Bounds-check before indexing: a legacy/typo'd/not-yet-recognized
    // line_of_defense value would otherwise index `grouped` with a key it
    // doesn't have, and `.push()` on `undefined` throws -- crashing the
    // whole board over one malformed record instead of just omitting it.
    // Object.hasOwn (not `in`) so an inherited Object.prototype key like
    // "constructor" can never match.
    if (item.line_of_defense && Object.hasOwn(grouped, item.line_of_defense)) {
      grouped[item.line_of_defense].push(item)
    }
  }
  return grouped
}

interface ItemRowProps {
  entityType: EntityKind
  id: string
  title: string
  meta: string
  severity: SeverityLevel
  currentLine: LineOfDefense | null
  canReassign: boolean
  isPending: boolean
  onReassign: (entityType: EntityKind, id: string, line: LineOfDefense) => void
  // aexa-frontend#532: the only way to act on an item here was reassigning
  // its line -- there was no way to drill into the record itself. Optional
  // since Compliance and Audit have no per-record detail page (aexa-frontend
  // #561) -- their rows link to their respective list instead, same scope
  // discipline as #529/#530/#531 rather than building pages just for this
  // back-link.
  linkTo?: string
}

// quality-bar-loop round 3 (efficiency, round-1 finding): wrapped in
// React.memo -- combined with `onReassign` now being the single stable
// top-level `reassign` callback (see useCallback below) instead of a fresh
// per-item closure, clicking one row's reassign button (which only changes
// `pendingIds`) now re-renders just that row and the row leaving pending
// state, not all 20-30+ rows on the board.
const ItemRow = memo(function ItemRow({
  entityType,
  id,
  title,
  meta,
  severity,
  currentLine,
  canReassign,
  isPending,
  onReassign,
  linkTo,
}: ItemRowProps) {
  const { t } = useTranslation()
  const otherLines = LINES.filter((line) => line !== currentLine)

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5">
      <div className="flex min-w-0 items-start gap-1.5">
        <span
          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_STYLES[severity].dot}`}
        />
        <div className="min-w-0">
          {/* quality-bar-loop round 5 (visual polish, round-1 finding):
              single-line truncation cut titles off aggressively even at
              1460px width, relying entirely on a hover-only tooltip.
              line-clamp-2 shows meaningfully more of the title before
              falling back to the tooltip for the rare longer case. */}
          {linkTo ? (
            <Link
              to={linkTo}
              className="focus-ring line-clamp-2 text-xs font-medium text-foreground hover:underline"
              title={title}
            >
              {title}
            </Link>
          ) : (
            <p className="line-clamp-2 text-xs font-medium" title={title}>
              {title}
            </p>
          )}
          <p className="truncate text-[11px] text-muted-foreground">{meta}</p>
        </div>
      </div>
      {canReassign && (
        // quality-bar-loop round 4 (UX, round-1 finding): with
        // GOVERNING_BODY added as a 4th line, an item can have up to 3
        // "move to" destinations, each previously rendered as its own
        // icon-only button using the SAME ArrowRight icon -- the only
        // way to tell them apart was hovering for a tooltip, a
        // live-confirmed real friction point ("which one do I click").
        // Reference tools solve this class of problem (moving a card/
        // ticket between a small set of named buckets) with a single
        // trigger that opens a menu of clearly-labeled destinations --
        // Jira's status-transition dropdown, Trello's "Move" card
        // action, Asana's "Move to section" menu -- rather than N
        // identical icon buttons. One `DropdownMenu` (this codebase's
        // existing pattern, e.g. CompliancePage's row-actions menu)
        // replaces the ambiguous button row: the trigger is a single
        // 44px touch target (also fixing the up-to-3-buttons mobile
        // crowding this row used to have), and each destination is a
        // real text label in the menu, not a guess from an icon.
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={isPending}
              aria-label={t("organization.threeLinesOfDefense.moveItem", {
                title,
              })}
              className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-3 w-3" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {otherLines.map((line) => (
              <DropdownMenuItem
                key={line}
                onClick={() => onReassign(entityType, id, line)}
              >
                {t(MOVE_TO_KEY[line])}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
})

// Deliberately NOT wrapped in React.memo: every call site passes
// `children` as an inline `{list.map(...)}` JSX expression, which is a
// fresh array reference on every parent render regardless of whether the
// underlying list changed -- memo's shallow prop comparison would never
// see `children` as equal, so the wrapper would only add a comparison
// cost with no skipped re-renders. ItemRow's own React.memo (above) is
// what actually skips reconciliation for unaffected rows.
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
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </h3>
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

// quality-bar-loop round 6 (industry-standards, round-1 finding).
// Review round 1 (angle B) found --chart-2 (199°) and --chart-3 (38°)
// are color-IDENTICAL to --risk-info and --risk-medium (src/index.css)
// -- this page renders SEVERITY_STYLES dots using those exact risk
// colors on every item row directly below this bar, so reusing the
// full chart-1..4 set would make a line-color segment indistinguishable
// from an unrelated severity indicator on the same screen. Keeps
// --chart-1 (168°, teal) and --chart-4 (280°, purple), which don't
// collide with any --risk-* hue (0°/38°/142°/199°), and replaces the
// two colliding slots with new literal hues (250° indigo, 320°
// magenta) chosen to stay >=25 degrees clear of every --risk-* hue and
// of the two chart-N hues kept above.
const LINE_CHART_COLOR: Record<LineOfDefense, string> = {
  FIRST: "bg-chart-1",
  SECOND: "bg-[hsl(250_70%_60%)]",
  THIRD: "bg-[hsl(320_65%_55%)]",
  GOVERNING_BODY: "bg-chart-4",
}

// quality-bar-loop round 6 (industry-standards, round-1 finding): the
// IIA Three Lines Model's central diagnostic question -- "is 3rd line
// (independent assurance) reviewing enough of what 1st/2nd line
// (operations/risk-management) own" -- was previously only answerable
// by manually counting raw per-column totals across 4 separate cards.
// A proportional coverage bar per entity type makes the actual
// distribution visible at a glance, the same way real GRC/audit tools
// (e.g. AuditBoard's coverage dashboards, TeamMate+'s risk-coverage
// views) surface this as a first-class summary rather than leaving it
// to the reader to tally.
function CoverageOverview({
  rows,
}: {
  rows: { labelKey: string; unclassifiedCount?: number; byLine: Record<LineOfDefense, unknown[]> }[]
}) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-sm font-medium">
          {t("organization.threeLinesOfDefense.coverage.title")}
        </h2>
        <CardDescription>
          {t("organization.threeLinesOfDefense.coverage.subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {rows.map((row) => {
          const total = LINES.reduce(
            (sum, line) => sum + row.byLine[line].length,
            0
          )
          return (
            <div key={row.labelKey} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-[11px] text-muted-foreground">
                {t(row.labelKey)}
              </span>
              {total === 0 ? (
                <span className="flex-1 text-[11px] text-muted-foreground">
                  {t("organization.threeLinesOfDefense.coverage.none")}
                </span>
              ) : (
                <div
                  role="img"
                  aria-label={LINES.filter((line) => row.byLine[line].length > 0)
                    .map(
                      (line) =>
                        `${t(LINE_TITLE_KEY[line])}: ${row.byLine[line].length}`
                    )
                    .join(", ")}
                  className="flex h-3.5 flex-1 overflow-hidden rounded-full bg-muted"
                >
                  {LINES.map((line) => {
                    const count = row.byLine[line].length
                    if (count === 0) return null
                    return (
                      <div
                        key={line}
                        title={`${t(LINE_TITLE_KEY[line])}: ${count}`}
                        className={`h-full ${LINE_CHART_COLOR[line]}`}
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    )
                  })}
                </div>
              )}
              <span className="w-16 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                {total}
                {!!row.unclassifiedCount &&
                  ` (+${row.unclassifiedCount})`}
              </span>
            </div>
          )
        })}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          {LINES.map((line) => (
            <span
              key={line}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span
                className={`h-2 w-2 rounded-full ${LINE_CHART_COLOR[line]}`}
              />
              {t(LINE_TITLE_KEY[line])}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
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

  const { data, isLoading, isFetching, isError, refetch } =
    useGetThreeLinesOfDefenseQuery()
  const [updateRisk] = useUpdateRiskMutation()
  const [updateFindingById] = useUpdateFindingByIdMutation()
  const [updateKri] = useUpdateKriMutation()
  const [updateCompliance] = useUpdateComplianceMutation()
  const [updateAuditEngagement] = useUpdateAuditEngagementMutation()

  // quality-bar-loop round 8 (resilience, round-7 finding): a single
  // `string | null` let a second reassign (row B) overwrite the first
  // (row A) before row A's mutation settled, re-enabling row A's button
  // while its request was still in flight -- risking a duplicate
  // reassignment. A Set tracks every in-flight id independently; each
  // row's own `isPending` (`pendingIds.has(id)`) only flips when that
  // row's own request starts/ends, so ItemRow's React.memo (above) still
  // skips re-rendering unrelated rows -- same optimization, just correct
  // for concurrent reassigns now.
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
    () => new Set()
  )

  useEffect(() => {
    if (isError) {
      toast.error(t("organization.threeLinesOfDefense.loadFailed"))
    }
  }, [isError, t])

  // quality-bar-loop round 3 (efficiency, round-1 finding): the `?? []`
  // fallback creates a fresh array reference every render (matching the
  // same gap found on KriDashboardPage round 3) -- memoized here so
  // `groupByLine` below only recomputes when `data` itself changes, not on
  // every unrelated re-render (e.g. a pendingIds update from an unrelated
  // row's reassign click).
  const risks = useMemo(() => data?.data?.risks ?? [], [data])
  const actions = useMemo(() => data?.data?.actions ?? [], [data])
  const kris = useMemo(() => data?.data?.kris ?? [], [data])
  const complianceObligations = useMemo(
    () => data?.data?.complianceObligations ?? [],
    [data]
  )
  const auditEngagements = useMemo(
    () => data?.data?.auditEngagements ?? [],
    [data]
  )

  const { classifiedActions, unclassifiedActions } = useMemo(() => {
    const classified: typeof actions = []
    const unclassified: typeof actions = []
    for (const action of actions) {
      ;(action.line_of_defense !== null ? classified : unclassified).push(
        action
      )
    }
    return { classifiedActions: classified, unclassifiedActions: unclassified }
  }, [actions])

  const risksByLine = useMemo(() => groupByLine(risks), [risks])
  const actionsByLine = useMemo(
    () => groupByLine(classifiedActions),
    [classifiedActions]
  )
  const krisByLine = useMemo(() => groupByLine(kris), [kris])
  const complianceByLine = useMemo(
    () => groupByLine(complianceObligations),
    [complianceObligations]
  )
  const auditsByLine = useMemo(
    () => groupByLine(auditEngagements),
    [auditEngagements]
  )

  // quality-bar-loop round 6 (industry-standards, round-1 finding): one
  // row per entity type for the coverage overview below. Actions use
  // `classifiedActions` (the same source `actionsByLine` is grouped
  // from) so the coverage bar's percentages reflect distribution across
  // lines, not diluted by not-yet-classified items -- the unclassified
  // count is surfaced separately via `unclassifiedCount` instead.
  const coverageRows = useMemo(
    () => [
      {
        labelKey: "organization.threeLinesOfDefense.sections.risks",
        byLine: risksByLine,
      },
      {
        labelKey: "organization.threeLinesOfDefense.sections.actions",
        byLine: actionsByLine,
        unclassifiedCount: unclassifiedActions.length,
      },
      {
        labelKey: "organization.threeLinesOfDefense.sections.kris",
        byLine: krisByLine,
      },
      {
        labelKey: "organization.threeLinesOfDefense.sections.compliance",
        byLine: complianceByLine,
      },
      {
        labelKey: "organization.threeLinesOfDefense.sections.audits",
        byLine: auditsByLine,
      },
    ],
    [
      risksByLine,
      actionsByLine,
      unclassifiedActions.length,
      krisByLine,
      complianceByLine,
      auditsByLine,
    ]
  )

  // quality-bar-loop round 3 (efficiency, round-1 finding): wrapped in
  // useCallback so ItemRow receives a stable `onReassign` reference across
  // renders -- required for ItemRow's new React.memo (above) to actually
  // skip re-rendering unaffected rows. The RTK Query mutation triggers
  // (updateRisk etc.) are themselves stable references, so this callback's
  // identity only changes if `t` changes (i18n language switch).
  const reassign = useCallback(
    async (entityType: EntityKind, id: string, line: LineOfDefense) => {
      setPendingIds((prev) => new Set(prev).add(id))
      try {
        switch (entityType) {
          case "risk":
            await updateRisk({ id, data: { line_of_defense: line } }).unwrap()
            break
          case "action":
            await updateFindingById({
              id,
              body: { line_of_defense: line },
            }).unwrap()
            break
          case "kri":
            await updateKri({ id, data: { line_of_defense: line } }).unwrap()
            break
          case "compliance":
            await updateCompliance({
              id,
              data: { line_of_defense: line },
            }).unwrap()
            break
          case "audit":
            await updateAuditEngagement({
              id,
              data: { line_of_defense: line },
            }).unwrap()
            break
        }
        toast.success(
          t("organization.threeLinesOfDefense.toast.reassignSuccess")
        )
      } catch (err) {
        toast.error(
          getErrorMessage(
            err,
            t("organization.threeLinesOfDefense.toast.reassignFailed")
          )
        )
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [
      updateRisk,
      updateFindingById,
      updateKri,
      updateCompliance,
      updateAuditEngagement,
      t,
    ]
  )

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
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
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-destructive">
            {t("organization.threeLinesOfDefense.loadFailed")}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-11 items-center gap-1.5 rounded-md border border-destructive/30 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isFetching
              ? t("organization.threeLinesOfDefense.retrying")
              : t("organization.threeLinesOfDefense.retry")}
          </button>
        </div>
      ) : (
        <>
          <CoverageOverview rows={coverageRows} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {LINES.map((line) => {
              const lineRisks = risksByLine[line]
              const lineActions = actionsByLine[line]
              const lineKris = krisByLine[line]
              const lineCompliance = complianceByLine[line]
              const lineAudits = auditsByLine[line]
              const totalCount =
                lineRisks.length +
                lineActions.length +
                lineKris.length +
                lineCompliance.length +
                lineAudits.length

              return (
                <Card key={line}>
                  <CardHeader>
                    <h2 className="font-heading text-sm font-medium">
                      {t(LINE_TITLE_KEY[line])}
                    </h2>
                    <CardDescription>
                      {t("organization.threeLinesOfDefense.itemCount", {
                        count: totalCount,
                      })}
                    </CardDescription>
                  </CardHeader>
                  {/* quality-bar-loop round 5 (visual polish, round-1
                      finding): live-observed severe column imbalance --
                      up to 23 items in one line vs. 2-3 in others, equal-
                      width columns with no independent scroll meant the
                      whole grid row stretched to the tallest column,
                      leaving large dead whitespace under short ones.
                      Bounding each column's own height and scrolling
                      internally (same pattern already used for other
                      long lists on this session's pages, e.g.
                      CorrelationMatrixPage's panels) keeps every column
                      a consistent height regardless of item count. */}
                  <CardContent className="max-h-[560px] overflow-y-auto">
                    <Section
                      icon={Shield}
                      label={t(
                        "organization.threeLinesOfDefense.sections.risks"
                      )}
                      count={lineRisks.length}
                      emptyLabel={t("organization.threeLinesOfDefense.empty")}
                    >
                      {lineRisks.map((risk) => (
                        <ItemRow
                          key={risk.id}
                          entityType="risk"
                          id={risk.id}
                          title={risk.title}
                          meta={`${riskCategoryLabel(t, risk.category)} · ${getEnumLabel(t, RISK_STATUS_LABEL_KEYS, risk.status)}`}
                          severity={
                            RISK_STATUS_SEVERITY[risk.status] ?? "neutral"
                          }
                          currentLine={risk.line_of_defense}
                          canReassign={canReassignRisk}
                          isPending={pendingIds.has(risk.id)}
                          onReassign={reassign}
                          linkTo={`/organization/risks/${risk.id}`}
                        />
                      ))}
                    </Section>

                    <Section
                      icon={AlertTriangle}
                      label={t(
                        "organization.threeLinesOfDefense.sections.actions"
                      )}
                      count={lineActions.length}
                      emptyLabel={t("organization.threeLinesOfDefense.empty")}
                    >
                      {lineActions.map((action) => (
                        <ItemRow
                          key={action.id}
                          entityType="action"
                          id={action.id}
                          title={action.title}
                          meta={`${getEnumLabel(t, FINDING_PRIORITY_LABEL_KEYS, action.priority)} · ${getEnumLabel(t, FINDING_STATUS_LABEL_KEYS, action.status)}`}
                          severity={
                            ACTION_STATUS_SEVERITY[action.status] ?? "neutral"
                          }
                          currentLine={action.line_of_defense}
                          canReassign={canReassignAction}
                          isPending={pendingIds.has(action.id)}
                          onReassign={reassign}
                          linkTo={`/organization/finding/${action.id}`}
                        />
                      ))}
                    </Section>

                    <Section
                      icon={Activity}
                      label={t(
                        "organization.threeLinesOfDefense.sections.kris"
                      )}
                      count={lineKris.length}
                      emptyLabel={t("organization.threeLinesOfDefense.empty")}
                    >
                      {lineKris.map((kri) => (
                        <ItemRow
                          key={kri.id}
                          entityType="kri"
                          id={kri.id}
                          title={kri.title}
                          meta={`${kri.unit} · ${getEnumLabel(t, KRI_STATUS_LABEL_KEYS, kri.status)}`}
                          severity={
                            KRI_STATUS_SEVERITY[kri.status] ?? "neutral"
                          }
                          currentLine={kri.line_of_defense}
                          canReassign={canReassignKri}
                          isPending={pendingIds.has(kri.id)}
                          onReassign={reassign}
                          linkTo={`/organization/kri?highlight=${encodeURIComponent(kri.id)}`}
                        />
                      ))}
                    </Section>

                    <Section
                      icon={Scale}
                      label={t(
                        "organization.threeLinesOfDefense.sections.compliance"
                      )}
                      count={lineCompliance.length}
                      emptyLabel={t("organization.threeLinesOfDefense.empty")}
                    >
                      {lineCompliance.map((obligation) => (
                        <ItemRow
                          key={obligation.id}
                          entityType="compliance"
                          id={obligation.id}
                          title={obligation.title}
                          meta={`${complianceDomainLabel(t, obligation.domain)} · ${getEnumLabel(t, COMPLIANCE_STATUS_LABEL_KEYS, obligation.status)}`}
                          severity={
                            COMPLIANCE_STATUS_SEVERITY[obligation.status] ??
                            "neutral"
                          }
                          currentLine={obligation.line_of_defense}
                          canReassign={canReassignCompliance}
                          isPending={pendingIds.has(obligation.id)}
                          onReassign={reassign}
                          // aexa-frontend#561: this was the only one of the
                          // 5 entity sections on this board with no linkTo
                          // at all. CompliancePage has no per-obligation
                          // route or ?search= support of its own (unlike
                          // SitesEntities), so this links to the list, same
                          // as Audit's own linkTo below.
                          linkTo="/organization/compliance"
                        />
                      ))}
                    </Section>

                    <Section
                      icon={ClipboardCheck}
                      label={t(
                        "organization.threeLinesOfDefense.sections.audits"
                      )}
                      count={lineAudits.length}
                      emptyLabel={t("organization.threeLinesOfDefense.empty")}
                    >
                      {lineAudits.map((engagement) => (
                        <ItemRow
                          key={engagement.id}
                          entityType="audit"
                          id={engagement.id}
                          title={engagement.title}
                          meta={`${engagement.lead_auditor ?? t("organization.threeLinesOfDefense.noLeadAuditor")} · ${getEnumLabel(t, AUDIT_ENGAGEMENT_STATUS_LABEL_KEYS, engagement.status)}`}
                          severity={
                            AUDIT_STATUS_SEVERITY[engagement.status] ??
                            "neutral"
                          }
                          currentLine={engagement.line_of_defense}
                          canReassign={canReassignAudit}
                          isPending={pendingIds.has(engagement.id)}
                          onReassign={reassign}
                          // AuditPage has no per-engagement URL/route -- it
                          // opens engagements in an edit modal driven by
                          // local state, not a navigable id. Links to the
                          // list rather than nothing.
                          linkTo="/organization/audit"
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
              <h2 className="font-heading text-sm font-medium">
                {t("organization.threeLinesOfDefense.unclassified.title")}
              </h2>
              <CardDescription>
                {t("organization.threeLinesOfDefense.unclassified.subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Section
                icon={AlertTriangle}
                label={t("organization.threeLinesOfDefense.sections.actions")}
                count={unclassifiedActions.length}
                emptyLabel={t(
                  "organization.threeLinesOfDefense.unclassified.empty"
                )}
              >
                {unclassifiedActions.map((action) => (
                  <ItemRow
                    key={action.id}
                    entityType="action"
                    id={action.id}
                    title={action.title}
                    meta={`${getEnumLabel(t, FINDING_PRIORITY_LABEL_KEYS, action.priority)} · ${getEnumLabel(t, FINDING_STATUS_LABEL_KEYS, action.status)}`}
                    severity={
                      ACTION_STATUS_SEVERITY[action.status] ?? "neutral"
                    }
                    currentLine={null}
                    canReassign={canReassignAction}
                    isPending={pendingIds.has(action.id)}
                    onReassign={reassign}
                    linkTo={`/organization/finding/${action.id}`}
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
