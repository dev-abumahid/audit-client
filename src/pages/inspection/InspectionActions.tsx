import { useFindingsForInspection } from "@/hooks/useFindingsForInspection"
import {
  useCreateNewFindingMutation,
  useDeleteFindingByIdMutation,
  useUpdateFindingByIdMutation,
} from "@/redux/apis/organization/findings.api"
import { formatLocaleDate } from "@/utils/formatDate"
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
import { useTranslation } from "react-i18next"
import { Link, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

type ActionPriority = "Low" | "Medium" | "High"
type ActionStatus = "TO_DO" | "IN_PROGRESS" | "COMPLETE" | "CANT_DO"

interface Action {
  id: string
  inspectionId: string
  actionTitle: string
  // Optional/nullable at the DB level (aexa-server#173) -- omitted/null on
  // rows created with a blank "Description (Optional)" field.
  actionDisc?: string | null
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
  const { t } = useTranslation()
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
          {t("pages.inspection.actions.form.titleLabel")}
        </label>
        <input
          required
          value={form.actionTitle}
          onChange={(e) =>
            setForm((f) => ({ ...f, actionTitle: e.target.value }))
          }
          placeholder={t("pages.inspection.actions.form.titlePlaceholder")}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          {t("pages.inspection.actions.form.descriptionLabel")}
        </label>
        <textarea
          required
          rows={3}
          value={form.actionDisc}
          onChange={(e) =>
            setForm((f) => ({ ...f, actionDisc: e.target.value }))
          }
          placeholder={t(
            "pages.inspection.actions.form.descriptionPlaceholder"
          )}
          className="resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          {t("pages.inspection.actions.form.attachmentsLabel")}
        </label>
        <div className="flex flex-wrap gap-2">
          {attachments.map((url, i) => {
            const isImage = /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url)
            const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`
            return isImage ? (
              <img
                key={i}
                src={fullUrl}
                alt={t("pages.inspection.actions.attachment", {
                  index: i + 1,
                })}
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
                <FileText className="h-3.5 w-3.5" />{" "}
                {t("pages.inspection.actions.file", { index: i + 1 })}
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
            {t("pages.inspection.actions.form.attachFile")}
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
            {t("pages.inspection.actions.form.priorityLabel")}
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
            <option value="Low">
              {t("pages.inspection.actions.priorityLow")}
            </option>
            <option value="Medium">
              {t("pages.inspection.actions.priorityMedium")}
            </option>
            <option value="High">
              {t("pages.inspection.actions.priorityHigh")}
            </option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor={dueDateId}
            className="text-xs font-medium text-muted-foreground"
          >
            {t("pages.inspection.actions.form.dueDateLabel")}
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
          {t("pages.inspection.actions.form.cancel")}
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
  const { t, i18n } = useTranslation()
  const { id: inspectionId } = useParams<{ id: string }>()

  const STATUS_LABELS: Record<ActionStatus, string> = {
    TO_DO: t("pages.inspection.actions.statusToDo"),
    IN_PROGRESS: t("pages.inspection.actions.statusInProgress"),
    COMPLETE: t("pages.inspection.actions.statusComplete"),
    CANT_DO: t("pages.inspection.actions.statusCantDo"),
  }

  const PRIORITY_LABELS: Record<ActionPriority, string> = {
    Low: t("pages.inspection.actions.priorityLow"),
    Medium: t("pages.inspection.actions.priorityMedium"),
    High: t("pages.inspection.actions.priorityHigh"),
  }

  const {
    findings: actions,
    isLoading: loading,
    isFetching: findingsFetching,
    isError: hasLoadError,
  } = useFindingsForInspection<Action>(inspectionId)
  const error = hasLoadError ? t("pages.inspection.actions.loadFailed") : null
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
      if (url) {
        onUrl(url)
      } else {
        toast.error(t("pages.inspection.actions.uploadFailed"))
      }
    } catch {
      toast.error(t("pages.inspection.actions.uploadFailed"))
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
          t("pages.inspection.actions.createFailed")
      )
    } finally {
      setCreating(false)
    }
  }

  function openEdit(action: Action) {
    setEditingAction(action)
    setEditForm({
      actionTitle: action.actionTitle,
      // action.actionDisc can be null/undefined (aexa-server#173) -- fall
      // back to "" so this stays a controlled input, matching the empty
      // string EMPTY_FORM already seeds for a fresh create.
      actionDisc: action.actionDisc ?? "",
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
          t("pages.inspection.actions.updateFailed")
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
          t("pages.inspection.actions.statusUpdateFailed")
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
          {t("pages.inspection.actions.breadcrumbInspections")}
        </Link>
        <span>/</span>
        <Link
          to={`/organization/audit/inspections/${inspectionId}`}
          className="hover:text-foreground"
        >
          {t("pages.inspection.actions.breadcrumbInspection")}
        </Link>
        <span>/</span>
        <span className="text-foreground">
          {t("pages.inspection.actions.breadcrumbActions")}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            {t("pages.inspection.actions.title")}
            {isBackgroundRefreshing && (
              <Loader2
                className="h-3.5 w-3.5 animate-spin text-muted-foreground"
                aria-label={t("pages.inspection.actions.refreshing")}
              />
            )}
          </h1>
          {!loading && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {actions.length !== 1
                ? t("pages.inspection.actions.countPlural", {
                    count: actions.length,
                  })
                : t("pages.inspection.actions.countSingular", {
                    count: actions.length,
                  })}
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
          <Plus className="h-4 w-4" /> {t("pages.inspection.actions.newAction")}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <ActionForm
          title={t("pages.inspection.actions.newActionFormTitle")}
          form={createForm}
          setForm={setCreateForm}
          onSubmit={handleCreate}
          onCancel={() => {
            setShowCreate(false)
            setCreateError(null)
          }}
          submitting={creating}
          formError={createError}
          submitLabel={t("pages.inspection.actions.createAction")}
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
          title={t("pages.inspection.actions.editActionFormTitle")}
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
          submitLabel={t("pages.inspection.actions.saveChanges")}
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
            {t("pages.inspection.actions.empty")}
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("pages.inspection.actions.addFirst")}
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
                    {PRIORITY_LABELS[action.priority]}
                  </span>
                  <button
                    onClick={() => openEdit(action)}
                    className="ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={t("pages.inspection.actions.editAction")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingId(action.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t("pages.inspection.actions.deleteAction")}
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
                        alt={t("pages.inspection.actions.attachment", {
                          index: i + 1,
                        })}
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
                        <FileText className="h-3 w-3" />{" "}
                        {t("pages.inspection.actions.file", { index: i + 1 })}
                      </a>
                    )
                  })}
                </div>
              )}

              {/* Inline delete confirmation */}
              {deletingId === action.id && (
                <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                  <p className="text-xs text-destructive">
                    {t("pages.inspection.actions.deleteConfirm")}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeletingId(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t("pages.inspection.actions.form.cancel")}
                    </button>
                    <button
                      onClick={() => handleDelete(action.id)}
                      disabled={deleteInFlight}
                      className="flex items-center gap-1 text-xs font-medium text-destructive hover:underline disabled:opacity-60"
                    >
                      {deleteInFlight && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {t("pages.inspection.actions.delete")}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                {/* aexa-server#252 / aexa-frontend#214: COMPLETE/CANT_DO can
                    now only be reached via an approved closure request --
                    a direct PATCH sending either as `status` 400s, even as
                    a no-op resend of the finding's own current value. Once
                    a finding is already closed, show its status read-only
                    instead of offering a select that would just 400 on
                    every change (including re-picking the same value). */}
                {action.status === "COMPLETE" || action.status === "CANT_DO" ? (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[action.status]}`}
                    title={t("pages.inspection.actions.statusClosedHint")}
                  >
                    {STATUS_LABELS[action.status]}
                  </span>
                ) : (
                  <select
                    value={action.status}
                    disabled={updatingStatusId === action.id}
                    onChange={(e) =>
                      updateStatus(action.id, e.target.value as ActionStatus)
                    }
                    className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium focus:ring-1 focus:ring-ring focus:outline-none disabled:opacity-60 ${STATUS_CLASSES[action.status]}`}
                  >
                    <option value="TO_DO">{STATUS_LABELS.TO_DO}</option>
                    <option value="IN_PROGRESS">
                      {STATUS_LABELS.IN_PROGRESS}
                    </option>
                  </select>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("pages.inspection.actions.due", {
                    date: formatLocaleDate(action.dueDate, i18n.language),
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
