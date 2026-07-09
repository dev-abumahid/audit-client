/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button"
import { useGetSingleTemplateQuery } from "@/redux/apis/organization/template.api"
import type { IQuestion, ITemplate } from "@/types/template"
import html2canvas from "html2canvas-pro"
import jsPDF from "jspdf"
import { Download, Loader2 } from "lucide-react"
import { useRef, useState } from "react"
import { useParams } from "react-router"
import { toast } from "sonner"

const TemplateReportPage = () => {
  const { id } = useParams()
  const { data, isLoading } = useGetSingleTemplateQuery(id)
  const template = data?.data as ITemplate
  const reportRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const templateName = template?.templateName || "Untitled Template"
  const templateDisc = template?.templateDisc || ""
  const pages = template?.pages || []

  const getAnswerTypeLabel = (question: IQuestion): string => {
    switch (question.answerType) {
      case "input":
        return "Text Input"
      case "multipleSelect":
        return `Multiple Choice (${(question as any).value})`
      case "date":
        return "Date Picker"
      case "media":
        return "Media Upload (Photo/Video/Document)"
      case "checkbox":
        return "Checkbox (Yes/No)"
      case "slider":
        return "Slider / Rating Scale"
      default:
        return "Open Response"
    }
  }

  const getAnswerHint = (question: IQuestion): string => {
    switch (question.answerType) {
      case "input":
        return "Enter your response here..."
      case "multipleSelect":
        return "Select all applicable options"
      case "date":
        return "DD/MM/YYYY"
      case "media":
        return "Attach photo, video, or document"
      case "checkbox":
        return "☐ Yes    ☐ No"
      case "slider":
        return "Rate on a scale (e.g., 1–10 or 1–5)"
      default:
        return "Provide your answer here"
    }
  }

  const downloadPDF = async () => {
    if (!reportRef.current) return

    try {
      setIsDownloading(true)

      // ১. স্ক্রল পজিশন ফিক্সড করা (যাতে স্ক্রল করা অবস্থায় পেজ কেটে বা ফাঁকা না যায়)
      const element = reportRef.current
      const originalScrollTop = window.scrollY
      window.scrollTo(0, 0)

      const canvas = await html2canvas(element, {
        scale: 2, // রেজুলেশন বাড়ানোর জন্য
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff", // ২. ব্যাকগ্রাউন্ড সাদা করার জন্য (যাতে ডার্ক মোডেও লেখা ঠিক থাকে)
        scrollY: -window.scrollY,
        scrollX: 0,
      })

      // PDF বানানোর পর ইউজারকে আগের স্ক্রল পজিশনে ফেরত পাঠানো
      window.scrollTo(0, originalScrollTop)

      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF("p", "mm", "a4")

      const imgWidth = 210 // A4 প্রস্থ
      const pageHeight = 297 // A4 দৈর্ঘ্য
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      // প্রথম পেজ
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // বাকি পেজগুলোর জন্য লুপ
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`${templateName}.pdf`)
    } catch (error: any) {
      toast.error(error?.message || "PDF generation failed")
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading template...</p>
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="p-8 text-center text-destructive">
        Template not found.
      </div>
    )
  }

  return (
    <div className="min-h-screen py-3">
      <div className="mx-auto max-w-5xl px-4">
        {/* Header with Download Button */}
        <div className="mb-8 flex items-center justify-end">
          <Button
            onClick={downloadPDF}
            disabled={isDownloading}
            size="lg"
            className="gap-2"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                Download PDF Report
              </>
            )}
          </Button>
        </div>

        {/* Professional Live Preview */}
        <div className="overflow-hidden rounded-3xl" ref={reportRef}>
          {/* Cover Page */}
          <div className="bg-primary px-12 py-20 text-center text-primary-foreground">
            <div className="mx-auto mb-10 flex h-32 w-32 items-center justify-center rounded-2xl bg-white/20">
              {template?.templateLogo ? (
                <img
                  src={template.templateLogo}
                  alt="Logo"
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                <span className="text-7xl font-black text-white">
                  {templateName.charAt(0)}
                </span>
              )}
            </div>
            <h2 className="mb-6 text-5xl font-bold tracking-tight text-white">
              {templateName}
            </h2>
            {templateDisc && (
              <p className="mx-auto max-w-lg text-lg text-white/90">
                {templateDisc}
              </p>
            )}
            <p className="mt-8 text-sm text-white/70">
              Professional Report • {new Date().getFullYear()}
            </p>
          </div>

          {/* Sections */}
          {pages.map((page, idx) => (
            <div
              key={idx}
              className="my-5 rounded-md border border-border bg-card p-5"
            >
              <div className="mb-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-border" />
                <span className="rounded-md bg-emerald-100 px-5 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  SECTION - {idx + 1}
                </span>
              </div>

              <h3 className="mb-8 text-2xl font-semibold text-foreground">
                {page.title}
              </h3>

              <div className="space-y-10">
                {page.questions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="rounded-2xl border border-border bg-card p-8"
                  >
                    <p className="mb-4 text-lg font-medium text-foreground">
                      {qIdx + 1}. {q.question}
                    </p>

                    <div className="mb-3">
                      <span className="inline-block rounded bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        {getAnswerTypeLabel(q)}
                      </span>
                    </div>

                    <div className="min-h-10 rounded-xl border-2 border-dashed border-border bg-muted p-6 text-muted-foreground">
                      <p className="italic">{getAnswerHint(q)}</p>

                      {q.answerType === "media" && (
                        <div className="mt-6 text-center text-xs text-muted-foreground">
                          Click or drag files here to upload
                        </div>
                      )}

                      {q.answerType === "slider" && (
                        <div className="mt-8 h-2 w-full rounded-full bg-muted">
                          <div className="h-2 w-3/5 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Sign-off Section */}
          <div className="rounded-2xl border border-border bg-card p-10">
            <h3 className="mb-8 text-2xl font-semibold text-foreground">
              Approval & Sign-off
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {["Authorized By", "Signature & Date"].map((label, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border bg-card p-6 text-center"
                >
                  <p className="mb-3 text-sm text-muted-foreground">{label}</p>
                  <div className="h-20 rounded border border-dashed border-border" />
                </div>
              ))}
            </div>
            <p className="mt-10 text-center text-xs text-muted-foreground">
              This document was generated from the template system.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TemplateReportPage
