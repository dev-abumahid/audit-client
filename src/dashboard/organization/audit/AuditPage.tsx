/* eslint-disable @typescript-eslint/no-explicit-any */
import SourceBadge from "@/components/dashboard/organization/SourceBadge"
import { mockAuditEngagements } from "@/data/mockData"
import type { AuditEngagement } from "@/types/organization"
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  Upload,
} from "lucide-react"
import { useState } from "react"

const STATUS_ICONS: Record<string, React.ElementType> = {
  planned: Play,
  in_progress: Pause,
  completed: CheckCircle2,
}

const EMPTY_FORM = {
  ref: "",
  title: "",
  scope: "",
  status: "planned" as "planned" | "in_progress" | "completed",
  lead_auditor: "",
  priority_score: 50,
  findings_count: 0,
  linked_risk_refs: "",
  started_at: "",
  closed_at: "",
}

export default function AuditPage() {
  const [engagements, setEngagements] =
    useState<AuditEngagement[]>(mockAuditEngagements)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState<string | null>(null)

  const STATUS_CONFIG: Record<
    string,
    { label: string; bg: string; text: string }
  > = {
    planned: { label: "Planned", bg: "bg-blue-500/10", text: "text-blue-600" },
    in_progress: {
      label: "In Progress",
      bg: "bg-orange-500/10",
      text: "text-orange-600",
    },
    completed: {
      label: "Completed",
      bg: "bg-green-500/10",
      text: "text-green-600",
    },
  }

  const openCreate = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (eng: any) => {
    setEditId(eng.id)
    setForm({
      ref: eng.ref,
      title: eng.title,
      scope: eng.scope || "",
      status: eng.status,
      lead_auditor: eng.lead_auditor || "",
      priority_score: eng.priority_score,
      findings_count: eng.findings_count,
      linked_risk_refs: eng.linked_risk_refs
        ? eng.linked_risk_refs.join(", ")
        : "",
      started_at: eng.started_at || "",
      closed_at: eng.closed_at || "",
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.ref || !form.title) return
    // when i make api then i will use this payload
    // const payload = {
    //   ...form,
    //   linked_risk_refs: form.linked_risk_refs
    //     ? form.linked_risk_refs
    //         .split(",")
    //         .map((s) => s.trim())
    //         .filter(Boolean)
    //     : [],
    // }
    setShowModal(false)
    setForm(EMPTY_FORM)
  }

  const handleDelete = (id: string) => {
    if (!confirm("Delete this audit engagement?")) return
    setEngagements((prev) => prev.filter((e) => e.id !== id))
    alert("Audit engagement deleted")
  }

  const handleReportUpload = async (engId: string, file: File) => {
    setUploading(engId)

    alert(`Report "${file.name}" uploaded successfully`)
    setUploading(null)
  }

  const handleDownloadReport = (reportUrl: string) => {
    alert(`Opening report: ${reportUrl}`)
    // In a real app, this would open the signed URL
  }

  const inProgressCount = engagements.filter(
    (e) => e.status === "in_progress"
  ).length
  const completedCount = engagements.filter(
    (e) => e.status === "completed"
  ).length
  const totalFindings = engagements.reduce(
    (sum, e) => sum + e.findings_count,
    0
  )

  return (
    <div className="space-y-6 p-6">
      <div className="animate-fade-in flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Audit Engagements
          </h1>
          <p className="text-sm text-muted-foreground">
            Internal and external audit missions tracking
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New Audit Mission
        </button>
      </div>

      {/* Summary Stats */}
      <div className="animate-slide-up flex gap-4 text-xs">
        <div className="rounded-lg border border-border bg-card px-4 py-2.5">
          <span className="font-mono text-lg font-bold text-foreground">
            {engagements.length}
          </span>
          <span className="ml-2 text-muted-foreground">Total</span>
        </div>
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-2.5">
          <span className="font-mono text-lg font-bold text-orange-600">
            {inProgressCount}
          </span>
          <span className="ml-2 text-muted-foreground">In Progress</span>
        </div>
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-2.5">
          <span className="font-mono text-lg font-bold text-green-600">
            {completedCount}
          </span>
          <span className="ml-2 text-muted-foreground">Completed</span>
        </div>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5">
          <span className="font-mono text-lg font-bold text-destructive">
            {totalFindings}
          </span>
          <span className="ml-2 text-muted-foreground">Total Findings</span>
        </div>
      </div>

      {/* Audit List */}
      <div className="animate-slide-up stagger-2 space-y-3">
        {engagements.map((eng) => {
          const statusCfg = STATUS_CONFIG[eng.status] || STATUS_CONFIG.planned
          const Icon = STATUS_ICONS[eng.status] || Play
          const hasReport = !!eng.report_url

          return (
            <div
              key={eng.id}
              className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${statusCfg.bg}`}
                  >
                    <Icon className={`h-4 w-4 ${statusCfg.text}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-muted-foreground">
                        {eng.ref}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.bg} ${statusCfg.text}`}
                      >
                        {statusCfg.label}
                      </span>
                      <SourceBadge
                        aiGenerated={eng.ai_generated}
                        isEdited={eng.is_edited}
                      />
                    </div>
                    <h3 className="mt-0.5 text-sm font-semibold text-foreground">
                      {eng.title}
                    </h3>
                    {eng.scope && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {eng.scope}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasReport ? (
                    <button
                      onClick={() => handleDownloadReport(eng.report_url!)}
                      className="flex items-center gap-1 rounded-md bg-green-500/10 px-2 py-1 text-[10px] font-medium text-green-600 hover:bg-green-500/20"
                    >
                      <FileText className="h-3 w-3" /> Report{" "}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/80">
                      {uploading === eng.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      Upload Report
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg"
                        onChange={(e) =>
                          e.target.files?.[0] &&
                          handleReportUpload(eng.id, e.target.files[0])
                        }
                      />
                    </label>
                  )}

                  <button
                    onClick={() => openEdit(eng)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(eng.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                {eng.lead_auditor && (
                  <span>
                    Auditor:{" "}
                    <span className="font-medium text-foreground">
                      {eng.lead_auditor}
                    </span>
                  </span>
                )}
                <span>
                  Priority:{" "}
                  <span className="font-mono font-bold text-foreground">
                    {eng.priority_score}
                  </span>
                </span>
                <span>
                  Findings:{" "}
                  <span className="font-mono font-bold text-foreground">
                    {eng.findings_count}
                  </span>
                </span>
                {eng.linked_risk_refs && eng.linked_risk_refs.length > 0 && (
                  <span>
                    Linked Risks:{" "}
                    <span className="font-mono text-primary">
                      {eng.linked_risk_refs.join(", ")}
                    </span>
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {engagements.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">No audit engagements found</p>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-bold text-foreground">
              {editId ? "Edit Audit Engagement" : "New Audit Engagement"}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Reference
                </label>
                <input
                  value={form.ref}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ref: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  placeholder="AUD-2026-001"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as any }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Title
              </label>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Scope
              </label>
              <textarea
                value={form.scope}
                onChange={(e) =>
                  setForm((f) => ({ ...f, scope: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Lead Auditor
                </label>
                <input
                  value={form.lead_auditor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lead_auditor: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Findings Count
                </label>
                <input
                  type="number"
                  value={form.findings_count}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      findings_count: Number(e.target.value),
                    }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Start Date
                </label>
                <input
                  type="date"
                  value={form.started_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, started_at: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  End Date
                </label>
                <input
                  type="date"
                  value={form.closed_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, closed_at: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Linked Risk References
              </label>
              <input
                value={form.linked_risk_refs}
                onChange={(e) =>
                  setForm((f) => ({ ...f, linked_risk_refs: e.target.value }))
                }
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                placeholder="CY-01, OP-02"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.ref || !form.title}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                {editId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
