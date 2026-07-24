import SourceBadge from "@/components/dashboard/organization/SourceBadge"
import type {
  ComplianceObligation,
  ComplianceScoreBand,
} from "@/redux/apis/organization/compliance.api"
import {
  useCreateComplianceMutation,
  useDeleteComplianceMutation,
  useGetAllComplianceQuery,
  useGetComplianceScorecardQuery,
  useUpdateComplianceMutation,
} from "@/redux/apis/organization/compliance.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import { COMPLIANCE_DOMAINS } from "@/utils/complianceConfig"
import {
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  MinusCircle,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

// Loose string statuses matching the backend (Risk.status convention).
const STATUS_KEYS = [
  "compliant",
  "in_progress",
  "non_compliant",
  "not_applicable",
] as const

const STATUS_ICONS: Record<string, React.ElementType> = {
  compliant: CheckCircle2,
  in_progress: Clock,
  non_compliant: Ban,
  not_applicable: MinusCircle,
}

const STATUS_BADGE: Record<string, string> = {
  compliant: "bg-risk-low/10 text-risk-low",
  in_progress: "bg-amber-500/10 text-amber-600",
  non_compliant: "bg-risk-critical/10 text-risk-critical",
  not_applicable: "bg-muted text-muted-foreground",
}

// Red/orange/green banding from the scorecard endpoint (CDC 7.7 thresholds).
const BAND_CLASSES: Record<ComplianceScoreBand, string> = {
  green: "bg-risk-low/10 text-risk-low border-risk-low/30",
  orange: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  red: "bg-risk-critical/10 text-risk-critical border-risk-critical/30",
  none: "bg-muted text-muted-foreground border-border",
}

const EMPTY_FORM = {
  id: "",
  title: "",
  description: "",
  domain: Object.keys(COMPLIANCE_DOMAINS)[0],
  site_id: "",
  status: "in_progress" as string,
  owner: "",
  due_date: "",
  attachments: [] as string[],
}

export default function CompliancePage() {
  const { t } = useTranslation()

  const { data: complianceData, isLoading } = useGetAllComplianceQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
  })
  const { data: scorecardData } = useGetComplianceScorecardQuery()
  const { data: sitesData } = useGetAllSitesQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
  })

  const [createCompliance, { isLoading: isCreating }] =
    useCreateComplianceMutation()
  const [updateCompliance, { isLoading: isUpdating }] =
    useUpdateComplianceMutation()
  const [deleteCompliance] = useDeleteComplianceMutation()

  const obligations: ComplianceObligation[] = useMemo(
    () => complianceData?.data || [],
    [complianceData]
  )
  const scorecard = scorecardData?.data
  const sites = sitesData?.data || []

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)
  const [filterDomain, setFilterDomain] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [search, setSearch] = useState("")

  // Domain/status labels are echoed as raw keys until i18n initializes (tests),
  // and translated in the running app — same t() convention as RiskRegisterPage.
  const domainLabel = (key: string) =>
    COMPLIANCE_DOMAINS[key]
      ? t(`organization.compliance.domains.${key}`)
      : key
  const statusLabel = (key: string) =>
    STATUS_ICONS[key] ? t(`organization.compliance.status.${key}`) : key

  const siteName = (siteId: string | null) =>
    siteId ? (sites.find((s) => s.id === siteId)?.name ?? siteId) : null

  const filtered = useMemo(() => {
    let result = obligations
    if (filterDomain) result = result.filter((o) => o.domain === filterDomain)
    if (filterStatus) result = result.filter((o) => o.status === filterStatus)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          (o.description || "").toLowerCase().includes(q) ||
          (o.owner || "").toLowerCase().includes(q)
      )
    }
    return result
  }, [obligations, filterDomain, filterStatus, search])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (obl: ComplianceObligation) => {
    setEditingId(obl.id)
    setForm({
      id: obl.id,
      title: obl.title,
      description: obl.description || "",
      domain: obl.domain,
      site_id: obl.site_id || "",
      status: obl.status,
      owner: obl.owner || "",
      // date input wants yyyy-mm-dd; the API returns a full ISO timestamp.
      due_date: obl.due_date ? obl.due_date.slice(0, 10) : "",
      attachments: obl.attachments || [],
    })
    setShowForm(true)
  }

  const uploadAttachment = async (file: File) => {
    setUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch(`${BASE_URL}/api/compliance/attachment`, {
        method: "POST",
        credentials: "include",
        body,
      })
      if (!res.ok) throw new Error("Upload failed")
      const json = await res.json()
      const url: string = json.data?.url ?? json.url ?? ""
      if (url) {
        setForm((f) => ({ ...f, attachments: [...f.attachments, url] }))
      } else {
        toast.error(t("organization.compliance.toast.uploadFailed"))
      }
    } catch {
      toast.error(t("organization.compliance.toast.uploadFailed"))
    } finally {
      setUploading(false)
    }
  }

  const removeAttachment = (url: string) => {
    setForm((f) => ({
      ...f,
      attachments: f.attachments.filter((a) => a !== url),
    }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) return

    const payload: Partial<ComplianceObligation> = {
      title: form.title,
      description: form.description,
      domain: form.domain,
      // "" means org-wide — send null so the backend stores NULL, not a bad FK.
      site_id: form.site_id || null,
      status: form.status,
      owner: form.owner,
      due_date: form.due_date || null,
      attachments: form.attachments,
    }

    try {
      let res
      if (editingId) {
        res = await updateCompliance({
          id: editingId,
          // Mark as human-edited so the SourceBadge reflects the change,
          // matching the prior local-state behaviour.
          data: { ...payload, is_edited: true },
        }).unwrap()
      } else {
        res = await createCompliance(payload).unwrap()
      }

      if (res.success) {
        toast.success(
          editingId
            ? t("organization.compliance.toast.updateSuccess")
            : t("organization.compliance.toast.createSuccess")
        )
        setShowForm(false)
        setForm(EMPTY_FORM)
      } else {
        toast.error(res.message || t("organization.compliance.toast.saveFailed"))
      }
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        t("organization.compliance.toast.saveFailed")
      toast.error(message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("organization.compliance.deleteConfirm"))) return
    try {
      const res = await deleteCompliance(id).unwrap()
      if (res.success) {
        toast.success(t("organization.compliance.toast.deleteSuccess"))
      } else {
        toast.error(
          res.message || t("organization.compliance.toast.deleteFailed")
        )
      }
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        t("organization.compliance.toast.deleteFailed")
      toast.error(message)
    }
  }

  const compliantCount = obligations.filter(
    (o) => o.status === "compliant"
  ).length
  const nonCompliantCount = obligations.filter(
    (o) => o.status === "non_compliant"
  ).length

  const overall = scorecard?.overall
  const overallPct =
    overall && overall.total > 0 ? Math.round(overall.ratio * 100) : 0

  // Distinct sites and domains present in the matrix, for the site×domain grid.
  const matrixDomains = useMemo(() => {
    if (!scorecard) return []
    return Array.from(new Set(scorecard.matrix.map((m) => m.domain))).sort()
  }, [scorecard])
  const matrixSiteKeys = useMemo(() => {
    if (!scorecard) return []
    const keys = new Set(scorecard.matrix.map((m) => m.site_id ?? "__org__"))
    return Array.from(keys)
  }, [scorecard])
  const cellFor = (siteKey: string, domain: string) => {
    const siteId = siteKey === "__org__" ? null : siteKey
    return scorecard?.matrix.find(
      (m) => (m.site_id ?? null) === siteId && m.domain === domain
    )
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="animate-fade-in flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl">
            {t("organization.compliance.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organization.compliance.subtitle", {
              count: obligations.length,
            })}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" />{" "}
          {t("organization.compliance.newObligation")}
        </button>
      </div>

      {/* Filters */}
      <div className="animate-slide-up flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("organization.compliance.searchPlaceholder")}
            className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-3 text-xs"
          />
        </div>
        <select
          value={filterDomain}
          onChange={(e) => setFilterDomain(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-xs"
        >
          <option value="">{t("organization.compliance.allDomains")}</option>
          {Object.keys(COMPLIANCE_DOMAINS).map((key) => (
            <option key={key} value={key}>
              {domainLabel(key)}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-xs"
        >
          <option value="">{t("organization.compliance.allStatuses")}</option>
          {STATUS_KEYS.map((key) => (
            <option key={key} value={key}>
              {statusLabel(key)}
            </option>
          ))}
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
          <p className="mt-1 text-xs text-muted-foreground">
            {t("organization.compliance.card.compliant")}
          </p>
        </div>
        <div className="rounded-xl border border-risk-critical/30 bg-risk-critical/5 p-3 lg:p-4">
          <div className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-risk-critical" />
            <span className="font-mono-data text-xl font-bold text-risk-critical lg:text-2xl">
              {nonCompliantCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("organization.compliance.card.nonCompliant")}
          </p>
        </div>
        <div
          className={`rounded-xl border p-3 lg:p-4 ${
            overall ? BAND_CLASSES[overall.band] : "border-border bg-card"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono-data text-xl font-bold lg:text-2xl">
              {overall && overall.total > 0 ? `${overallPct}%` : "—"}
            </span>
          </div>
          <p className="mt-1 text-xs opacity-80">
            {t("organization.compliance.card.overallScore")}
          </p>
        </div>
      </div>

      {/* Scorecard: site × domain matrix */}
      <div className="animate-slide-up stagger-1 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t("organization.compliance.scorecard.title")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("organization.compliance.scorecard.subtitle")}
          </p>
        </div>
        {scorecard && scorecard.matrix.length > 0 ? (
          <div className="overflow-x-auto p-4">
            <table className="w-full border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left font-semibold text-muted-foreground">
                    {t("organization.compliance.scorecard.site")}
                  </th>
                  {matrixDomains.map((d) => (
                    <th
                      key={d}
                      className="px-2 py-1 text-center font-semibold text-muted-foreground"
                    >
                      {domainLabel(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixSiteKeys.map((siteKey) => (
                  <tr key={siteKey}>
                    <td className="px-2 py-1 font-medium text-foreground">
                      {siteKey === "__org__"
                        ? t("organization.compliance.scorecard.orgWide")
                        : siteName(siteKey)}
                    </td>
                    {matrixDomains.map((d) => {
                      const cell = cellFor(siteKey, d)
                      return (
                        <td key={d} className="px-1 py-1 text-center">
                          <span
                            className={`inline-block min-w-12 rounded-md border px-2 py-1 font-mono-data ${
                              BAND_CLASSES[cell?.band ?? "none"]
                            }`}
                            title={
                              cell
                                ? `${cell.compliant}/${cell.total}`
                                : undefined
                            }
                          >
                            {cell ? `${cell.compliant}/${cell.total}` : "—"}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground">
            {t("organization.compliance.scorecard.noData")}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="animate-slide-up stagger-2 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground lg:px-4">
                {t("organization.compliance.col.obligation")}
              </th>
              <th className="hidden px-3 py-3 text-left text-xs font-semibold text-muted-foreground sm:table-cell">
                {t("organization.compliance.col.domain")}
              </th>
              <th className="hidden px-3 py-3 text-center text-xs font-semibold text-muted-foreground md:table-cell">
                {t("organization.compliance.col.dueDate")}
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
                {t("organization.compliance.col.status")}
              </th>
              <th className="hidden px-3 py-3 text-left text-xs font-semibold text-muted-foreground lg:table-cell">
                {t("organization.compliance.col.owner")}
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
                {t("organization.compliance.col.source")}
              </th>
              <th className="w-16 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((obl) => {
              const StatusIcon = STATUS_ICONS[obl.status] || Clock
              const isOverdue =
                obl.due_date &&
                new Date(obl.due_date) < new Date() &&
                obl.status !== "compliant" &&
                obl.status !== "not_applicable"

              return (
                <tr
                  key={obl.id}
                  className="group border-b border-border transition-colors hover:bg-muted/30"
                >
                  <td className="px-3 py-3 lg:px-4">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-foreground">{obl.title}</p>
                      {obl.attachments.length > 0 && (
                        <Paperclip className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <p className="hidden max-w-xs truncate text-[10px] text-muted-foreground sm:block">
                      {obl.description}
                    </p>
                  </td>
                  <td className="hidden px-3 py-3 text-xs text-muted-foreground sm:table-cell">
                    {domainLabel(obl.domain)}
                  </td>
                  <td className="hidden px-3 py-3 text-center md:table-cell">
                    <span
                      className={`font-mono-data text-xs ${
                        isOverdue
                          ? "font-bold text-risk-critical"
                          : "text-muted-foreground"
                      }`}
                    >
                      {obl.due_date
                        ? new Date(obl.due_date).toLocaleDateString("en-US", {
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
                        STATUS_BADGE[obl.status] ||
                        "bg-muted text-muted-foreground"
                      }`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusLabel(obl.status)}
                    </span>
                  </td>
                  <td className="hidden px-3 py-3 text-xs text-muted-foreground lg:table-cell">
                    {obl.owner || "—"}
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

        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            {t("organization.compliance.empty")}
          </div>
        )}
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
                {editingId
                  ? t("organization.compliance.form.editTitle")
                  : t("organization.compliance.form.newTitle")}
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
                  {t("organization.compliance.form.title")} *
                </label>
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, title: e.target.value }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("organization.compliance.form.domain")}
                  </label>
                  <select
                    value={form.domain}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, domain: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.keys(COMPLIANCE_DOMAINS).map((key) => (
                      <option key={key} value={key}>
                        {domainLabel(key)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("organization.compliance.form.site")}
                  </label>
                  <select
                    value={form.site_id}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, site_id: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">
                      {t("organization.compliance.form.orgWide")}
                    </option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("organization.compliance.form.description")}
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
                    {t("organization.compliance.form.status")}
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, status: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {STATUS_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {statusLabel(key)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("organization.compliance.form.dueDate")}
                  </label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, due_date: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("organization.compliance.form.owner")}
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

              {/* Evidence attachments */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("organization.compliance.form.attachments")}
                </label>
                <div className="space-y-1">
                  {form.attachments.map((url) => (
                    <div
                      key={url}
                      className="flex items-center justify-between gap-2 rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-w-0 items-center gap-1 truncate text-primary"
                      >
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {url.split("/").pop()}
                        </span>
                      </a>
                      <button
                        type="button"
                        onClick={() => removeAttachment(url)}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="mt-1 flex cursor-pointer items-center gap-1 rounded-md bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80">
                  {uploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  {t("organization.compliance.form.uploadEvidence")}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
                    onChange={(e) =>
                      e.target.files?.[0] && uploadAttachment(e.target.files[0])
                    }
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                {t("organization.compliance.form.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={isCreating || isUpdating || !form.title.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {isCreating || isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {editingId
                  ? t("organization.compliance.form.update")
                  : t("organization.compliance.form.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
