import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import type { Report, ReportType } from "@/redux/apis/organization/report.api"
import {
  useGenerateReportMutation,
  useGetAllReportsQuery,
  usePublishReportMutation,
} from "@/redux/apis/organization/report.api"
import { formatLocaleDate } from "@/utils/formatDate"
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

// While any report is still GENERATING, poll the list so a card resolves to its
// real terminal state (READY/FAILED) without a manual reload. Generation runs
// synchronously server-side, but a proxy 504 (the backend's #220 route timeout)
// or the client navigating away/back means the mutation response may never be
// seen — polling is the recovery path. Stopped (interval 0) once nothing is
// generating so an idle Reports page makes no background requests.
const GENERATING_POLL_INTERVAL_MS = 5000

// All 5 Fullbloom-parity types are shown in the dropdown, but only BOARD is
// backed by real data today — the other 4 are disabled with a "coming soon"
// tooltip until their backing modules (audit engine, Monte Carlo, compliance)
// mature. The backend rejects a non-BOARD type too, so this is UX, not the gate.
const REPORT_TYPES: { value: ReportType; enabled: boolean }[] = [
  { value: "BOARD", enabled: true },
  { value: "EXEC_COMMITTEE", enabled: false },
  { value: "AUDIT_OPINION", enabled: false },
  { value: "MONTE_CARLO", enabled: false },
  { value: "COMPLIANCE", enabled: false },
]

const STATUS_STYLES: Record<Report["status"], string> = {
  GENERATING: "bg-blue-500/10 text-blue-600",
  READY: "bg-risk-medium/10 text-risk-medium",
  PUBLISHED: "bg-risk-low/10 text-risk-low",
  FAILED: "bg-destructive/10 text-destructive",
}

