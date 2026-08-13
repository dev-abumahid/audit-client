import type { Report } from "@/redux/apis/organization/report.api"
import { isHttpUrl } from "@/utils/isHttpUrl"

// Round 9 review finding: `canOpen` (gating the Preview/Download buttons),
// openPdf's guard, and downloadReport's guard each independently
// re-derived "is this report's file safely openable" -- three overlapping
// checks for one concept, and `canOpen` was the weakest of the three since
// it never checked isHttpUrl at all (only openPdf/downloadReport did,
// internally, as a silent no-op rather than a disabled button). One
// shared check now; the button is correctly disabled for a non-http(s)
// file_url instead of looking clickable and silently doing nothing.
export function canOpenReport(report: Report): boolean {
  return (
    (report.status === "READY" || report.status === "PUBLISHED") &&
    !!report.file_url &&
    isHttpUrl(report.file_url)
  )
}
