/* eslint-disable @typescript-eslint/no-explicit-any */
import SourceBadge from "@/components/dashboard/organization/SourceBadge"
import { mockCompliance } from "@/data/mockData"
import type { ComplianceObligation } from "@/types/organization"
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Save,
  Scale,
  Trash2,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"

const STATUS_ICONS: Record<string, React.ElementType> = {
  compliant: CheckCircle2,
  partial: Clock,
  non_compliant: Ban,
  pending: Clock,
}

const EMPTY_COMPLIANCE = {
  id: "",
  regulation: "",
  jurisdiction: "",
  description: "",
  deadline: "",
  status: "pending" as "compliant" | "partial" | "non_compliant" | "pending",
  penalty_estimate: 0,
  owner: "",
  ai_generated: false,
  is_edited: false,
}

export default function CompliancePage() {
  const [obligations, setObligations] =
    useState<ComplianceObligation[]>(mockCompliance)
  const [showForm, setShowForm] = useState(false)
  const [editingObl, setEditingObl] = useState<any>(null)
  const [form, setForm] = useState(EMPTY_COMPLIANCE)
  const [isSaving, setIsSaving] = useState(false)
  const [filterJurisdiction, setFilterJurisdiction] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [search, setSearch] = useState("")

  const jurisdictions = useMemo(() => {
    const set = new Set(obligations.map((o) => o.jurisdiction).filter(Boolean))
    return Array.from(set).sort()
  }, [obligations])

  const filtered = useMemo(() => {
    let result = obligations
    if (filterJurisdiction) {
      result = result.filter((o) => o.jurisdiction === filterJurisdiction)
    }
    if (filterStatus) {
      result = result.filter((o) => o.status === filterStatus)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          o.regulation.toLowerCase().includes(q) ||
          (o.description || "").toLowerCase().includes(q)
      )
    }
    return result
  }, [obligations, filterJurisdiction, filterStatus, search])

  const openCreate = () => {
    setEditingObl(null)
    setForm(EMPTY_COMPLIANCE)
    setShowForm(true)
  }

  const openEdit = (obl: any) => {
    setEditingObl(obl)
    setForm({
      id: obl.id,
      regulation: obl.regulation,
      jurisdiction: obl.jurisdiction || "",
      description: obl.description || "",
      deadline: obl.deadline || "",
      status: obl.status,
      penalty_estimate: Number(obl.penalty_estimate),
      owner: obl.owner || "",
      ai_generated: obl.ai_generated || false,
      is_edited: obl.is_edited || false,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.regulation.trim()) return

    setIsSaving(true)

    if (editingObl) {
      // Replace the edited obligation in place; mark it as human-edited so
      // the SourceBadge reflects the change.
      setObligations((prev) =>
        prev.map((o) =>
          o.id === form.id ? { ...o, ...form, is_edited: true } : o
        )
      )
    } else {
      // Append the newly created obligation. These pages are still on mock
      // data (issues #92/#93), so we mint a local id and timestamps rather
      // than relying on a backend to assign them.
      const now = new Date().toISOString()
      const newObl: ComplianceObligation = {
        ...form,
        id: crypto.randomUUID(),
        organization_id: "",
        user_id: "",
        ai_generated: false,
        is_edited: false,
        created_at: now,
        updated_at: now,
      }
      setObligations((prev) => [newObl, ...prev])
    }

    setShowForm(false)
    setForm(EMPTY_COMPLIANCE)
    setIsSaving(false)
  }

  const handleDelete = (id: string) => {
    if (!confirm("Delete this compliance obligation?")) return
    setObligations((prev) => prev.filter((o) => o.id !== id))
    alert("Compliance obligation deleted")
  }

  const compliantCount = filtered.filter((c) => c.status === "compliant").length
  const nonCompliantCount = filtered.filter(
    (c) => c.status === "non_compliant"
  ).length
  const totalPenalty = filtered.reduce(
    (s, c) => s + Number(c.penalty_estimate),
    0
  )

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="animate-fade-in flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl">
            Compliance Obligations
          </h1>
          <p className="text-sm text-muted-foreground">
            {obligations.length} obligations tracked • {jurisdictions.length}{" "}
            jurisdictions
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> New Obligation
        </button>
      </div>

      {/* Filters */}
      <div className="animate-slide-up flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search regulations or description..."
            className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-3 text-xs"
          />
        </div>
        <select
          value={filterJurisdiction}
          onChange={(e) => setFilterJurisdiction(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-xs"
        >
          <option value="">All Jurisdictions</option>
          {jurisdictions.map((j) => (
            <option key={j} value={j as string}>
              {j}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-xs"
        >
          <option value="">All Statuses</option>
          <option value="compliant">Compliant</option>
          <option value="partial">Partial</option>
          <option value="non_compliant">Non-Compliant</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="animate-slide-up grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-risk-low/30 bg-risk-low/5 p-3 lg:p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-risk-low" />
            <span className="font-mono-data text-xl font-bold text-risk-low lg:text-2xl">
              {compliantCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Compliant</p>
        </div>
        <div className="rounded-xl border border-risk-critical/30 bg-risk-critical/5 p-3 lg:p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-risk-critical" />
            <span className="font-mono-data text-xl font-bold text-risk-critical lg:text-2xl">
              {nonCompliantCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Non-Compliant</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 lg:p-4">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <span className="font-mono-data text-xl font-bold text-foreground lg:text-2xl">
              €{(totalPenalty / 1000000).toFixed(1)}M
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Total Penalty Exposure
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="animate-slide-up stagger-2 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground lg:px-4">
                REGULATION
              </th>
              <th className="hidden px-3 py-3 text-left text-xs font-semibold text-muted-foreground sm:table-cell">
                JURISDICTION
              </th>
              <th className="hidden px-3 py-3 text-center text-xs font-semibold text-muted-foreground md:table-cell">
                DEADLINE
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
                STATUS
              </th>
              <th className="hidden px-3 py-3 text-right text-xs font-semibold text-muted-foreground lg:table-cell">
                PENALTY
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
                SOURCE
              </th>
              <th className="w-16 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((obl) => {
              const StatusIcon = STATUS_ICONS[obl.status] || Clock
              const isOverdue =
                obl.deadline &&
                new Date(obl.deadline) < new Date() &&
                obl.status !== "compliant"
              const penalty = Number(obl.penalty_estimate)

              return (
                <tr
                  key={obl.id}
                  className="group border-b border-border transition-colors hover:bg-muted/30"
                >
                  <td className="px-3 py-3 lg:px-4">
                    <p className="font-medium text-foreground">
                      {obl.regulation}
                    </p>
                    <p className="hidden max-w-xs truncate text-[10px] text-muted-foreground sm:block">
                      {obl.description}
                    </p>
                  </td>
                  <td className="hidden px-3 py-3 text-xs text-muted-foreground sm:table-cell">
                    {obl.jurisdiction}
                  </td>
                  <td className="hidden px-3 py-3 text-center md:table-cell">
                    <span
                      className={`font-mono-data text-xs ${
                        isOverdue
                          ? "font-bold text-risk-critical"
                          : "text-muted-foreground"
                      }`}
                    >
                      {obl.deadline
                        ? new Date(obl.deadline).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        obl.status === "compliant"
                          ? "bg-risk-low/10 text-risk-low"
                          : obl.status === "non_compliant"
                            ? "bg-risk-critical/10 text-risk-critical"
                            : obl.status === "partial"
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {obl.status === "compliant"
                        ? "Compliant"
                        : obl.status === "non_compliant"
                          ? "Non-Compliant"
                          : obl.status === "partial"
                            ? "Partial"
                            : "Pending"}
                    </span>
                  </td>
                  <td className="font-mono-data hidden px-3 py-3 text-right text-xs font-semibold text-foreground lg:table-cell">
                    €
                    {penalty >= 1000000
                      ? `${(penalty / 1000000).toFixed(1)}M`
                      : `${(penalty / 1000).toFixed(0)}K`}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <SourceBadge
                      aiGenerated={obl.ai_generated}
                      isEdited={obl.is_edited}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => openEdit(obl)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(obl.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {editingObl
                  ? "Edit Compliance Obligation"
                  : "New Compliance Obligation"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Regulation *
                </label>
                <input
                  value={form.regulation}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, regulation: e.target.value }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Jurisdiction
                  </label>
                  <input
                    value={form.jurisdiction}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, jurisdiction: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, deadline: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        status: e.target.value as any,
                      }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="compliant">Compliant</option>
                    <option value="non_compliant">Non-Compliant</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Penalty (€)
                  </label>
                  <input
                    type="number"
                    value={form.penalty_estimate}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        penalty_estimate: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Owner
                  </label>
                  <input
                    value={form.owner}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, owner: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !form.regulation.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {editingObl ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
