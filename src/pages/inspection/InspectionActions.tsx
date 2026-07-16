import { useFindingsForInspection } from "@/hooks/useFindingsForInspection"
import {
  useCreateNewFindingMutation,
  useDeleteFindingByIdMutation,
  useUpdateFindingByIdMutation,
} from "@/redux/apis/organization/findings.api"
import {
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { useId, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

type ActionPriority = "Low" | "Medium" | "High"
type ActionStatus = "TO_DO" | "IN_PROGRESS" | "COMPLETE" | "CANT_DO"

interface Action {
  id: string
  inspectionId: string
  actionTitle: string
  actionDisc: string
  priority: ActionPriority
  dueDate: string
  status: ActionStatus
  site: { id: string; name: string } | null
  attachments: string[]
}

const PRIORITY_CLASSES: Record<ActionPriority, string> = {
  Low: "bg-slate-100 text-slate-600",
  Medium: "bg-amber-100 text-amber-700",
  High: "bg-red-100 text-red-600",
}

const STATUS_LABELS: Record<ActionStatus, string> = {
  TO_DO: "To do",
  IN_PROGRESS: "In progress",
  COMPLETE: "Complete",
  CANT_DO: "Can't do",
}

const STATUS_CLASSES: Record<ActionStatus, string> = {
  TO_DO: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETE: "bg-green-100 text-green-700",
  CANT_DO: "bg-red-100 text-red-600",
}

const EMPTY_FORM = {
  actionTitle: "",
  actionDisc: "",
  priority: "Medium" as ActionPriority,
  dueDate: "",
  status: "TO_DO" as ActionStatus,
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
  attachments,
  onAttach,
  attachUploading,
  isEdit,
}: {
  title: string
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  submitting: boolean
  formError: string | null
  submitLabel: string
  attachments: string[]
  onAttach: (file: File) => Promise<void>
  attachUploading: boolean
  isEdit?: boolean
}) {
  const dueDateId = useId()
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Title *
        </label>
        <input
          required
          value={form.actionTitle}
          onChange={(e) =>
            setForm((f) => ({ ...f, actionTitle: e.target.value }))
          }
          placeholder="e.g. Replace faulty extinguisher in Zone B"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Description *
        </label>
        <textarea
          required
          rows={3}
          value={form.actionDisc}
          onChange={(e) =>
            setForm((f) => ({ ...f, actionDisc: e.target.value }))
          }
          placeholder="Describe what needs to be done…"
          className="resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Attachments
        </label>
        <div className="flex flex-wrap gap-2">
          {attachments.map((url, i) => {
            const isImage = /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url)
            const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`
            return isImage ? (
              <img
                key={i}
                src={fullUrl}
                alt={`Attachment ${i + 1}`}
                className="h-16 w-16 rounded-md border border-border object-cover"
              />
            ) : (
              <a
                key={i}
                href={fullUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                <FileText className="h-3.5 w-3.5" /> File {i + 1}
              </a>
            )
          })}
          <label
            className={`flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted ${attachUploading ? "pointer-events-none opacity-60" : ""}`}
          >
            {attachUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Paperclip className="h-3.5 w-3.5" />
            )}
            Attach file
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onAttach(f)
              }}
              disabled={attachUploading}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Priority *
          </label>
          <select
            value={form.priority}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                priority: e.target.value as ActionPriority,
              }))
            }
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor={dueDateId}
            className="text-xs font-medium text-muted-foreground"
          >
            Due date *
          </label>
          <input
            id={dueDateId}
            required
            type="date"
            value={form.dueDate}
            min={isEdit ? undefined : new Date().toISOString().slice(0, 10)}
            onChange={(e) =>
              setForm((f) => ({ ...f, dueDate: e.target.value }))
            }
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

  const {
    findings: actions,
    isLoading: loading,
    isFetching: findingsFetching,
    isError: hasLoadError,
  } = useFindingsForInspection<Action>(inspectionId)
  const error = hasLoadError ? "Failed to load actions" : null
  // True only while a background refetch (e.g. after create/update/delete
  // invalidates the FINDINGS tag) is in flight — `loading` only covers the
  // very first fetch, so without this the list can go silent for a moment
  // after a mutation with no visible feedback.
  const isBackgroundRefreshing = findingsFetching && !loading

  const [createNewFinding] = useCreateNewFindingMutation()
  const [updateFindingById] = useUpdateFindingByIdMutation()
  const [deleteFindingById] = useDeleteFindingByIdMutation()

  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)

  const [searchParams] = useSearchParams()

  // create form
  const [showCreate, setShowCreate] = useState(
    () => searchParams.get("new") === "1"
  )
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createAttachments, setCreateAttachments] = useState<string[]>([])
  const [createAttachUploading, setCreateAttachUploading] = useState(false)

  // edit form
  const [editingAction, setEditingAction] = useState<Action | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [updating, setUpdating] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editAttachments, setEditAttachments] = useState<string[]>([])
  const [editAttachUploading, setEditAttachUploading] = useState(false)

  // delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteInFlight, setDeleteInFlight] = useState(false)

  async function uploadAttachment(
    file: File,
    onUrl: (url: string) => void,
    setUploading: (v: boolean) => void
  ) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(`${BASE_URL}/api/action/attachment`, {
        method: "POST",
        credentials: "include",
        body: form,
      })
      if (!res.ok) throw new Error("Upload failed")
      const json = await res.json()
      const url: string = json.data?.url ?? json.url ?? ""
      if (url) onUrl(url)
    } catch {
      // silent — no UI error for now, attachment just won't appear
    } finally {
      setUploading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!inspectionId) return
    setCreating(true)
    setCreateError(null)
    try {
      await createNewFinding({
        ...createForm,
        inspectionId,
        dueDate: new Date(createForm.dueDate).toISOString(),
        attachments: createAttachments,
      }).unwrap()
      setCreateForm(EMPTY_FORM)
      setCreateAttachments([])
      setShowCreate(false)
    } catch (err) {
      setCreateError(
        (err as { data?: { message?: string } })?.data?.message ??
          "Failed to create action"
      )
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
    setEditAttachments(action.attachments ?? [])
    setEditError(null)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingAction) return
    setUpdating(true)
    setEditError(null)
    try {
      await updateFindingById({
        id: editingAction.id,
        body: {
          ...editForm,
          dueDate: new Date(editForm.dueDate).toISOString(),
          attachments: editAttachments,
        },
      }).unwrap()
      setEditingAction(null)
    } catch (err) {
      setEditError(
        (err as { data?: { message?: string } })?.data?.message ??
          "Failed to update action"
      )
    } finally {
      setUpdating(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleteInFlight(true)
    try {
      await deleteFindingById(id).unwrap()
      setDeletingId(null)
    } catch {
      setDeletingId(null)
    } finally {
      setDeleteInFlight(false)
    }
  }

  async function updateStatus(id: string, status: ActionStatus) {
    setUpdatingStatusId(id)
    try {
      await updateFindingById({ id, body: { status } }).unwrap()
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ??
          "Failed to update status"
      )
    } finally {
      setUpdatingStatusId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          to="/organization/audit/inspections"
          className="hover:text-foreground"
        >
          Inspections
        </Link>
        <span>/</span>
        <Link
          to={`/organization/audit/inspections/${inspectionId}`}
          className="hover:text-foreground"
        >
          Inspection
        </Link>
        <span>/</span>
        <span className="text-foreground">Actions</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            Corrective actions
            {isBackgroundRefreshing && (
              <Loader2
                className="h-3.5 w-3.5 animate-spin text-muted-foreground"
                aria-label="Refreshing"
              />
            )}
          </h1>
          {!loading && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {actions.length} action{actions.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            setShowCreate(true)
            setEditingAction(null)
          }}
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
          onCancel={() => {
            setShowCreate(false)
            setCreateError(null)
          }}
          submitting={creating}
          formError={createError}
          submitLabel="Create action"
          attachments={createAttachments}
          onAttach={(file) =>
            uploadAttachment(
              file,
              (url) => setCreateAttachments((prev) => [...prev, url]),
              setCreateAttachUploading
            )
          }
          attachUploading={createAttachUploading}
        />
      )}

      {/* Edit form */}
      {editingAction && (
        <ActionForm
          title="Edit action"
          isEdit
          form={editForm}
          setForm={setEditForm}
          onSubmit={handleUpdate}
          onCancel={() => {
            setEditingAction(null)
            setEditError(null)
          }}
          submitting={updating}
          formError={editError}
          submitLabel="Save changes"
          attachments={editAttachments}
          onAttach={(file) =>
            uploadAttachment(
              file,
              (url) => setEditAttachments((prev) => [...prev, url]),
              setEditAttachUploading
            )
          }
          attachUploading={editAttachUploading}
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
          <p className="text-sm text-muted-foreground">
            No corrective actions yet.
          </p>
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
            <div
              key={action.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {action.actionTitle}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {action.actionDisc}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
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

              {(action.attachments?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2">
                  {action.attachments.map((url, i) => {
                    const isImage = /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url)
                    const fullUrl = url.startsWith("http")
                      ? url
                      : `${BASE_URL}${url}`
                    return isImage ? (
                      <img
                        key={i}
                        src={fullUrl}
                        alt={`Attachment ${i + 1}`}
                        className="h-14 w-14 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <a
                        key={i}
                        href={fullUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                      >
                        <FileText className="h-3 w-3" /> File {i + 1}
                      </a>
                    )
                  })}
                </div>
              )}

              {/* Inline delete confirmation */}
              {deletingId === action.id && (
                <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                  <p className="text-xs text-destructive">
                    Delete this action?
                  </p>
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
                      {deleteInFlight && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      Delete
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <select
                  value={action.status}
                  disabled={updatingStatusId === action.id}
                  onChange={(e) =>
                    updateStatus(action.id, e.target.value as ActionStatus)
                  }
                  className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium focus:ring-1 focus:ring-ring focus:outline-none disabled:opacity-60 ${STATUS_CLASSES[action.status]}`}
                >
                  {(Object.keys(STATUS_LABELS) as ActionStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
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
