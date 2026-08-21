import { CheckCircle2, Pause, Play } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SEVERITY_STYLES } from "@/utils/severityStyles"

// Landing overhaul PR7: a compact real crop of AuditPage's own
// icon-square engagement cards (src/dashboard/organization/audit/
// AuditPage.tsx, STATUS_CONFIG + the engagement card markup) -- same
// Play/Pause/CheckCircle2 icon-per-status mapping onto SEVERITY_STYLES
// (info/medium/low), same rounded-lg icon-square treatment, same real
// organization.audit.status* copy. No real audit mock-data module exists
// to import (that page pulls live from RTK Query) -- two hand-authored
// rows shaped like the real card content.
const ENGAGEMENTS = [
  { ref: "AUD-014", title: "Q3 Site Safety Review", status: "in_progress" as const },
  { ref: "AUD-011", title: "Vendor Access Audit", status: "completed" as const },
]

const STATUS_CONFIG = {
  planned: { Icon: Play, ...SEVERITY_STYLES.info, labelKey: "organization.audit.statusPlanned" },
  in_progress: {
    Icon: Pause,
    ...SEVERITY_STYLES.medium,
    labelKey: "organization.audit.statusInProgress",
  },
  completed: {
    Icon: CheckCircle2,
    ...SEVERITY_STYLES.low,
    labelKey: "organization.audit.statusCompleted",
  },
}

export default function AuditEngagementCrop() {
  const { t } = useTranslation()
  // Review finding on PR #1019: fabricated illustrative content, same
  // reasoning as FindingsOverdueCrop's own aria-hidden -- a screen reader
  // shouldn't announce "AUD-014, Q3 Site Safety Review" as real page data
  // (this also removes the decorative <h4> below from the a11y tree,
  // which is the intent, not a side effect to work around).
  return (
    <div aria-hidden="true" className="mt-4 space-y-2">
      {ENGAGEMENTS.map((eng) => {
        const cfg = STATUS_CONFIG[eng.status]
        return (
          <div
            key={eng.ref}
            className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5"
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}
            >
              <cfg.Icon className={`h-4 w-4 ${cfg.text}`} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-mono-data text-[10px] font-bold text-muted-foreground">
                {eng.ref}
              </span>
              <h4 className="truncate text-xs font-semibold text-foreground">
                {eng.title}
              </h4>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}
            >
              {t(cfg.labelKey)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
