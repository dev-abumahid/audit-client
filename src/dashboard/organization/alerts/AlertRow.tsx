import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import type { Alert } from "@/types/organization"
import { getEnumLabel } from "@/utils/enumLabel"
import { formatLocaleDate } from "@/utils/formatDate"
import { SEVERITY_STYLES } from "@/utils/severityStyles"
import { Bell, Clock, Loader2, Trash2 } from "lucide-react"
import { memo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

type Severity = "critical" | "high" | "medium" | "low"

// aexa-frontend round-3 audit bug #5: `Alert.type` is a free-form string
// column (see aexa-server prisma/schema/alert.prisma) with no backend enum
// -- the only confirmed system-generated value is 'kri_threshold_breach'
// (kri.service.ts's alert.create call), while the manual-entry endpoint
// (alert.service.ts's create_alert_into_db) lets an ADMIN/LEAD_AUDITOR type
// anything into `type`. So, same convention as getEnumLabel's other
// callers, this maps the one known value to a humanized label and falls
// back to the raw string for anything else instead of crashing or hiding
// unrecognized types.
const ALERT_TYPE_LABEL_KEYS: Record<string, string> = {
  kri_threshold_breach: "organization.alerts.type.kriThresholdBreach",
}

type AlertRowProps = {
  alert: Alert
  canWrite: boolean
  language: string
  isMarkingRead: boolean
  onMarkRead: (id: string) => void
  onRequestDismiss: (id: string) => void
  registerCardRef: (id: string, el: HTMLDivElement | null) => void
}

// Round 14 (efficiency fix): the whole alert list used to render inline
// inside AlertsPage's own `.map()`, so any single row's state change (e.g.
// `markingReadIds` flipping for one id) re-rendered and re-formatted
// EVERY currently-filtered row via formatLocaleDate/SEVERITY_STYLES
// lookups, not just the one that actually changed. Extracting a memoized
// component means an unrelated row's props stay referentially/value-equal
// across that re-render and React skips it entirely.
function AlertRowImpl({
  alert,
  canWrite,
  language,
  isMarkingRead,
  onMarkRead,
  onRequestDismiss,
  registerCardRef,
}: AlertRowProps) {
  const { t } = useTranslation()

  // Round 14 (efficiency fix): the ref callback passed to `ref=` used to
  // be a fresh closure every render (no memoization), so React called it
  // with `null` then the element again on every re-render of this row,
  // not just mount/unmount. Stabilized per alert.id -- only changes if
  // this row's own identity changes, which for a stable `key`-ed list
  // item is effectively never.
  const setCardRef = useCallback(
    (el: HTMLDivElement | null) => registerCardRef(alert.id, el),
    [alert.id, registerCardRef]
  )

  return (
    <div
      ref={setCardRef}
      tabIndex={-1}
      className={`focus-ring group rounded-xl border bg-card p-5 transition-all hover:shadow-md ${
        alert.severity === "critical" ? "border-risk-critical/30" : "border-border"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* quality-bar-loop round 16/17 (resilience regression, round
            2): this icon-background was a hand-rolled ternary chain
            that fell through to "low"/no styling for any severity
            outside the 3-4 values it happened to check -- e.g. an
            unrecognized severity rendered a neutral-gray icon (fixed
            round 16) sitting in a green "low-severity" box (missed
            round 16). Routing both bg and text through the same
            SEVERITY_STYLES lookup + neutral fallback keeps them from
            ever disagreeing again. (The card border above is a
            separate, deliberately binary "only critical gets a
            colored border" emphasis, not this same bug class --
            left as-is.)
            Round 15 (accessibility): the "read" dimming used to be a
            blanket `opacity-60` on the WHOLE card, which scales text
            render opacity right along with everything else --
            live-measured the read-state description/metadata text at
            ~2.95:1 against its background, under WCAG AA's 4.5:1 floor
            for small text. Scoping the dimming to just this decorative
            icon square (not the actual text nodes below) keeps the
            visual "read" cue without touching text contrast at all --
            the icon isn't conveying information the "New" badge/absent
            Mark-as-read button don't already convey on their own. */}
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            (SEVERITY_STYLES[alert.severity as Severity] ?? SEVERITY_STYLES.neutral).bg
          } ${alert.is_read ? "opacity-60" : ""}`}
        >
          <Bell
            className={`h-5 w-5 ${
              (SEVERITY_STYLES[alert.severity as Severity] ?? SEVERITY_STYLES.neutral).text
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge level={alert.severity} />
            <span className="text-xs font-semibold text-primary">{alert.source}</span>
            {alert.type && (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {getEnumLabel(t, ALERT_TYPE_LABEL_KEYS, alert.type)}
                </span>
              </>
            )}
            {alert.ai_generated && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {t("organization.alerts.aiGenerated")}
              </span>
            )}
            {!alert.is_read && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                {t("organization.alerts.new")}
              </span>
            )}
          </div>

          <h3 className="mt-1.5 text-sm leading-tight font-semibold text-foreground">
            {alert.title}
          </h3>
          {alert.description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {alert.description}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-4">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatLocaleDate(alert.createdAt, language, {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            <div className="flex items-center gap-2">
              {/* aexa-frontend#530: kri_id is populated for every
                  kri_threshold_breach alert but was never surfaced --
                  this is the one-way-blind half of the cross-link,
                  the other half (alert counts on the KRI card) lives
                  in KriDashboardPage.tsx. */}
              {/* quality-bar-loop round 2 (mobile, round-1
                  finding): these measured 25px tall with only 8px
                  between them -- under the 44px touch-target
                  guideline and a real mis-tap risk given how
                  close together they sit. */}
              {alert.kri_id && (
                <Link
                  to={`/organization/kri?highlight=${encodeURIComponent(alert.kri_id)}`}
                  className="focus-ring flex h-11 items-center rounded-md px-2 text-[11px] font-medium text-primary hover:bg-primary/10"
                >
                  {t("organization.alerts.viewKri")}
                </Link>
              )}
              {canWrite && !alert.is_read && (
                <button
                  type="button"
                  onClick={() => onMarkRead(alert.id)}
                  disabled={isMarkingRead}
                  className="focus-ring flex h-11 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  {isMarkingRead && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t("organization.alerts.markAsRead")}
                </button>
              )}
              {canWrite && (
                <button
                  type="button"
                  onClick={() => onRequestDismiss(alert.id)}
                  className="focus-ring flex h-11 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("organization.alerts.dismiss")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const AlertRow = memo(AlertRowImpl)
export default AlertRow
