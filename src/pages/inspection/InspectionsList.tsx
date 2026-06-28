import { ApiError, api } from '@/lib/api'
import type { InspectionStatus, InspectionSummary } from '@/types/inspection'
import { ClipboardCheck, Plus, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

const STATUS_LABELS: Record<InspectionStatus, string> = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const STATUS_CLASSES: Record<InspectionStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
}

interface Site { id: string; name: string }
interface Template { id: string; templateName: string }

export default function InspectionsList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [inspections, setInspections] = useState<InspectionSummary[]>([])
  const [meta, setMeta] = useState({ page: 1, totalPage: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const status = searchParams.get('status') ?? ''
  const page = Number(searchParams.get('page') ?? '1')
  const searchTerm = searchParams.get('searchTerm') ?? ''

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSites, setModalSites] = useState<Site[]>([])
  const [modalTemplates, setModalTemplates] = useState<Template[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '10' })
    if (status) params.set('status', status)
    if (searchTerm) params.set('searchTerm', searchTerm)

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const json = await api.get<{ data: InspectionSummary[]; meta: typeof meta }>(
          `/api/inspection?${params}`,
        )
        setInspections(json.data ?? [])
        setMeta(json.meta ?? { page: 1, totalPage: 1, total: 0 })
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load inspections')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [status, page, searchTerm])

  function setParam(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page') // reset pagination on filter change
      return next
    })
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setParam('searchTerm', searchRef.current?.value ?? '')
  }

  async function openModal() {
    setModalOpen(true)
    setSelectedSiteId('')
    setSelectedTemplateId('')
    setStartError(null)
    setModalLoading(true)
    try {
      const [sitesRes, templatesRes] = await Promise.all([
        api.get<{ data: Site[] }>('/api/site?page=1&limit=100'),
        api.get<{ data: Template[] }>('/api/template?page=1&limit=100'),
      ])
      setModalSites(sitesRes.data ?? [])
      setModalTemplates(templatesRes.data ?? [])
    } catch {
      setStartError('Failed to load sites or templates')
    } finally {
      setModalLoading(false)
    }
  }

  function closeModal() {
    setModalOpen(false)
    setSelectedSiteId('')
    setSelectedTemplateId('')
    setStartError(null)
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSiteId || !selectedTemplateId) return
    setStarting(true)
    setStartError(null)
    try {
      const res = await api.post<{ id: string }>('/api/inspection', {
        templateId: selectedTemplateId,
        siteId: selectedSiteId,
        questionAnswers: [],
      })
      navigate(`/organization/audit/inspections/${res.id}`)
      closeModal()
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : 'Failed to start inspection')
      setStarting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Inspections</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? '…' : `${meta.total} inspection${meta.total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New inspection
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            defaultValue={searchTerm}
            type="text"
            placeholder="Search by template…"
            className="h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          />
        </form>

        <select
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABELS) as InspectionStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : inspections.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <ClipboardCheck className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No inspections found</p>
          <button
            onClick={openModal}
            className="text-sm font-medium text-primary hover:underline"
          >
            Create your first inspection
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Template</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Site</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Inspector</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inspections.map((inspection) => (
                <tr key={inspection.id} className="bg-card hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {inspection.template?.templateName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {inspection.site?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {inspection.inspector?.fullName ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[inspection.status]}`}
                    >
                      {STATUS_LABELS[inspection.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(inspection.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/organization/audit/inspections/${inspection.id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {inspection.status === 'COMPLETED' ? 'View' : 'Continue'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta.totalPage > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {meta.page} of {meta.totalPage}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setParam('page', String(page - 1))}
              className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-muted"
            >
              Previous
            </button>
            <button
              disabled={page >= meta.totalPage}
              onClick={() => setParam('page', String(page + 1))}
              className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* New Inspection Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-sm font-medium text-foreground">Start New Inspection</h2>
            <p className="mb-6 text-xs text-muted-foreground">Select a site and template to begin.</p>

            {modalLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <form onSubmit={handleStart} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="modal-site" className="text-sm font-medium text-foreground">Site</label>
                  <select
                    id="modal-site"
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <option value="">Choose a site…</option>
                    {modalSites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="modal-template" className="text-sm font-medium text-foreground">Template</label>
                  <select
                    id="modal-template"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <option value="">Choose a template…</option>
                    {modalTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.templateName}</option>
                    ))}
                  </select>
                </div>

                {startError && (
                  <p className="text-sm text-destructive">{startError}</p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedSiteId || !selectedTemplateId || starting}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {starting ? 'Starting…' : 'Start Inspection'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
