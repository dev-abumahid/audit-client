/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Calendar,
  Download,
  Eye,
  FileText,
  Loader2,
  Sparkles,
  User,
} from "lucide-react"
import { useState } from "react"

const REPORT_TYPES = [
  "Board Report",
  "Monthly Executive Committee Report",
  "Internal Audit Assurance Opinion",
  "Monte Carlo Stress Test Report",
  "Compliance Status Report",
]

const DUMMY_REPORTS = [
  {
    id: "rep1",
    type: "Board Report",
    title: "Q1 2026 Risk & Compliance Board Report",
    author: "AI + Chief Risk Officer",
    created_at: "2026-04-10T09:15:00Z",
    pages: 24,
    status: "published" as const,
    ai_generated: true,
  },
  {
    id: "rep2",
    type: "Monthly Executive Committee Report",
    title: "March 2026 Risk Dashboard & Key Insights",
    author: "AI + Risk Management Team",
    created_at: "2026-04-05T14:30:00Z",
    pages: 18,
    status: "draft" as const,
    ai_generated: true,
  },
]

export default function ReportsPage() {
  const [reports, setReports] = useState(DUMMY_REPORTS)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedType, setSelectedType] = useState(REPORT_TYPES[0])

  const handleGenerate = async () => {
    setIsGenerating(true)

    // Simulate AI report generation delay
    await new Promise((resolve) => setTimeout(resolve, 2200))

    const newReport = {
      id: "rep" + Date.now(),
      type: selectedType,
      title: `${selectedType} — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
      author: "AI + Risk Intelligence Engine",
      created_at: new Date().toISOString(),
      pages: Math.floor(Math.random() * 12) + 15, // 15 to 26 pages
      status: "draft" as const,
      ai_generated: true,
    }

    setReports((prev) => [newReport, ...prev])

    alert(
      `Report generated successfully!\n\nType: ${selectedType}\nPages: ${newReport.pages}\nTitle: ${newReport.title}`
    )

    setIsGenerating(false)
  }

  const handleDownloadPDF = (report: any) => {
    alert(`Downloading PDF: ${report.title}\n(${report.pages} pages)`)
    // In a real app this would trigger pdf generation and download
  }

  const handlePreviewPDF = (report: any) => {
    alert(`Opening preview for: ${report.title}`)
    // In a real app this would open the PDF in a new tab
  }

  return (
    <div className="space-y-6 p-6">
      <div className="animate-fade-in flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            AI-powered report generation • Board / Executive / Assurance reports
            • Based on your live data
          </p>
        </div>
      </div>

      {/* Generate Section */}
      <div className="animate-slide-up flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none sm:w-auto"
        >
          {REPORT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
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
          {isGenerating ? "Generating report..." : "Generate with AI"}
        </button>

        {isGenerating && (
          <span className="text-xs text-muted-foreground">
            Collecting risks, KRIs, compliance, audits and findings...
          </span>
        )}
      </div>

      {/* Reports Grid */}
      <div className="animate-slide-up stagger-2 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <div
            key={report.id}
            className="group rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {report.title || report.type}
                </h3>
                <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(report.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                  {report.author && (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {report.author}
                    </div>
                  )}
                  <div>{report.pages} pages</div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {report.ai_generated && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    AI
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    report.status === "published"
                      ? "bg-risk-low/10 text-risk-low"
                      : "bg-risk-medium/10 text-risk-medium"
                  }`}
                >
                  {report.status === "published" ? "Published" : "Draft"}
                </span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handlePreviewPDF(report)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </button>
              <button
                onClick={() => handleDownloadPDF(report)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
              >
                <Download className="h-3.5 w-3.5" /> Download PDF
              </button>
            </div>
          </div>
        ))}

        {reports.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No reports yet. Generate one using AI above.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
