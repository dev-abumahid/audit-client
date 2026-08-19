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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMyOrgRole } from "@/hooks/useMyOrgRole"
import {
  useRecordAuditEngagementLineReviewMutation,
  useUpdateAuditEngagementMutation,
} from "@/redux/apis/organization/audit.api"
import {
  useRecordComplianceLineReviewMutation,
  useUpdateComplianceMutation,
} from "@/redux/apis/organization/compliance.api"
import {
  useRecordFindingLineReviewMutation,
  useUpdateFindingByIdMutation,
} from "@/redux/apis/organization/findings.api"
import {
  useGetThreeLinesOfDefenseQuery,
  type LineReview,
} from "@/redux/apis/organization/governance.api"
import {
  useRecordKriLineReviewMutation,
  useUpdateKriMutation,
} from "@/redux/apis/organization/kri.api"
import {
  useRecordRiskLineReviewMutation,
  useUpdateRiskMutation,
} from "@/redux/apis/organization/risk.api"
import type { LineOfDefense } from "@/types/organization"
import { COMPLIANCE_DOMAINS } from "@/utils/complianceConfig"
import { getEnumLabel } from "@/utils/enumLabel"
import {
  FINDING_PRIORITY_LABEL_KEYS,
  FINDING_STATUS_LABEL_KEYS,
} from "@/utils/findingLabels"
import { LINE_OF_DEFENSE_LABEL_KEY as LINE_TITLE_KEY } from "@/utils/lineOfDefense"
import { RISK_CATEGORIES, riskCategoryLabel } from "@/utils/riskConfig"
import { severityBadgeClasses, type SeverityLevel } from "@/utils/severityStyles"
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  ClipboardCheck,
  Loader2,
  Scale,
  Shield,
  ShieldCheck,
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

const ENTITY_KINDS: EntityKind[] = [
  "risk",
  "action",
  "kri",
  "compliance",
  "audit",
]

// Integration-axis fix (quality-bar-loop): PR #940 flattened 5 per-type
// Section blocks into one list per line to cut clutter, but the section
// headers it removed were the only way to tell entity types apart at a
// glance or filter to just one -- a line with risks, KRIs, and compliance
// obligations all mixed together had no way to isolate any of them. These
// two maps drive the per-line filter chips (LineCard below) that restore
// that without bringing back the redundant stacked headers: one row of
// small chips per line, reusing the same icon each row already carries.
const ENTITY_ICON: Record<EntityKind, React.ElementType> = {
  risk: Shield,
  action: AlertTriangle,
  kri: Activity,
  compliance: Scale,
  audit: ClipboardCheck,
}
const ENTITY_LABEL_KEY: Record<EntityKind, string> = {
  risk: "organization.threeLinesOfDefense.sections.risks",
  action: "organization.threeLinesOfDefense.sections.actions",
  kri: "organization.threeLinesOfDefense.sections.kris",
  compliance: "organization.threeLinesOfDefense.sections.compliance",
  audit: "organization.threeLinesOfDefense.sections.audits",
}

// aexa-frontend#208/#209: GOVERNING_BODY added as a 4th column -- the IIA's
// 2020 update's headline structural addition, an explicit governing body
// sitting above the three lines.
const LINES: LineOfDefense[] = ["FIRST", "SECOND", "THIRD", "GOVERNING_BODY"]

