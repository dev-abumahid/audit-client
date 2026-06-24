import { api, ApiError } from '@/lib/api'
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

type ActionPriority = 'Low' | 'Medium' | 'High'
type ActionStatus = 'TO_DO' | 'IN_PROGRESS' | 'COMPLETE' | 'CANT_DO'

interface Action {
  id: string
  inspectionId: string
  actionTitle: string
  actionDisc: string
  priority: ActionPriority
  dueDate: string
  status: ActionStatus
  site: { id: string; name: string } | null
}

const PRIORITY_CLASSES: Record<ActionPriority, string> = {
  Low: 'bg-slate-100 text-slate-600',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-red-100 text-red-600',
}

const STATUS_LABELS: Record<ActionStatus, string> = {
  TO_DO: 'To do',
  IN_PROGRESS: 'In progress',
  COMPLETE: 'Complete',
  CANT_DO: "Can't do",
}

const STATUS_CLASSES: Record<ActionStatus, string> = {
  TO_DO: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETE: 'bg-green-100 text-green-700',
  CANT_DO: 'bg-red-100 text-red-600',
}

const EMPTY_FORM = {
  actionTitle: '',
  actionDisc: '',
  priority: 'Medium' as ActionPriority,
  dueDate: '',
  status: 'TO_DO' as ActionStatus,
}

type FormState = typeof EMPTY_FORM

function ActionForm({
  title,
  form,
  setForm,
  onSubmit,
  onCancel,
  submitting,
  formError,
  submitLabel,
}: {
  title: string
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  submitting: boolean
  formError: string | null
  submitLabel: string
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-border bg-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Title *</label>
        <input
          required
          value={form.actionTitle}
          onChange={(e) => setForm((f) => ({ ...f, actionTitle: e.target.value }))}
          placeholder="e.g. Replace faulty extinguisher in Zone B"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Description *</label>
        <textarea
          required
          rows={3}
          value={form.actionDisc}
          onChange={(e) => setForm((f) => ({ ...f, actionDisc: e.target.value }))}
          placeholder="Describe what needs to be done…"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground resize-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Priority *</label>
          <select
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as ActionPriority }))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Due date *</label>
          <input
            required
            type="date"
            value={form.dueDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          />
        </div>
      </div>

      {formError && <p className="text-xs text-destructive">{formError}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

export default function InspectionActions() {
  const { id: inspectionId } = useParams<{ id: string }>()

  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchParams] = useSearchParams()

  // create form
  const [showCreate, setShowCreate] = useState(() => searchParams.get('new') === '1')
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // edit form
  const [editingAction, setEditingAction] = useState<Action | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [updating, setUpdating] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteInFlight, setDeleteInFlight] = useState(false)

  function loadActions() {
    if (!inspectionId) return
    setLoading(true)
    api
      .get<{ data: Action[] }>('/api/action')
      .then((res) => {
        const actions = res?.data ?? []
        setActions(actions.filter((a) => a.inspectionId === inspectionId))
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load actions')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadActions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!inspectionId) return
    setCreating(true)
    setCreateError(null)
    try {
      const created = await api.post<Action>('/api/action', {
        ...createForm,
        inspectionId,
        dueDate: new Date(createForm.dueDate).toISOString(),
      })
      setActions((prev) => [created, ...prev])
      setCreateForm(EMPTY_FORM)
      setShowCreate(false)
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create action')
    } finally {
      setCreating(false)
    }
  }

  function openEdit(action: Action) {
    setEditingAction(action)
    setEditForm({
      actionTitle: action.actionTitle,
      actionDisc: action.actionDisc,
      priority: action.priority,
      dueDate: action.dueDate.slice(0, 10),
      status: action.status,
    })
    setEditError(null)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingAction) return
    setUpdating(true)
    setEditError(null)
    try {
      const updated = await api.patch<Action>(`/api/action/${editingAction.id}`, {
        ...editForm,
        dueDate: new Date(editForm.dueDate).toISOString(),
      })
      setActions((prev) => prev.map((a) => (a.id === editingAction.id ? updated : a)))
      setEditingAction(null)
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'Failed to update action')
    } finally {
      setUpdating(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleteInFlight(true)
    try {
      await api.delete(`/api/action/${id}`)
      setActions((prev) => prev.filter((a) => a.id !== id))
      setDeletingId(null)
    } catch {
      setDeletingId(null)
    } finally {
      setDeleteInFlight(false)
    }
  }

  async function updateStatus(id: string, status: ActionStatus) {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
    try {
      await api.patch(`/api/action/${id}`, { status })
    } catch {
      loadActions()
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/organization/audit/inspections" className="hover:text-foreground">
          Inspections
        </Link>
        <span>/</span>
        <Link to={`/organization/audit/inspections/${inspectionId}`} className="hover:text-foreground">
          Inspection
        </Link>
        <span>/</span>
        <span className="text-foreground">Actions</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Corrective actions</h1>
          {!loading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {actions.length} action{actions.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditingAction(null) }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New action
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <ActionForm
          title="New corrective action"
          form={createForm}
          setForm={setCreateForm}
          onSubmit={handleCreate}
          onCancel={() => { setShowCreate(false); setCreateError(null) }}
          submitting={creating}
          formError={createError}
          submitLabel="Create action"
        />
      )}

      {/* Edit form */}
      {editingAction && (
        <ActionForm
          title="Edit action"
          form={editForm}
          setForm={setEditForm}
          onSubmit={handleUpdate}
          onCancel={() => { setEditingAction(null); setEditError(null) }}
          submitting={updating}
          formError={editError}
          submitLabel="Save changes"
        />
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : actions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">No corrective actions yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-sm font-medium text-primary hover:underline"
          >
            Add the first action
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {actions.map((action) => (
            <div key={action.id} className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{action.actionTitle}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{action.actionDisc}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_CLASSES[action.priority]}`}
                  >
                    {action.priority}
                  </span>
                  <button
                    onClick={() => openEdit(action)}
                    className="ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Edit action"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingId(action.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete action"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline delete confirmation */}
              {deletingId === action.id && (
                <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                  <p className="text-xs text-destructive">Delete this action?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeletingId(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(action.id)}
                      disabled={deleteInFlight}
                      className="flex items-center gap-1 text-xs font-medium text-destructive hover:underline disabled:opacity-60"
                    >
                      {deleteInFlight && <Loader2 className="h-3 w-3 animate-spin" />}
                      Delete
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <select
                  value={action.status}
                  onChange={(e) => updateStatus(action.id, e.target.value as ActionStatus)}
                  className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring ${STATUS_CLASSES[action.status]}`}
                >
                  {(Object.keys(STATUS_LABELS) as ActionStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Due {new Date(action.dueDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