export default function ReportsPage() {
  const { t, i18n } = useTranslation()
  const role = useMyOrgRole()
  // Two intentionally different gates, not an oversight: Publish is
  // ADMIN-only (a stricter human-review step), while Generate follows the
  // standard ADMIN-or-LEAD_AUDITOR write gate used everywhere else (#227).
  const isAdmin = role === "ADMIN"
  const canWrite = canWriteOrgResource(role)

  // Reactive polling interval: driven off the data below. 0 = no polling.
  const [pollingInterval, setPollingInterval] = useState(0)

  const { data: reportData, isLoading } = useGetAllReportsQuery(
    {
      page: 1,
      limit: 100,
      searchTerm: "",
    },
    { pollingInterval },
  )
  const [generateReport, { isLoading: isGenerating }] =
    useGenerateReportMutation()
  const [publishReport] = usePublishReportMutation()

  const [selectedType, setSelectedType] = useState<ReportType>("BOARD")
  const [publishingId, setPublishingId] = useState<string | null>(null)

  const reports: Report[] = reportData?.data || []

  // Turn polling on only while at least one report is GENERATING, off otherwise.
  const hasGenerating = reports.some((r) => r.status === "GENERATING")
  useEffect(() => {
    setPollingInterval(hasGenerating ? GENERATING_POLL_INTERVAL_MS : 0)
  }, [hasGenerating])

  const handleGenerate = async () => {
    try {
      const res = await generateReport({ type: selectedType }).unwrap()
      // Generation is synchronous: the response is the final report. A row that
      // came back FAILED is a failed generation, surfaced as an error toast even
      // though the HTTP call itself succeeded.
      if (res.success && res.data?.status !== "FAILED") {
        toast.success(t("organization.reports.generateSuccess"))
      } else {
        toast.error(t("organization.reports.generateFailed"))
      }
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ||
          t("organization.reports.generateFailed")
      )
    }
  }

  const handlePublish = async (id: string) => {
    setPublishingId(id)
    try {
      const res = await publishReport(id).unwrap()
      if (res.success) {
        toast.success(t("organization.reports.publishSuccess"))
      } else {
        toast.error(
          res.message || t("organization.reports.publishFailed")
        )
      }
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ||
          t("organization.reports.publishFailed")
      )
    } finally {
      setPublishingId(null)
    }
  }

  const openPdf = (report: Report) => {
    if (report.file_url) window.open(report.file_url, "_blank", "noopener")
  }

  // Preview and Download used to share openPdf(), which only ever opens the
  // PDF in a new tab -- Download never actually downloaded anything. Mirrors
  // FindingDetails.tsx's downloadFile(): a temporary <a download> element,
  // since the file is a direct URL and the browser handles the cross-origin
  // download itself, no fetch/blob needed.
  //
  // Unlike FindingDetails.tsx's attachmentFileName() (which derives its name
  // from a URL path segment and is structurally free of "/"), report.title
  // is free-text with no such guarantee -- a title containing "/" or "\"
  // would otherwise be read as path separators and mangle/truncate the
  // downloaded filename. Strip filesystem-unsafe characters first.
  const downloadReport = (report: Report) => {
    if (!report.file_url) return
    const safeTitle = report.title
      .replace(/[\\/:*?"<>|]+/g, "_")
      .trim()
      .replace(/^_+|_+$/g, "")
    const link = document.createElement("a")
    link.href = report.file_url
    link.download = `${safeTitle || "report"}.pdf`
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="animate-fade-in flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("organization.reports.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organization.reports.subtitle")}
          </p>
        </div>
      </div>

      {/* Generate Section */}
      {canWrite && (
      <div className="animate-slide-up flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <select
          aria-label={t("organization.reports.typeLabel")}
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as ReportType)}
          disabled={isGenerating}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none disabled:opacity-50 sm:w-auto"
        >
          {REPORT_TYPES.map((type) => (
            <option key={type.value} value={type.value} disabled={!type.enabled}>
              {t(`organization.reports.types.${type.value}`)}
              {type.enabled ? "" : ` — ${t("organization.reports.comingSoon")}`}
            </option>
          ))}
        </select>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[0.98] active:scale-95 disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isGenerating
            ? t("organization.reports.generating")
            : t("organization.reports.generate")}
        </button>

        {isGenerating && (
          <span className="text-xs text-muted-foreground">
            {t("organization.reports.generatingHint")}
          </span>
        )}
      </div>
      )}

      {/* Reports Grid */}
      <div className="animate-slide-up stagger-2 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <h2 className="sr-only col-span-full">
          {t("organization.reports.listHeading")}
        </h2>
        {reports.map((report) => {
          const isReady = report.status === "READY"
          const isPublished = report.status === "PUBLISHED"
          const isFailed = report.status === "FAILED"
          const isGen = report.status === "GENERATING"
          const canOpen = (isReady || isPublished) && !!report.file_url

          return (
            <div
              key={report.id}
              className="group rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  {isFailed ? (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  ) : isGen ? (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  ) : (
                    <FileText className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {report.title}
                  </h3>
                  <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatLocaleDate(report.createdAt, i18n.language, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                    {report.reference && (
                      <div>
                        {t("organization.reports.reference")}:{" "}
                        <span className="font-mono">{report.reference}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {report.ai_generated && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {t("organization.reports.aiBadge")}
                    </span>
                  )}
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[report.status]}`}
                  >
                    {isPublished && <CheckCircle2 className="h-2.5 w-2.5" />}
                    {t(`organization.reports.status.${report.status}`)}
                  </span>
                </div>
              </div>

              {isFailed && (
                <p className="mt-3 text-xs text-destructive">
                  {t("organization.reports.failedHint")}
                </p>
              )}

              {(isReady || isPublished) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => openPdf(report)}
                    disabled={!canOpen}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98] disabled:opacity-50"
                  >
                    <Eye className="h-3.5 w-3.5" />{" "}
                    {t("organization.reports.preview")}
                  </button>
                  <button
                    onClick={() => downloadReport(report)}
                    disabled={!canOpen}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />{" "}
                    {t("organization.reports.download")}
                  </button>
                  {/* Publish is the human-review gate — org-admins only, on a
                      report still awaiting review. Re-checked server-side. */}
                  {isReady && isAdmin && (
                    <button
                      onClick={() => handlePublish(report.id)}
                      disabled={publishingId === report.id}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-[0.98] disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {publishingId === report.id
                        ? t("organization.reports.publishing")
                        : t("organization.reports.publish")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {isLoading && (
          <div className="col-span-full flex items-center justify-center rounded-xl border border-border bg-card p-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && reports.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {t("organization.reports.empty")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