// Review round 1 (a11y): short VISIBLE label for each line's review badge
// (ItemRow) -- see that badge's own comment for why color-only dots aren't
// enough here.
const LINE_ABBR_KEY: Record<LineOfDefense, string> = {
  FIRST: "organization.threeLinesOfDefense.abbrFirst",
  SECOND: "organization.threeLinesOfDefense.abbrSecond",
  THIRD: "organization.threeLinesOfDefense.abbrThird",
  GOVERNING_BODY: "organization.threeLinesOfDefense.abbrGoverningBody",
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

// #97: mirrors aexa-server's assertCanRecordLineReview/ownerRoleForLine
// (line_of_defense_review.ts) exactly -- THIRD-line review is internal
// audit's own independent check (LEAD_AUDITOR only), every other line is a
// management-line judgment call (ADMIN only). Client-side mirror only gates
// which controls render; the server re-checks this on every write.
function canRecordReviewForLine(
  line: LineOfDefense,
  role: string | undefined
): boolean {
  return line === "THIRD" ? role === "LEAD_AUDITOR" : role === "ADMIN"
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

// Cross-view integration fix (quality-bar-loop, integration axis): this
// row used to render "category · status" as ONE pill colored entirely by
// status severity -- so a risk's category (which has its own dedicated
// per-category color on RiskRegisterPage/RiskDetails.tsx, e.g. RISK_
// CATEGORIES.reputational) showed up in a color that never matched, and
// depended on that row's status rather than its category at all. Splits
// the two: `metaLabel` gets its own color when the entity type has a real
// per-value color source elsewhere in the app (risk category, compliance
// domain); otherwise it renders as plain neutral text. `statusLabel` keeps
// the severity-colored pill, which is the one thing status was actually
// supposed to drive.
function MetaPill({ label, color }: { label: string; color?: string }) {
  if (color) {
    return (
      <span
        className="inline-block truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium"
        style={{
          backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
          color,
        }}
        title={label}
      >
        {label}
      </span>
    )
  }
  return (
    <span
      className="inline-block truncate rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
      title={label}
    >
      {label}
    </span>
  )
}

interface ItemRowProps {
  entityType: EntityKind
  id: string
  title: string
  metaLabel: string
  metaColor?: string
  statusLabel: string
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
  // #97: COVERAGE, not ownership -- every line that has independently
  // reviewed this item and hasn't since been invalidated by an edit. See
  // governance.api.ts's LineReview doc comment.
  lineReviews: LineReview[]
  // Lines the CURRENT caller is permitted to record a review for (per
  // canRecordReviewForLine) -- drives which "record review" menu items
  // render, same gating discipline as canReassign above.
  myReviewableLines: LineOfDefense[]
  onRecordReview: (
    entityType: EntityKind,
    id: string,
    title: string,
    line: LineOfDefense
  ) => void
  isReviewPending: boolean
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
  metaLabel,
  metaColor,
  statusLabel,
  severity,
  currentLine,
  canReassign,
  isPending,
  onReassign,
  linkTo,
  icon: Icon,
  lineReviews,
  myReviewableLines,
  onRecordReview,
  isReviewPending,
}: ItemRowProps) {
  const { t } = useTranslation()
  const otherLines = LINES.filter((line) => line !== currentLine)
  const reviewedLines = new Set(lineReviews.map((r) => r.line))
  // Lines this caller could record a review for that DON'T already have a
  // live one -- recording again for an already-reviewed line is legitimate
  // (it just supersedes the prior one, see the backend's soft-supersede
  // behavior) but re-reviewing every unchanged item isn't the common case,
  // so only genuinely new coverage gets a menu entry.
  const recordableLines = myReviewableLines.filter(
    (line) => !reviewedLines.has(line)
  )

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
          {/* aexa-frontend#939 (visual polish loop, round-2 finding): a
              colored pill is a stronger scan cue than the 12px type icon
              alone. Now two pills, not one -- see MetaPill's own comment
              for why they're no longer merged into a single status-colored
              string. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <MetaPill label={metaLabel} color={metaColor} />
            <span
              className={`inline-block truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium ${severityBadgeClasses(severity)}`}
              title={statusLabel}
            >
              {statusLabel}
            </span>
          </div>
          {/* #97: real independent-review coverage, distinct from the
              ownership badge above -- one small badge per line that has
              actually reviewed this item, in that line's own color (same
              palette LINE_COLOR drives on the coverage overview below, so
              the two views read consistently). Nothing renders when no
              line has reviewed it yet -- an empty state here is normal for
              a brand-new item, not an error.
              Review round 1 (a11y): a bare color dot with only a `title`
              attribute has no reliable accessible name (title alone isn't
              consistently exposed by screen readers on a plain span) and,
              for a compliance tool, color-only encoding is a real gap for
              colorblind/touch/non-hovering users too -- every OTHER
              indicator on this row (category, status) shows visible text
              at all times, not color-only. Now a tiny labeled badge
              (role="img" + full aria-label, same as the coverage rings
              below) instead of a bare dot. */}
          {lineReviews.length > 0 && (
            <div className="mt-0.5 flex items-center gap-1">
              {LINES.filter((line) => reviewedLines.has(line)).map((line) => (
                <span
                  key={line}
                  role="img"
                  aria-label={t(
                    "organization.threeLinesOfDefense.reviewedByLine",
                    { line: t(LINE_TITLE_KEY[line]) }
                  )}
                  title={t("organization.threeLinesOfDefense.reviewedByLine", {
                    line: t(LINE_TITLE_KEY[line]),
                  })}
                  // Review round 2: was text-[8px]/h-3.5, a full 2px
                  // smaller than the adjacent category/status pills
                  // (text-[10px]) on the same row -- now matches them.
                  className={`inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${LINE_COLOR[line]}`}
                >
                  {t(LINE_ABBR_KEY[line])}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {(canReassign || recordableLines.length > 0) && (
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
              // Review round 2 (a11y, WCAG 2.4.3): stable id so the page's
              // shared AlertDialog can return focus here on close -- see
              // that dialog's own closeConfirmDialog comment.
              // Review round 1 follow-up: qualified by entityType, not just
              // id -- 5 different entity types render on this page at once
              // and nothing guarantees their backend ids are drawn from a
              // shared namespace; an unqualified id risked two different
              // rows (e.g. a risk and an action) colliding and misdirecting
              // focus restoration to the wrong one.
              id={`three-lines-trigger-${entityType}-${id}`}
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
            {canReassign && (
              <>
                <DropdownMenuLabel className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("organization.threeLinesOfDefense.moveToLabel")}
                </DropdownMenuLabel>
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
              </>
            )}
            {/* #97: recording that a line independently reviewed this item
                is a SEPARATE action from reassigning who owns it -- see
                lineReviews' own doc comment above. Only lines the caller is
                actually permitted to vouch for (canRecordReviewForLine)
                that don't already have a live review show up here. */}
            {recordableLines.length > 0 && (
              <>
                {canReassign && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("organization.threeLinesOfDefense.recordReviewLabel")}
                </DropdownMenuLabel>
                {recordableLines.map((line) => (
                  <DropdownMenuItem
                    key={line}
                    disabled={isReviewPending}
                    onClick={() => onRecordReview(entityType, id, title, line)}
                    className="min-h-11"
                  >
                    <ShieldCheck
                      className={`mr-1.5 h-3.5 w-3.5 shrink-0 ${LINE_COLOR_TEXT[line]}`}
                      aria-hidden="true"
                    />
                    {t("organization.threeLinesOfDefense.recordReviewFor", {
                      line: t(LINE_TITLE_KEY[line]),
                    })}
                  </DropdownMenuItem>
                ))}
              </>
            )}
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

// Integration-axis fix (quality-bar-loop): restores per-type filtering
// within a line without reintroducing the 5 stacked Section headers PR
// #940 removed. Extracted as its own component (rather than inline in the
// LINES.map below) specifically so it can hold its own `filter` state --
// each line's filter is independent, and hooks can't live inside a plain
// array-map callback.
function LineCard({
  line,
  items,
  totalCount,
}: {
  line: LineOfDefense
  items: { entityType: EntityKind; node: React.ReactNode }[]
  totalCount: number
}) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<EntityKind | "all">("all")

  const countByType = ENTITY_KINDS.reduce(
    (acc, kind) => {
      acc[kind] = items.filter((item) => item.entityType === kind).length
      return acc
    },
    {} as Record<EntityKind, number>
  )
  const presentTypes = ENTITY_KINDS.filter((kind) => countByType[kind] > 0)
  // Review round 1 on PR #957: an item can be reassigned to a different
  // line via the move menu below while this line is mid-filter -- if that
  // reassignment empties out the currently-selected type, its chip (and,
  // if it was the last non-"all" type, the whole chip row) disappears from
  // `presentTypes` above with nothing resetting `filter` back to "all".
  // Left unguarded, that's a dead end: totalCount > 0 but visibleItems is
  // empty, with no chip left to click back to "all". Falls back to "all"
  // automatically instead of rendering that state.
  const effectiveFilter =
    filter !== "all" && !presentTypes.includes(filter) ? "all" : filter
  const visibleItems =
    effectiveFilter === "all"
      ? items
      : items.filter((item) => item.entityType === effectiveFilter)

  return (
    <Card>
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
      {/* Only worth showing when a line genuinely mixes >=2 entity types --
          a single-type line (the common case) gets no redundant "All /
          Risks" toggle, keeping PR #940's declutter intent for the cases
          it was actually solving. */}
      {presentTypes.length > 1 && (
        <div
          role="group"
          aria-label={t("organization.threeLinesOfDefense.filterLabel")}
          className="flex flex-wrap gap-1 px-6 pb-3"
        >
          <FilterChip
            active={effectiveFilter === "all"}
            onClick={() => setFilter("all")}
            label={t("organization.threeLinesOfDefense.filterAll")}
            count={items.length}
          />
          {presentTypes.map((kind) => {
            const Icon = ENTITY_ICON[kind]
            return (
              <FilterChip
                key={kind}
                active={effectiveFilter === kind}
                onClick={() => setFilter(kind)}
                label={t(ENTITY_LABEL_KEY[kind])}
                count={countByType[kind]}
                icon={Icon}
              />
            )
          })}
        </div>
      )}
      {/* quality-bar-loop round 5 (visual polish, round-1 finding):
          live-observed severe column imbalance -- up to 23 items in one
          line vs. 2-3 in others, equal-width columns with no independent
          scroll meant the whole grid row stretched to the tallest column,
          leaving large dead whitespace under short ones. Bounding each
          column's own height and scrolling internally (same pattern
          already used for other long lists on this session's pages, e.g.
          CorrelationMatrixPage's panels) keeps every column a consistent
          height regardless of item count. */}
      <CardContent className="max-h-[560px] overflow-y-auto">
        {totalCount === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {t("organization.threeLinesOfDefense.empty")}
          </p>
        ) : (
          // A filter chip only ever exists for a type with count > 0
          // (presentTypes above), so selecting one can never produce an
          // empty visibleItems -- no separate "no items match this
          // filter" state is reachable here.
          <div className="flex flex-col gap-1">
            {visibleItems.map((item) => item.node)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  icon: Icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  icon?: React.ElementType
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-ring flex h-7 items-center gap-1 rounded-full border px-2 text-[10px] font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {label}
      <span
        className={`rounded-full px-1 ${active ? "bg-primary/20" : "bg-muted"}`}
      >
        {count}
      </span>
    </button>
  )
}

// quality-bar-loop round 6 (industry-standards, round-1 finding).
// Review round 1 (angle B) found --chart-2 (199°) and --chart-3 (38°)
// are color-IDENTICAL to --risk-info and --risk-medium (src/index.css)
// -- this page renders severity badges (severityBadgeClasses) using
// those exact risk colors on every item row, so reusing the full
// chart-1..4 set would make a line-color indistinguishable from an
// unrelated severity indicator on the same screen. Keeps --chart-1
// (168°, teal), which doesn't collide with any --risk-* hue
// (0°/38°/142°/199°), and replaces the remaining 3 slots with literal
// hues chosen to stay >=25 degrees clear of every --risk-* hue and of
// each other. GOVERNING_BODY uses a yellow-green/olive hue (88°),
// the nearest clear gap once every --risk-* hue and FIRST/SECOND/
// THIRD's own hues are each buffered by >=25° (live-confirmed by two
// independent judges as distinguishable from SECOND's indigo, unlike
// the --chart-4 purple this replaced).
// Review round 2 (a11y): darkened from the original bar/dot lightness
// (36-60%L) to 28-42%L -- white text on the original values measured as
// low as 2.85:1 (WCAG 1.4.3 requires >=4.5:1 for text this size). Computed
// against the sRGB relative-luminance formula for each hue at its new L;
// all 4 now land between 5.8:1 and 8.3:1 against white. Only consumer is
// the review badge below (grep LINE_COLOR\[) -- safe to darken globally.
const LINE_COLOR: Record<LineOfDefense, string> = {
  FIRST: "bg-[hsl(168_60%_28%)]",
  SECOND: "bg-[hsl(250_70%_50%)]",
  THIRD: "bg-[hsl(320_65%_38%)]",
  GOVERNING_BODY: "bg-[hsl(88_55%_28%)]",
}
const LINE_COLOR_TEXT: Record<LineOfDefense, string> = {
  FIRST: "text-chart-1",
  SECOND: "text-[hsl(250_70%_60%)]",
  THIRD: "text-[hsl(320_65%_55%)]",
  GOVERNING_BODY: "text-[hsl(88_55%_42%)]",
}
const LINE_STROKE: Record<LineOfDefense, string> = {
  FIRST: "hsl(168 60% 42%)",
  SECOND: "hsl(250 70% 60%)",
  THIRD: "hsl(320 65% 55%)",
  GOVERNING_BODY: "hsl(88 55% 42%)",
}

// #97: the IIA Three Lines Model's central diagnostic question -- "is 3rd
// line (independent assurance) reviewing enough of what 1st line
// (operations) owns" -- can only be answered honestly once ownership and
// review are two separate facts (see line_reviews' own doc comment on
// ItemRowProps). This panel replaced an earlier version that answered a
// DIFFERENT, easier question ("how many items does each line own") by
// mistake, because ownership was the only data that existed at the time --
// see this file's git history on aexa-frontend#97/#941 for the full story.
// Now grounded in real review data: one ring per line that actually
// PERFORMS independent review (2nd/3rd/governing body -- 1st line's own
// ring would just restate near-100% ownership, which line_of_defense
// already shows per-item), plus the one number that's actually
// actionable: how many items have NEVER been independently reviewed by
// anyone outside the line that owns them.
interface CoverageItem {
  id: string
  title: string
  line_of_defense: LineOfDefense | null
  line_reviews: LineReview[]
}

const REVIEW_RING_LINES: LineOfDefense[] = ["SECOND", "THIRD", "GOVERNING_BODY"]

function CoverageRing({
  line,
  count,
  total,
}: {
  line: LineOfDefense
  count: number
  total: number
}) {
  const { t } = useTranslation()
  const pct = total === 0 ? 0 : count / total
  const radius = 30
  const circumference = 2 * Math.PI * radius
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        role="img"
        aria-label={t("organization.threeLinesOfDefense.coverage.ringLabel", {
          line: t(LINE_TITLE_KEY[line]),
          count,
          total,
        })}
      >
        {/* Review round 2: --border is a bare "H S% L%" triplet (see
            index.css), not a full color -- used directly (outside a
            Tailwind utility class, which wraps it in hsl() internally)
            this resolved to stroke: none, making the ring's track
            invisible. hsl(var(--border)) is the fix Tailwind's own
            utilities apply for you. */}
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="7"
        />
        {pct > 0 && (
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            stroke={LINE_STROKE[line]}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            transform="rotate(-90 36 36)"
          />
        )}
        {/* Review round 1 (a11y): the parent svg's own aria-label already
            carries this same count/total as a full sentence -- without
            aria-hidden here, some screen reader/browser pairings expose
            this bare "4/10" text a second time alongside it. */}
        <text
          x="36"
          y="40"
          textAnchor="middle"
          aria-hidden="true"
          className="fill-foreground text-[13px] font-medium"
        >
          {count}/{total}
        </text>
      </svg>
      <span className="text-center text-[11px] text-muted-foreground">
        {t(LINE_TITLE_KEY[line])}
      </span>
    </div>
  )
}

function CoverageOverview({ items }: { items: CoverageItem[] }) {
  const { t } = useTranslation()
  const total = items.length

  const reviewedCountByLine = useMemo(() => {
    const counts: Record<LineOfDefense, number> = {
      FIRST: 0,
      SECOND: 0,
      THIRD: 0,
      GOVERNING_BODY: 0,
    }
    for (const item of items) {
      const lines = new Set(item.line_reviews.map((r) => r.line))
      for (const line of lines) counts[line]++
    }
    return counts
  }, [items])

  // The one actionable finding: items with NO independent (2nd/3rd-line)
  // review at all -- still relying entirely on 1st-line self-assessment,
  // regardless of who formally owns them. Governing-body sign-off alone
  // doesn't count as independent operational assurance either (it's
  // oversight of the process, not a review of the item's content).
  const gapItems = useMemo(
    () =>
      items.filter((item) => {
        const lines = new Set(item.line_reviews.map((r) => r.line))
        return !lines.has("SECOND") && !lines.has("THIRD")
      }),
    [items]
  )

  const totalReviewsRecorded = useMemo(
    () => items.reduce((sum, item) => sum + item.line_reviews.length, 0),
    [items]
  )

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-sm font-medium">
          {t("organization.threeLinesOfDefense.coverage.title")}
        </h2>
        <CardDescription>
          {t("organization.threeLinesOfDefense.coverage.subtitle", {
            count: total,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {t("organization.threeLinesOfDefense.coverage.none")}
          </p>
        ) : totalReviewsRecorded === 0 ? (
          // Onboarding empty state: this is expected the first time the
          // feature is used org-wide (every item starts with zero reviews),
          // not an alarming "0% coverage" reading -- distinct copy from the
          // steady-state gap list below so it doesn't read as a crisis.
          <p className="text-[11px] text-muted-foreground">
            {t("organization.threeLinesOfDefense.coverage.noReviewsYet")}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-center gap-6 sm:justify-start">
              {REVIEW_RING_LINES.map((line) => (
                <CoverageRing
                  key={line}
                  line={line}
                  count={reviewedCountByLine[line]}
                  total={total}
                />
              ))}
            </div>
            {gapItems.length > 0 && (
              // Review round 1 (a11y): role="status" is a live region --
              // meant for content that CHANGES and should be announced on
              // update, not for a list that's already present on first
              // page load (the typical case here, since a fresh org starts
              // with zero reviews). Left in place, some screen readers
              // auto-announce this whole block on load, competing with the
              // page's own normal heading/landmark reading order. Plain
              // semantic markup (the list below already has real list
              // semantics) is the correct default; a live region is only
              // warranted for an actual in-place update, which this isn't.
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  {t(
                    gapItems.length === 1
                      ? "organization.threeLinesOfDefense.coverage.gapTitle_one"
                      : "organization.threeLinesOfDefense.coverage.gapTitle_other",
                    { count: gapItems.length }
                  )}
                </p>
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {gapItems.slice(0, 5).map((item) => (
                    <li
                      key={item.id}
                      className="truncate text-[11px] text-muted-foreground"
                      title={item.title}
                    >
                      {item.title}
                    </li>
                  ))}
                </ul>
                {gapItems.length > 5 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("organization.threeLinesOfDefense.coverage.gapMore", {
                      count: gapItems.length - 5,
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
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
  // #97: recording a review is a separate action from reassigning
  // ownership -- see lineReviews' own doc comment on ItemRowProps.
  const [recordRiskLineReview] = useRecordRiskLineReviewMutation()
  const [recordFindingLineReview] = useRecordFindingLineReviewMutation()
  const [recordKriLineReview] = useRecordKriLineReviewMutation()
  const [recordComplianceLineReview] = useRecordComplianceLineReviewMutation()
  const [recordAuditEngagementLineReview] =
    useRecordAuditEngagementLineReviewMutation()

  // Every line the caller may record a review FOR, per
  // canRecordReviewForLine -- computed once from role rather than per row.
  const myReviewableLines = useMemo(
    () => LINES.filter((line) => canRecordReviewForLine(line, role)),
    [role]
  )

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

  // #97: flat list of every item across all 5 entity types, carrying real
  // review coverage (line_reviews) alongside ownership -- what
  // CoverageOverview actually needs now that it answers a genuine
  // assurance question instead of a headcount-by-owner one. Unclassified
  // (no-owner) actions are included too -- an item with zero independent
  // review is exactly as much a coverage gap whether or not it has an
  // owner yet.
  const coverageItems = useMemo(
    () => [
      ...risks.map((r) => ({
        id: r.id,
        title: r.title,
        line_of_defense: r.line_of_defense,
        line_reviews: r.line_reviews,
      })),
      ...actions.map((a) => ({
        id: a.id,
        title: a.title,
        line_of_defense: a.line_of_defense,
        line_reviews: a.line_reviews,
      })),
      ...kris.map((k) => ({
        id: k.id,
        title: k.title,
        line_of_defense: k.line_of_defense,
        line_reviews: k.line_reviews,
      })),
      ...complianceObligations.map((c) => ({
        id: c.id,
        title: c.title,
        line_of_defense: c.line_of_defense,
        line_reviews: c.line_reviews,
      })),
      ...auditEngagements.map((e) => ({
        id: e.id,
        title: e.title,
        line_of_defense: e.line_of_defense,
        line_reviews: e.line_reviews,
      })),
    ],
    [risks, actions, kris, complianceObligations, auditEngagements]
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
  // Review round 1 (UX): recording a review is at least as governance-
  // significant as reassigning ownership -- it's an attestation written to
  // a real audit trail (reviewedById/reviewedAt) that feeds the org-wide
  // coverage metrics on this same page, and (unlike reassignment) has no
  // visible "undo" affordance in this UI if a wrong line gets clicked by
  // mistake. `action` discriminates which confirmation copy/handler to use
  // -- same shared single-request-at-a-time state as before, now covering
  // both governance-significant actions on this page instead of just one.
  const [confirmRequest, setConfirmRequest] = useState<{
    action: "reassign" | "recordReview"
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

  // Review round 2 (a11y, WCAG 2.4.3): a keyboard user who opens this
  // dialog from a row's trigger button, then confirms/cancels/Escapes,
  // was landing on `<body>` afterward -- they'd have to re-Tab from the
  // top of the page to find their place again. Remembers which row's
  // trigger to return focus to, independent of `confirmRequest` itself
  // (which gets cleared before the focus restore should run). Holds the
  // trigger's `${entityType}-${id}` DOM-id suffix, not just `id` -- 5
  // entity types render on this page at once with no guaranteed shared
  // id namespace, so `id` alone could collide across types.
  const pendingFocusIdRef = useRef<string | null>(null)

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
      pendingFocusIdRef.current = `${entityType}-${id}`
      requestAnimationFrame(() => {
        setConfirmRequest({ action: "reassign", entityType, id, title, line })
      })
    },
    []
  )

  // Review round 1 (UX): same confirm-before-fire treatment as
  // requestReassign above, for the same reasons -- see confirmRequest's
  // own comment.
  const requestRecordReview = useCallback(
    (entityType: EntityKind, id: string, title: string, line: LineOfDefense) => {
      hasConfirmedRef.current = false
      pendingFocusIdRef.current = `${entityType}-${id}`
      requestAnimationFrame(() => {
        setConfirmRequest({
          action: "recordReview",
          entityType,
          id,
          title,
          line,
        })
      })
    },
    []
  )

  // Review round 2 (a11y): the single place that closes the confirm
  // dialog, used by both the Cancel/Escape/outside-click path (via
  // onOpenChange) and the Confirm path (via AlertDialogAction's onClick,
  // which sets the controlled `open` prop directly and so does NOT itself
  // trigger onOpenChange) -- centralizing here means the focus-restore
  // logic isn't duplicated across both call sites.
  const closeConfirmDialog = useCallback(() => {
    setConfirmRequest(null)
    const idToFocus = pendingFocusIdRef.current
    pendingFocusIdRef.current = null
    if (idToFocus) {
      requestAnimationFrame(() => {
        document.getElementById(`three-lines-trigger-${idToFocus}`)?.focus()
      })
    }
  }, [])

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

  // #97: records that `line` independently reviewed this item -- reuses
  // the same pendingIds tracking as doReassign above (an item mid-review-
  // record shouldn't also be reassignable, and vice versa; both are
  // mutually-exclusive single-item writes).
  const doRecordReview = useCallback(
    async (
      entityType: EntityKind,
      id: string,
      _title: string,
      line: LineOfDefense
    ) => {
      setPendingIds((prev) => new Set(prev).add(id))
      try {
        switch (entityType) {
          case "risk":
            await recordRiskLineReview({ id, line }).unwrap()
            break
          case "action":
            await recordFindingLineReview({ id, line }).unwrap()
            break
          case "kri":
            await recordKriLineReview({ id, line }).unwrap()
            break
          case "compliance":
            await recordComplianceLineReview({ id, line }).unwrap()
            break
          case "audit":
            await recordAuditEngagementLineReview({ id, line }).unwrap()
            break
        }
        toast.success(t("organization.threeLinesOfDefense.toast.reviewRecorded"))
      } catch (err) {
        toast.error(
          getErrorMessage(
            err,
            t("organization.threeLinesOfDefense.toast.reviewFailed")
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
      recordRiskLineReview,
      recordFindingLineReview,
      recordKriLineReview,
      recordComplianceLineReview,
      recordAuditEngagementLineReview,
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
          <CoverageOverview items={coverageItems} />

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
          {/* aexa-frontend#939 (visual polish loop, round-7 finding): with
              no items-start, CSS Grid's default align-items: stretch
              forced every card in a row to match its tallest row-sibling's
              height -- round 5's max-h-[560px] scroll cap only bounds the
              TALL card; a short card (e.g. 5 items next to a 20-item
              sibling) still stretched to fill the same row height, just
              trapping the resulting dead space inside its own visible
              card border instead of removing it. items-start lets each
              card size to its own content instead. */}
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
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
              // Integration-axis fix (quality-bar-loop): each entry now
              // carries its `entityType` alongside the rendered row, not
              // just a flat JSX array -- LineCard (below) needs the type to
              // filter by, since PR #940 removed the only other way to
              // isolate one entity type within a line.
              const lineItems: { entityType: EntityKind; node: React.ReactNode }[] = [
                ...lineRisks.map((risk) => ({
                  entityType: "risk" as const,
                  node: (
                  <ItemRow
                    key={risk.id}
                    icon={Shield}
                    entityType="risk"
                    id={risk.id}
                    title={risk.title}
                    metaLabel={riskCategoryLabel(t, risk.category)}
                    metaColor={
                      RISK_CATEGORIES[
                        risk.category as keyof typeof RISK_CATEGORIES
                      ]?.color
                    }
                    statusLabel={getEnumLabel(
                      t,
                      RISK_STATUS_LABEL_KEYS,
                      risk.status
                    )}
                    severity={
                      RISK_STATUS_SEVERITY[risk.status] ?? "neutral"
                    }
                    currentLine={risk.line_of_defense}
                    canReassign={canReassignRisk}
                    isPending={pendingIds.has(risk.id)}
                    onReassign={requestReassign}
                    lineReviews={risk.line_reviews}
                    myReviewableLines={myReviewableLines}
                    onRecordReview={requestRecordReview}
                    isReviewPending={pendingIds.has(risk.id)}
                    linkTo={`/organization/risks/${risk.id}`}
                  />
                  ),
                })),
                ...lineActions.map((action) => ({
                  entityType: "action" as const,
                  node: (
                  <ItemRow
                    key={action.id}
                    icon={AlertTriangle}
                    entityType="action"
                    id={action.id}
                    title={action.title}
                    metaLabel={getEnumLabel(
                      t,
                      FINDING_PRIORITY_LABEL_KEYS,
                      action.priority
                    )}
                    statusLabel={getEnumLabel(
                      t,
                      FINDING_STATUS_LABEL_KEYS,
                      action.status
                    )}
                    severity={
                      ACTION_STATUS_SEVERITY[action.status] ?? "neutral"
                    }
                    currentLine={action.line_of_defense}
                    canReassign={canReassignAction}
                    isPending={pendingIds.has(action.id)}
                    onReassign={requestReassign}
                    lineReviews={action.line_reviews}
                    myReviewableLines={myReviewableLines}
                    onRecordReview={requestRecordReview}
                    isReviewPending={pendingIds.has(action.id)}
                    linkTo={`/organization/finding/${action.id}`}
                  />
                  ),
                })),
                ...lineKris.map((kri) => ({
                  entityType: "kri" as const,
                  node: (
                  <ItemRow
                    key={kri.id}
                    icon={Activity}
                    entityType="kri"
                    id={kri.id}
                    title={kri.title}
                    metaLabel={kri.unit}
                    statusLabel={getEnumLabel(
                      t,
                      KRI_STATUS_LABEL_KEYS,
                      kri.status
                    )}
                    severity={KRI_STATUS_SEVERITY[kri.status] ?? "neutral"}
                    currentLine={kri.line_of_defense}
                    canReassign={canReassignKri}
                    isPending={pendingIds.has(kri.id)}
                    onReassign={requestReassign}
                    lineReviews={kri.line_reviews}
                    myReviewableLines={myReviewableLines}
                    onRecordReview={requestRecordReview}
                    isReviewPending={pendingIds.has(kri.id)}
                    linkTo={`/organization/kri?highlight=${encodeURIComponent(kri.id)}`}
                  />
                  ),
                })),
                ...lineCompliance.map((obligation) => ({
                  entityType: "compliance" as const,
                  node: (
                  <ItemRow
                    key={obligation.id}
                    icon={Scale}
                    entityType="compliance"
                    id={obligation.id}
                    title={obligation.title}
                    metaLabel={complianceDomainLabel(t, obligation.domain)}
                    metaColor={COMPLIANCE_DOMAINS[obligation.domain]?.color}
                    statusLabel={getEnumLabel(
                      t,
                      COMPLIANCE_STATUS_LABEL_KEYS,
                      obligation.status
                    )}
                    severity={
                      COMPLIANCE_STATUS_SEVERITY[obligation.status] ??
                      "neutral"
                    }
                    currentLine={obligation.line_of_defense}
                    canReassign={canReassignCompliance}
                    isPending={pendingIds.has(obligation.id)}
                    onReassign={requestReassign}
                    lineReviews={obligation.line_reviews}
                    myReviewableLines={myReviewableLines}
                    onRecordReview={requestRecordReview}
                    isReviewPending={pendingIds.has(obligation.id)}
                    // aexa-frontend#561: CompliancePage has no
                    // per-obligation route or ?search= support of its own
                    // (unlike SitesEntities), so this links to the list,
                    // same as Audit's own linkTo below.
                    linkTo="/organization/compliance"
                  />
                  ),
                })),
                ...lineAudits.map((engagement) => ({
                  entityType: "audit" as const,
                  node: (
                  <ItemRow
                    key={engagement.id}
                    icon={ClipboardCheck}
                    entityType="audit"
                    id={engagement.id}
                    title={engagement.title}
                    metaLabel={
                      engagement.lead_auditor ??
                      t("organization.threeLinesOfDefense.noLeadAuditor")
                    }
                    statusLabel={getEnumLabel(
                      t,
                      AUDIT_ENGAGEMENT_STATUS_LABEL_KEYS,
                      engagement.status
                    )}
                    severity={
                      AUDIT_STATUS_SEVERITY[engagement.status] ?? "neutral"
                    }
                    currentLine={engagement.line_of_defense}
                    canReassign={canReassignAudit}
                    isPending={pendingIds.has(engagement.id)}
                    onReassign={requestReassign}
                    lineReviews={engagement.line_reviews}
                    myReviewableLines={myReviewableLines}
                    onRecordReview={requestRecordReview}
                    isReviewPending={pendingIds.has(engagement.id)}
                    // AuditPage has no per-engagement URL/route -- it opens
                    // engagements in an edit modal driven by local state,
                    // not a navigable id. Links to the list rather than
                    // nothing.
                    linkTo="/organization/audit"
                  />
                  ),
                })),
              ]

              return (
                <LineCard
                  key={line}
                  line={line}
                  items={lineItems}
                  totalCount={totalCount}
                />
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
                    metaLabel={getEnumLabel(
                      t,
                      FINDING_PRIORITY_LABEL_KEYS,
                      action.priority
                    )}
                    statusLabel={getEnumLabel(
                      t,
                      FINDING_STATUS_LABEL_KEYS,
                      action.status
                    )}
                    severity={
                      ACTION_STATUS_SEVERITY[action.status] ?? "neutral"
                    }
                    currentLine={null}
                    canReassign={canReassignAction}
                    isPending={pendingIds.has(action.id)}
                    onReassign={requestReassign}
                    lineReviews={action.line_reviews}
                    myReviewableLines={myReviewableLines}
                    onRecordReview={requestRecordReview}
                    isReviewPending={pendingIds.has(action.id)}
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
          row) since only one reassignment/review-record can be awaiting
          confirmation at a time -- same pattern as ReportsPage's
          confirmPublishId. Review round 1: extended to also confirm
          "record review" -- see confirmRequest's own comment for why. */}
      <AlertDialog
        open={confirmRequest !== null}
        onOpenChange={(open) => {
          if (!open) closeConfirmDialog()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmRequest?.action === "recordReview"
                ? t("organization.threeLinesOfDefense.confirmReviewTitle")
                : t("organization.threeLinesOfDefense.confirmReassignTitle")}
            </AlertDialogTitle>
            {confirmRequest && (
              <AlertDialogDescription>
                {confirmRequest.action === "recordReview"
                  ? t(
                      "organization.threeLinesOfDefense.confirmReviewDescription",
                      {
                        title: confirmRequest.title,
                        line: t(LINE_TITLE_KEY[confirmRequest.line]),
                      }
                    )
                  : t(
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
                  if (confirmRequest.action === "recordReview") {
                    doRecordReview(
                      confirmRequest.entityType,
                      confirmRequest.id,
                      confirmRequest.title,
                      confirmRequest.line
                    )
                  } else {
                    doReassign(
                      confirmRequest.entityType,
                      confirmRequest.id,
                      confirmRequest.line
                    )
                  }
                }
                closeConfirmDialog()
              }}
            >
              {confirmRequest?.action === "recordReview"
                ? t("organization.threeLinesOfDefense.confirmReviewConfirm")
                : t("organization.threeLinesOfDefense.confirmReassignConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
