import CreateNewFindingModal from "@/dashboard/organization/findings/CreateNewFindingModal"
import { useFindingsForInspection } from "@/hooks/useFindingsForInspection"
import {
  useDeleteFindingByIdMutation,
  useUpdateFindingByIdMutation,
} from "@/redux/apis/organization/findings.api"
import type { IAction } from "@/types/finding"
import { fileType } from "@/utils/fileType"
import { formatLocaleDate } from "@/utils/formatDate"
import { isHttpUrl } from "@/utils/isHttpUrl"
import { severityBadgeClasses } from "@/utils/severityStyles"
import { FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"

// quality-bar-loop (Inspections, round 28): this file used to hand-roll its
// own create/edit form (ActionForm) and a narrower local `Action` type,
// duplicating CreateNewFindingModal.tsx -- the real, canonical finding
// create/edit UI already used by UpdateInspection.tsx/AllFindingsPage.tsx.
// The local form was missing assignees, the Five Cs fields, and comments,
// had no accessible labels on its inputs, undersized touch targets, and
// hand-rolled status/priority colors with no dark-mode variants -- all
// gaps the real modal already closes. Swapped to it rather than patching
// each symptom separately; see the round-27/28 log entries.

// Same status/priority -> severity mapping as AllFindingsPage.tsx, so a
// finding renders in the same color here as everywhere else it's shown.
const PRIORITY_BADGE: Record<IAction["priority"], string> = {
  Low: severityBadgeClasses("low"),
  Medium: severityBadgeClasses("medium"),
  High: severityBadgeClasses("high"),
}

const STATUS_BADGE: Record<IAction["status"], string> = {
  TO_DO: severityBadgeClasses("medium"),
  IN_PROGRESS: severityBadgeClasses("info"),
  COMPLETE: severityBadgeClasses("low"),
  CANT_DO: severityBadgeClasses("critical"),
}

export default function InspectionActions() {
  const { t, i18n } = useTranslation()
  const { id: inspectionId } = useParams<{ id: string }>()

  const STATUS_LABELS: Record<IAction["status"], string> = {
    TO_DO: t("pages.inspection.actions.statusToDo"),
    IN_PROGRESS: t("pages.inspection.actions.statusInProgress"),
    COMPLETE: t("pages.inspection.actions.statusComplete"),
    CANT_DO: t("pages.inspection.actions.statusCantDo"),
  }

  const PRIORITY_LABELS: Record<IAction["priority"], string> = {
    Low: t("pages.inspection.actions.priorityLow"),
    Medium: t("pages.inspection.actions.priorityMedium"),
    High: t("pages.inspection.actions.priorityHigh"),
  }

  const {
    findings: actions,
    isLoading: loading,
    isFetching: findingsFetching,
    isError: hasLoadError,
  } = useFindingsForInspection<IAction>(inspectionId)
  const error = hasLoadError ? t("pages.inspection.actions.loadFailed") : null
  // True only while a background refetch (e.g. after create/update/delete
  // invalidates the FINDINGS tag) is in flight -- `loading` only covers the
  // very first fetch, so without this the list can go silent for a moment
  // after a mutation with no visible feedback.
  const isBackgroundRefreshing = findingsFetching && !loading

  const [updateFindingById] = useUpdateFindingByIdMutation()
  const [deleteFindingById] = useDeleteFindingByIdMutation()

  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)

  const [searchParams] = useSearchParams()

  // Create/edit both go through the real CreateNewFindingModal now --
  // `editData: null` means "create", matching AllFindingsPage.tsx's own
  // modalState convention.
  const [modalState, setModalState] = useState<{
    open: boolean
    editData: IAction | null
  }>(() => ({ open: searchParams.get("new") === "1", editData: null }))

  // delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteInFlight, setDeleteInFlight] = useState(false)

  async function handleDelete(id: string) {
    setDeleteInFlight(true)
    try {
      await deleteFindingById(id).unwrap()
      setDeletingId(null)
    } catch (err) {
      // quality-bar-loop (Inspections, round 37, resilience finding): this
      // used to swallow a failed delete silently -- the confirm UI just
      // closed as if it had worked, identical to `updateStatus` right
      // below's failure path before it was fixed to toast. Deliberately
      // NOT clearing `deletingId` here (unlike the success path) so the
      // inline confirm banner stays open for a retry instead of the user
      // having to re-click delete to see the row again.
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ??
          t("pages.inspection.actions.deleteFailed")
      )
    } finally {
      setDeleteInFlight(false)
    }
  }

  async function updateStatus(id: string, status: IAction["status"]) {
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
        {/* quality-bar-loop (Inspections, round 26 follow-up): this
            breadcrumb pointed at the bare `:id` route -- RunInspection.tsx's
            route, deleted in round 25 as superseded dead code. The real,
            currently-linked edit flow is UpdateInspection.tsx. */}
        <Link
          to={`/organization/audit/inspection/update/${inspectionId}`}
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
              {t("pages.inspection.actions.count", {
                count: actions.length,
              })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setModalState({ open: true, editData: null })}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {t("pages.inspection.actions.newAction")}
        </button>
      </div>

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
            type="button"
            onClick={() => setModalState({ open: true, editData: null })}
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
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_BADGE[action.priority]}`}
                  >
                    {PRIORITY_LABELS[action.priority]}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setModalState({ open: true, editData: action })
                    }
                    className="ml-1 flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={t("pages.inspection.actions.editAction")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingId(action.id)}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t("pages.inspection.actions.deleteAction")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {(action.attachments?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2">
                  {action.attachments.map((url, i) => {
                    if (!isHttpUrl(url)) return null
                    const isImage = fileType(url) === "image"
                    return isImage ? (
                      <img
                        key={i}
                        src={url}
                        alt={t("pages.inspection.actions.attachment", {
                          index: i + 1,
                        })}
                        className="h-14 w-14 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <a
                        key={i}
                        href={url}
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
                      type="button"
                      onClick={() => setDeletingId(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t("pages.inspection.actions.form.cancel")}
                    </button>
                    <button
                      type="button"
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
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[action.status]}`}
                    title={t("pages.inspection.actions.statusClosedHint")}
                  >
                    {STATUS_LABELS[action.status]}
                  </span>
                ) : (
                  <select
                    value={action.status}
                    disabled={updatingStatusId === action.id}
                    onChange={(e) =>
                      updateStatus(
                        action.id,
                        e.target.value as IAction["status"]
                      )
                    }
                    aria-label={t("pages.inspection.actions.statusFor", {
                      title: action.actionTitle,
                    })}
                    className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium focus:ring-1 focus:ring-ring focus:outline-none disabled:opacity-60 ${STATUS_BADGE[action.status]}`}
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

      <CreateNewFindingModal
        open={modalState.open}
        onClose={() => setModalState({ open: false, editData: null })}
        editData={modalState.editData}
        additionalData={
          modalState.editData ? undefined : { inspectionId: inspectionId ?? "" }
        }
      />
    </div>
  )
}
