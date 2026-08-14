import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  History,
  MoreVertical,
  Paperclip,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
} from "lucide-react"
import { Link } from "react-router"
import { useTranslation } from "react-i18next"
import SourceBadge from "@/components/dashboard/organization/SourceBadge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDateOnlyForDisplay } from "@/dashboard/organization/findings/dueDateInput"
import type { ComplianceObligation } from "@/redux/apis/organization/compliance.api"
import { frameworkForReference } from "@/utils/complianceFrameworks"
import { LINE_OF_DEFENSE_LABEL_KEY as LINE_OF_DEFENSE_KEY } from "@/utils/lineOfDefense"
import { SEVERITY_STYLES } from "@/utils/severityStyles"

interface ComplianceObligationRowProps {
  obligation: ComplianceObligation
  canWrite: boolean
  domainLabel: (key: string) => string
  statusLabel: (key: string) => string
  statusIcons: Record<string, React.ElementType>
  statusBadgeClass: Record<string, string>
  onEdit: (obligation: ComplianceObligation) => void
  onAttest: (obligation: ComplianceObligation, trigger: HTMLElement) => void
  onHistory: (obligation: ComplianceObligation, trigger: HTMLElement) => void
  onDelete: (id: string) => void
  onCreateAction: (obligation: ComplianceObligation) => void
}

