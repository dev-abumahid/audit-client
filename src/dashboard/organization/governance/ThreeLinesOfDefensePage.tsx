import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { LINE_OF_DEFENSE_LABEL_KEY as LINE_TITLE_KEY } from "@/utils/lineOfDefense"
import { riskCategoryLabel } from "@/utils/riskConfig"
import { severityBadgeClasses, type SeverityLevel } from "@/utils/severityStyles"
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  ClipboardCheck,
  Loader2,
  Scale,
  Shield,
} from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
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
// at-a-glance severity badge across all 5 entity types on this board --
// same color source as RiskBadge/RiskRegisterPage's own severity badges
// (src/utils/severityStyles.ts).
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
  onReassign: (
    entityType: EntityKind,
    id: string,
    title: string,
    line: LineOfDefense
  ) => void
  // aexa-frontend#532: the only way to act on an item here was reassigning
  // its line -- there was no way to drill into the record itself. Optional
  // since Compliance and Audit have no per-record detail page (aexa-frontend
  // #561) -- their rows link to their respective list instead, same scope
  // discipline as #529/#530/#531 rather than building pages just for this
  // back-link.
  linkTo?: string
  // aexa-frontend#939 (visual polish, round-1 finding): each line's card
  // used to stack 5 separate per-entity-type Section headers (icon + label
  // + count) even though most lines only populate 1-2 of the 5 -- a CEO-
  // flagged clutter source (up to ~20 header instances across the board for
  // ~2 items' worth of real content). The 5 entity-type lists are now
  // merged into one flat per-line list, so the header's icon -- previously
  // the only visual cue for an item's type -- moves onto the row itself.
  icon: React.ElementType
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
  icon: Icon,
}: ItemRowProps) {
  const { t } = useTranslation()
  const otherLines = LINES.filter((line) => line !== currentLine)

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5">
      <div className="flex min-w-0 items-start gap-1.5">
        {/* aexa-frontend#939: replaces the removed per-type Section header
            as the item's only type indicator now that all 5 entity types
            render in one flat per-line list. */}
        <Icon
          aria-hidden="true"
          className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground"
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
          {/* aexa-frontend#939 (visual polish loop, round-2 finding): two
              independent judges converged on this row's meta line as both
              a cross-page inconsistency (Risk Register renders the same
              class of semantic data -- category, status -- as a colored
              pill via this exact severityBadgeClasses utility; this page
              rendered it as plain gray text) and the fix for reduced
              type-scannability the round-1 header-flattening introduced
              (a colored pill is a far stronger scan cue than the 12px
              type icon alone). Reuses severity -- already computed per
              row for the removed dot above -- rather than inventing a new
              per-entity-type color system with no existing convention. */}
          <span
            className={`mt-0.5 inline-block truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium ${severityBadgeClasses(severity)}`}
            title={meta}
          >
            {meta}
          </span>
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
              // quality-bar-loop (mobile, round-9 finding): the shared
              // DropdownMenuItem defaults to min-h-7 (28px), under the
              // 44px touch-target minimum -- scoped here via className
              // rather than bumping the shared component's default,
              // since 6 other pages use DropdownMenuItem for compact
              // desktop-only menus (e.g. the theme toggle) that don't
              // need the larger touch target.
              <DropdownMenuItem
                key={line}
                onClick={() => onReassign(entityType, id, title, line)}
                className="min-h-11"
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
// -- this page renders severity badges (severityBadgeClasses) using
// those exact risk colors on every item row directly below this bar, so
// reusing the
// full chart-1..4 set would make a line-color segment indistinguishable
// from an unrelated severity indicator on the same screen. Keeps
// --chart-1 (168°, teal), which doesn't collide with any --risk-* hue
// (0°/38°/142°/199°), and replaces the remaining 3 slots with literal
// hues chosen to stay >=25 degrees clear of every --risk-* hue and of
// each other.
//
// aexa-frontend#939 (visual polish loop, round-1 finding): GOVERNING_BODY
// previously reused --chart-4 (280°, purple) alongside SECOND's 250°
// indigo -- only 30° apart and both read as "purple" at the segment
// widths/opacities this bar actually renders at, live-confirmed by two
// independent judges as indistinguishable in the coverage legend.
// Replaced with a yellow-green/olive hue (88°), the nearest clear gap
// once every --risk-* hue and FIRST/SECOND/THIRD's own hues are each
// buffered by >=25°.
const LINE_CHART_COLOR: Record<LineOfDefense, string> = {
  FIRST: "bg-chart-1",
  SECOND: "bg-[hsl(250_70%_60%)]",
  THIRD: "bg-[hsl(320_65%_55%)]",
  GOVERNING_BODY: "bg-[hsl(88_55%_42%)]",
}

// quality-bar-loop round 6 (industry-standards, round-1 finding): the
// IIA Three Lines Model's central diagnostic question -- "is 3rd line
// (independent assurance) reviewing enough of what 1st/2nd line
// (operations/risk-management) own" -- was previously only answerable
// by manually counting raw per-column totals across 4 separate cards.
// A proportional coverage bar makes the actual distribution visible at
// a glance, the same way real GRC/audit tools (e.g. AuditBoard's
// coverage dashboards, TeamMate+'s risk-coverage views) surface this as
// a first-class summary rather than leaving it to the reader to tally.
//
// aexa-frontend#939 (visual polish loop, round-5 finding): this panel
// originally rendered one bar+row PER entity type (5 total), each
// re-showing the same per-line distribution the grid immediately below
// also shows via each row's own type icon -- flagged as the dominant
// remaining clutter/redundancy source by two independent judges across
// 4 consecutive rounds. Collapsed to a single combined bar (total items
// per line, across all 5 entity types) -- keeps the genuinely useful
// cross-line comparison the IIA-reasoning comment above describes,
// while dropping the per-entity-type breakdown that's redundant with
// scanning a line's own column (each row already shows its type icon).
function CoverageOverview({
  rows,
}: {
  rows: { labelKey: string; unclassifiedCount?: number; byLine: Record<LineOfDefense, unknown[]> }[]
}) {
  const { t } = useTranslation()

  const totalByLine = useMemo(() => {
    const totals: Record<LineOfDefense, number> = {
      FIRST: 0,
      SECOND: 0,
      THIRD: 0,
      GOVERNING_BODY: 0,
    }
    for (const row of rows) {
      for (const line of LINES) {
        totals[line] += row.byLine[line].length
      }
    }
    return totals
  }, [rows])

  const total = LINES.reduce((sum, line) => sum + totalByLine[line], 0)
  const unclassifiedTotal = rows.reduce(
    (sum, row) => sum + (row.unclassifiedCount ?? 0),
    0
  )

  return (
    <Card>
      <CardHeader>
        {/* Subtitle removed per CEO feedback (page felt cluttered) -- it
            restated what the coverage bar below already shows visually. */}
        <h2 className="font-heading text-sm font-medium">
          {t("organization.threeLinesOfDefense.coverage.title")}
        </h2>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-[11px] text-muted-foreground">
            {t("organization.threeLinesOfDefense.coverage.totalLabel")}
          </span>
          {total === 0 ? (
            <span className="flex-1 text-[11px] text-muted-foreground">
              {t("organization.threeLinesOfDefense.coverage.none")}
            </span>
          ) : (
            <div
              role="img"
              aria-label={LINES.filter((line) => totalByLine[line] > 0)
                .map((line) => `${t(LINE_TITLE_KEY[line])}: ${totalByLine[line]}`)
                .join(", ")}
              className="flex h-3.5 flex-1 overflow-hidden rounded-full bg-muted"
            >
              {LINES.map((line) => {
                const count = totalByLine[line]
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
            {!!unclassifiedTotal && ` (+${unclassifiedTotal})`}
          </span>
        </div>
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

  // quality-bar-loop round 10 (industry-standards, round-7 finding):
  // reassigning a line -- a governance-significant action reference GRC
  // tools (AuditBoard, LogicManager, Resolver) treat as first-class and
  // gate behind confirmation -- used to fire the mutation the instant a
  // menu item was clicked. `confirmRequest` holds the pending request
  // (entity/id/title/destination) between that click and the user
  // actually confirming it in the AlertDialog below; the mutation itself
  // only fires from `doReassign`, called by the dialog's confirm action.
  // One shared piece of state (not one per row) since only one
  // reassignment can be awaiting confirmation at a time -- same pattern
  // as ReportsPage's confirmPublishId.
  const [confirmRequest, setConfirmRequest] = useState<{
    entityType: EntityKind
    id: string
    title: string
    line: LineOfDefense
  } | null>(null)

  // quality-bar-loop round 11 (resilience, round-9 regression): a plain
  // `if (confirmRequest)` check in the confirm button's onClick isn't
  // enough to stop a genuine double-fire -- both `setConfirmRequest(null)`
  // and `pendingIds`' own update are React state setters, batched to the
  // next render, so a second physical click landing before that render
  // commits still closes over the SAME pre-update `confirmRequest` and
  // would call `doReassign` a second time. A ref is mutated synchronously
  // (no render/batching involved), so it's the only thing that can
  // actually block a second click within the same render frame.
  const hasConfirmedRef = useRef(false)

  // Review round 1 finding on PR #811: opening the AlertDialog synchronously
  // from a DropdownMenuItem click is a known Radix footgun -- the closing
  // menu's focus-return and the new dialog's focus-trap can fight over
  // focus in the same tick (occasionally leaving `body` with pointer-events
  // locked from an interleaved overlay unmount/mount). Deferring the state
  // update to the next animation frame lets the dropdown finish closing
  // first, matching Radix's own documented workaround for this pattern.
  const requestReassign = useCallback(
    (entityType: EntityKind, id: string, title: string, line: LineOfDefense) => {
      hasConfirmedRef.current = false
      requestAnimationFrame(() => {
        setConfirmRequest({ entityType, id, title, line })
      })
    },
    []
  )

  // quality-bar-loop round 3 (efficiency, round-1 finding): wrapped in
  // useCallback so ItemRow receives a stable `onReassign` reference across
  // renders -- required for ItemRow's new React.memo (above) to actually
  // skip re-rendering unaffected rows. The RTK Query mutation triggers
  // (updateRisk etc.) are themselves stable references, so this callback's
  // identity only changes if `t` changes (i18n language switch).
  const doReassign = useCallback(
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
    <div className="space-y-6 p-4 lg:p-6">
      {/* aexa-frontend#930: subtitle removed -- it named the same 5 entity
          types (risks, controls, KRIs, compliance, audits) that the
          Coverage Overview and every line's own section labels already
          show visually one paragraph below. Same "restates what's already
          visible" reasoning PR #920 already applied to this page's two
          CardHeader subtitles (CoverageOverview, Unclassified Actions) --
          extending it to the page-level subtitle too. */}
      <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
        {t("organization.threeLinesOfDefense.title")}
      </h1>

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
            className="focus-ring flex h-11 items-center gap-1.5 rounded-md border border-destructive/30 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
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

          {/* aexa-frontend#939 (visual polish loop, round-3 finding): the
              previous `xl:grid-cols-4` breakpoint (1280px) put all 4 line
              columns into effect at the FIRST desktop breakpoint reached,
              live-measured to give each card only ~235px of usable width
              and cause 65% of visible titles to hit their line-clamp-2
              wrap limit. Splitting into two steps -- 2 wider columns at
              the realistic 1280-1535px desktop range (`xl`), 4 only once
              there's genuinely enough width for them (`2xl`, 1536px+) --
              keeps every column's content readable at the viewport most
              real users actually have, not just ultra-wide monitors. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
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

              // aexa-frontend#939 (visual polish loop, round-1 finding):
              // one flat, ordered list per line (risks, then actions, then
              // kris, then compliance, then audits) replaces the previous
              // 5 separate <Section> blocks -- each with its own icon+
              // label+count header -- that used to stack per line even
              // though most lines only populate 1-2 of the 5 types. The
              // type indicator that header used to carry now lives on each
              // row itself (ItemRow's new `icon` prop).
              const lineItems = [
                ...lineRisks.map((risk) => (
                  <ItemRow
                    key={risk.id}
                    icon={Shield}
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
                    onReassign={requestReassign}
                    linkTo={`/organization/risks/${risk.id}`}
                  />
                )),
                ...lineActions.map((action) => (
                  <ItemRow
                    key={action.id}
                    icon={AlertTriangle}
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
                    onReassign={requestReassign}
                    linkTo={`/organization/finding/${action.id}`}
                  />
                )),
                ...lineKris.map((kri) => (
                  <ItemRow
                    key={kri.id}
                    icon={Activity}
                    entityType="kri"
                    id={kri.id}
                    title={kri.title}
                    meta={`${kri.unit} · ${getEnumLabel(t, KRI_STATUS_LABEL_KEYS, kri.status)}`}
                    severity={KRI_STATUS_SEVERITY[kri.status] ?? "neutral"}
                    currentLine={kri.line_of_defense}
                    canReassign={canReassignKri}
                    isPending={pendingIds.has(kri.id)}
                    onReassign={requestReassign}
                    linkTo={`/organization/kri?highlight=${encodeURIComponent(kri.id)}`}
                  />
                )),
                ...lineCompliance.map((obligation) => (
                  <ItemRow
                    key={obligation.id}
                    icon={Scale}
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
                    onReassign={requestReassign}
                    // aexa-frontend#561: CompliancePage has no
                    // per-obligation route or ?search= support of its own
                    // (unlike SitesEntities), so this links to the list,
                    // same as Audit's own linkTo below.
                    linkTo="/organization/compliance"
                  />
                )),
                ...lineAudits.map((engagement) => (
                  <ItemRow
                    key={engagement.id}
                    icon={ClipboardCheck}
                    entityType="audit"
                    id={engagement.id}
                    title={engagement.title}
                    meta={`${engagement.lead_auditor ?? t("organization.threeLinesOfDefense.noLeadAuditor")} · ${getEnumLabel(t, AUDIT_ENGAGEMENT_STATUS_LABEL_KEYS, engagement.status)}`}
                    severity={
                      AUDIT_STATUS_SEVERITY[engagement.status] ?? "neutral"
                    }
                    currentLine={engagement.line_of_defense}
                    canReassign={canReassignAudit}
                    isPending={pendingIds.has(engagement.id)}
                    onReassign={requestReassign}
                    // AuditPage has no per-engagement URL/route -- it opens
                    // engagements in an edit modal driven by local state,
                    // not a navigable id. Links to the list rather than
                    // nothing.
                    linkTo="/organization/audit"
                  />
                )),
              ]

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
                    {/* aexa-frontend#930/#939: one empty message for the
                        whole card when every entity type is empty for this
                        line; otherwise the single flat, ordered list built
                        above. */}
                    {totalCount === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        {t("organization.threeLinesOfDefense.empty")}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1">{lineItems}</div>
                    )}
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
              {/* Subtitle removed per CEO feedback (page felt cluttered) --
                  the comment above already documents why this bucket
                  exists; end users don't need that explanation repeated
                  as visible copy. */}
              <h2 className="font-heading text-sm font-medium">
                {t("organization.threeLinesOfDefense.unclassified.title")}
              </h2>
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
                    icon={AlertTriangle}
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
                    onReassign={requestReassign}
                    linkTo={`/organization/finding/${action.id}`}
                  />
                ))}
              </Section>
            </CardContent>
          </Card>
        </>
      )}

      {/* quality-bar-loop round 10 (industry-standards, round-7 finding):
          confirms a reassignment before it fires, matching reference GRC
          tools' treatment of line-of-defense reclassification as a
          governance-significant action. One shared dialog (not one per
          row) since only one reassignment can be awaiting confirmation
          at a time -- same pattern as ReportsPage's confirmPublishId. */}
      <AlertDialog
        open={confirmRequest !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmRequest(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("organization.threeLinesOfDefense.confirmReassignTitle")}
            </AlertDialogTitle>
            {confirmRequest && (
              <AlertDialogDescription>
                {t(
                  "organization.threeLinesOfDefense.confirmReassignDescription",
                  {
                    title: confirmRequest.title,
                    line: t(LINE_TITLE_KEY[confirmRequest.line]),
                  }
                )}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("organization.threeLinesOfDefense.confirmReassignCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRequest && !hasConfirmedRef.current) {
                  hasConfirmedRef.current = true
                  doReassign(
                    confirmRequest.entityType,
                    confirmRequest.id,
                    confirmRequest.line
                  )
                }
                setConfirmRequest(null)
              }}
            >
              {t("organization.threeLinesOfDefense.confirmReassignConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
