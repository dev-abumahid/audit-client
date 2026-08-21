import { AlertTriangle, Clock } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SEVERITY_STYLES } from "@/utils/severityStyles"

// Landing overhaul PR7: a compact real crop of AllFindingsPage's own
// per-row "two-tier" overdue treatment (src/dashboard/organization/
// findings/AllFindingsPage.tsx, the Due Date cell) -- tier 1 is a bold
// red Clock icon + bold red date, tier 2 is a small red pill with an
// AlertTriangle underneath. Same real SEVERITY_STYLES.critical colors and
// the real organization.findings.overdueLabel copy, not an approximation.
// No real findings mock-data module exists to import from (that page pulls
// live from RTK Query) -- two small hand-authored rows shaped like the
// real cell content, not a literal data fixture.
const ROWS = [
  { label: "Vendor access review", date: "Mar 3", overdue: true },
  { label: "Fire extinguisher check", date: "Apr 18", overdue: false },
]

export default function FindingsOverdueCrop() {
  const { t } = useTranslation()
  // Review finding on PR #1019: this renders fabricated illustrative
  // content ("Vendor access review", "Mar 3", "Overdue") inside a card
  // whose real semantic content is just the heading/description above --
  // without aria-hidden, a screen reader would announce this as if it were
  // real page data. aria-hidden here, same as every purely-decorative
  // element elsewhere in this codebase's landing widgets.
  return (
    <div
      aria-hidden="true"
      className="mt-4 space-y-2 rounded-lg border border-border bg-background p-3"
    >
      {ROWS.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {row.label}
          </span>
          <div className="flex shrink-0 flex-col items-end">
            <span className="flex items-center gap-1">
              <Clock
                size={12}
                className={row.overdue ? SEVERITY_STYLES.critical.text : "text-muted-foreground"}
              />
              <span
                className={`text-xs ${
                  row.overdue
                    ? `font-bold ${SEVERITY_STYLES.critical.text}`
                    : "text-foreground"
                }`}
              >
                {row.date}
              </span>
            </span>
            {row.overdue && (
              <span
                className={`mt-0.5 flex items-center gap-1 text-[10px] font-medium ${SEVERITY_STYLES.critical.text}`}
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                {t("organization.findings.overdueLabel")}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
