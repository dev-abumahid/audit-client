import { Fragment } from "react"
import { MOCK_SITES } from "@/dashboard/organization/overview/overviewMockData"
import { severityBadgeClasses } from "@/utils/severityStyles"

// Landing overhaul PR7: a compact real crop of the Compliance Scorecard's
// site x domain heatmap (src/dashboard/organization/compliance/
// ComplianceScorecardMatrix.tsx). Review correction on PR #1019: that
// component itself doesn't call severityBadgeClasses directly -- it takes
// a `bandClasses` prop built by CompliancePage.tsx from the real
// ComplianceScoreBand type ("green"/"orange"/"red"/"none"), which
// CompliancePage in turn derives via severityBadgeClasses("low"/"medium"/
// "critical", {border:true}). This crop calls severityBadgeClasses
// directly with those same critical/medium/low band names -- same real
// colors and cell format, one layer more direct than the real page's own
// indirection, not a different color system. Real site names from the
// shared MOCK_SITES fixture; domain columns are illustrative (no real
// compliance-domain mock module exists to import -- that page pulls live
// scorecard data from RTK Query).
type Band = "critical" | "medium" | "low"
const DOMAINS = ["Data Privacy", "H&S", "Environmental"]
const SITES = MOCK_SITES.slice(0, 3).map((s) => s.name.split(" ")[0])

// [site][domain] -> {compliant, total, band}
const CELLS: { compliant: number; total: number; band: Band }[][] = [
  [
    { compliant: 4, total: 4, band: "low" },
    { compliant: 2, total: 4, band: "medium" },
    { compliant: 4, total: 4, band: "low" },
  ],
  [
    { compliant: 1, total: 5, band: "critical" },
    { compliant: 3, total: 3, band: "low" },
    { compliant: 3, total: 5, band: "medium" },
  ],
  [
    { compliant: 5, total: 5, band: "low" },
    { compliant: 4, total: 5, band: "low" },
    { compliant: 2, total: 5, band: "medium" },
  ],
]

export default function ComplianceHeatmapCrop() {
  // Review finding on PR #1019: fabricated illustrative content -- same
  // aria-hidden reasoning as the other three crops in this folder.
  return (
    <div
      aria-hidden="true"
      className="mt-4 rounded-lg border border-border bg-background p-3"
    >
      <div
        className="grid gap-1 text-[9px]"
        style={{ gridTemplateColumns: `auto repeat(${DOMAINS.length}, 1fr)` }}
      >
        <span />
        {DOMAINS.map((domain) => (
          <span
            key={domain}
            className="truncate text-center font-medium text-muted-foreground"
          >
            {domain}
          </span>
        ))}
        {SITES.map((site, rowIdx) => (
          <Fragment key={site}>
            <span className="flex items-center truncate pr-1 font-medium text-muted-foreground">
              {site}
            </span>
            {CELLS[rowIdx].map((cell, colIdx) => (
              <span
                key={`${site}-${colIdx}`}
                className={`font-mono-data inline-block rounded-md border px-1.5 py-1 text-center ${severityBadgeClasses(cell.band, { border: true })}`}
              >
                {cell.compliant}/{cell.total}
              </span>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