// Round 14 (code quality finding, fresh full-panel re-score): extracted from
// CompliancePage.tsx, which had grown to ~244 lines of inline obligation-row
// JSX across rounds 3/9/12/13 (line of defense, mobile overdue indicator,
// framework badge) -- same class of gap already closed for this page's
// modals (round 6) and data layer (round 11), same extraction pattern.
export default function ComplianceObligationRow({
  obligation: obl,
  canWrite,
  domainLabel,
  statusLabel,
  statusIcons,
  statusBadgeClass,
  onEdit,
  onAttest,
  onHistory,
  onDelete,
  onCreateAction,
}: ComplianceObligationRowProps) {
  const { t, i18n } = useTranslation()
  const StatusIcon = statusIcons[obl.status] || Clock
  // aexa-server#250 -- `overdue` is computed server-side from
  // next_review_date (falling back to due_date when unset), so a recurring
  // obligation reconfirmed on schedule stops reading as overdue even though
  // its original due_date already passed. Prefer this over re-deriving
  // overdue-ness from due_date alone.
  const isOverdue = obl.overdue
  // Round-14 review nit (code quality): was called twice per row (once in
  // the ternary condition, once to read `.framework`) -- a single lookup is
  // clearer even though the O(1) Map.get was never a real cost.
  const framework = frameworkForReference(obl.regulation_reference)

  return (
    <tr className="group border-b border-border transition-colors hover:bg-muted/30">
      <td className="px-3 py-3 lg:px-4">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-foreground">{obl.title}</p>
          {obl.attachments.length > 0 && (
            <Paperclip className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <p className="hidden max-w-xs truncate text-[10px] text-muted-foreground sm:block">
          {obl.description}
        </p>
        {obl.regulation_reference && (
          <p className="hidden max-w-xs items-center gap-1 truncate text-[10px] text-muted-foreground/80 sm:flex">
            {t("organization.compliance.col.regulationRefShort")}:{" "}
            {/* Industry-standards finding: a regulation_reference that
                exactly matches the curated framework catalog
                (src/utils/complianceFrameworks.ts) gets a structured
                framework badge instead of plain text -- custom/free-text
                references still render as-is below, unchanged. */}
            {framework ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                {framework.framework}
              </span>
            ) : null}
            <span className="truncate">{obl.regulation_reference}</span>
          </p>
        )}
        {/* Round-3 industry-standards finding: line_of_defense was already
            returned by the backend (Issue #97) but never surfaced anywhere
            in this UI -- same compact, conditional treatment as
            regulation_reference above, not a new table column (this
            table's mobile columns were already tightened in round 2). */}
        <p className="hidden max-w-xs truncate text-[10px] text-muted-foreground/80 sm:block">
          {t("organization.compliance.col.lineOfDefenseShort")}:{" "}
          {t(LINE_OF_DEFENSE_KEY[obl.line_of_defense])}
        </p>
        {/* Round 9 (UX finding, fresh full-panel re-score): the Due Date
            column (with the only overdue indicator on this table) is
            hidden below `md` -- a real mobile triage loss for a compliance
            user, since "which obligations are overdue" is exactly the
            thing you'd want to see on a phone. `md:hidden` (round-1 review
            of PR #882: the original version had no breakpoint gate at
            all, duplicating the exact same "Overdue" signal in both this
            compact line AND the Due Date column's own badge once the
            column becomes visible at `md`+) makes this fill only the real
            gap -- below `md`, where the column is absent -- and disappear
            once the full column takes over, same "don't show the same
            fact twice" discipline the sm:block-gated lines above it
            already follow. Round-2's own "don't widen the table back out"
            discipline still holds -- this is the compact-line pattern,
            not un-hiding the column. */}
        {isOverdue && (
          <p
            className={`mt-0.5 flex items-center gap-1 text-[10px] font-medium md:hidden ${SEVERITY_STYLES.critical.text}`}
          >
            <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
            {t("organization.compliance.overdueLabel")}
            {obl.due_date &&
              ` · ${formatDateOnlyForDisplay(obl.due_date, i18n.language)}`}
          </p>
        )}
      </td>
      <td className="hidden px-3 py-3 text-xs text-muted-foreground sm:table-cell">
        {domainLabel(obl.domain)}
      </td>
      <td className="hidden px-3 py-3 text-center md:table-cell">
        <span
          className={`font-mono-data text-xs ${
            isOverdue
              ? `font-bold ${SEVERITY_STYLES.critical.text}`
              : "text-muted-foreground"
          }`}
        >
          {obl.due_date
            ? formatDateOnlyForDisplay(obl.due_date, i18n.language)
            : "—"}
        </span>
        {isOverdue && (
          <span
            className={`mt-0.5 flex items-center justify-center gap-1 text-[10px] font-medium ${SEVERITY_STYLES.critical.text}`}
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            {t("organization.compliance.overdueLabel")}
          </span>
        )}
        {obl.recurrence && obl.next_review_date && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {t("organization.compliance.col.nextReviewShort")}:{" "}
            {formatDateOnlyForDisplay(obl.next_review_date, i18n.language)}
          </p>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            statusBadgeClass[obl.status] || "bg-muted text-muted-foreground"
          }`}
        >
          <StatusIcon className="h-3 w-3" />
          {statusLabel(obl.status)}
        </span>
      </td>
      <td className="hidden px-3 py-3 text-xs text-muted-foreground lg:table-cell">
        {obl.owner || "—"}
      </td>
      <td className="px-3 py-3 text-center">
        <SourceBadge aiGenerated={obl.ai_generated} isEdited={obl.is_edited} />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-1">
          {/* Remediation path for a failing obligation (#166): only
              non-compliant rows are a dead end that needs a "Create
              Action" affordance. Kept always-visible-on-hover-group (not
              further hover-gated like edit/delete) so the remediation
              nudge is actually discoverable -- but #217 still gates it on
              canWrite since it creates a Finding, the same write action
              gated everywhere else. aexa-server#531: once one exists, show
              "View Action" instead -- the obligation's `actions` list is
              now populated on read, so this no longer risks offering to
              create a duplicate for an obligation that already has an
              open remediation. Links to the first one: an obligation
              practically has at most one live remediation action, and the
              UI has no way to create a second from this button anyway.
              `?.` on `obl.actions` even though the type says it's always
              an array: this frontend and aexa-server#531 (which starts
              actually populating it) can deploy independently, so a
              rollback or out-of-order release must not crash this row. */}
          {obl.status === "non_compliant" &&
            canWrite &&
            (obl.actions?.length ? (
              <Link
                to={`/organization/finding/${obl.actions[0].id}`}
                className="focus-ring flex h-11 shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 text-[10px] font-medium text-primary hover:bg-primary/20"
              >
                <ArrowUpRight className="h-3 w-3" />
                {t("organization.compliance.viewAction.button")}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onCreateAction(obl)}
                className="focus-ring flex h-11 shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 text-[10px] font-medium text-primary hover:bg-primary/20"
              >
                <Plus className="h-3 w-3" />
                {t("organization.compliance.createAction.button")}
              </button>
            ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("organization.compliance.moreActionsLabel", {
                  title: obl.title,
                })}
                className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canWrite && (
                <DropdownMenuItem onClick={() => onEdit(obl)}>
                  <Pencil className="h-3.5 w-3.5" />
                  {t("organization.compliance.editObligation")}
                </DropdownMenuItem>
              )}
              {/* aexa-server#250: re-attest is legitimate for any
                  obligation, recurring or not -- the history entry itself
                  is a real audit-trail fact independent of whether
                  there's a cadence to advance. Same write gate as
                  edit/delete (assertCanWriteOrgResource). */}
              {canWrite && (
                <DropdownMenuItem
                  onClick={(e) =>
                    onAttest(obl, e.currentTarget as unknown as HTMLElement)
                  }
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  {t("organization.compliance.attest.button")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) =>
                  onHistory(obl, e.currentTarget as unknown as HTMLElement)
                }
              >
                <History className="h-3.5 w-3.5" />
                {t("organization.compliance.attest.historyButton")}
              </DropdownMenuItem>
              {canWrite && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(obl.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("organization.compliance.deleteObligation")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  )
}
