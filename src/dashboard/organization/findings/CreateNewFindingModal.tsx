/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useUploadAnyFileAwsMutation } from "@/redux/apis/common.api"
import {
  useAddFindingMessageMutation,
  useCreateNewFindingMutation,
  useGetFindingByIdQuery,
  useUpdateFindingByIdMutation,
} from "@/redux/apis/organization/findings.api"
import { useGetAllInspectionQuery } from "@/redux/apis/organization/inspection.api"
import { useGetAllOrgUsersQuery } from "@/redux/apis/organization/org.user.api"
import type { IAction, IActionMessage } from "@/types/finding"
import { toLocalDatetimeInputValue } from "./dueDateInput"
import { fileType } from "@/utils/fileType"
import { SEVERITY_STYLES } from "@/utils/severityStyles"
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  Image,
  User,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import TextareaAutosize from "react-textarea-autosize"
import { toast } from "sonner"

// The upload input accepts "image/*,video/*" (see fileInputRef below), so
// previews need to branch on the uploaded file's type -- rendering every
// media file as an <img> shows a broken-image icon for video uploads.
// Round 13 batch A review (#511): this used to be a locally-duplicated
// isVideoUrl() with the same extension list -- now uses the shared
// src/utils/fileType.ts helper consolidated in this same PR for
// UpdateInspection.tsx/InspectionReport.tsx's identical need.
const isVideoUrl = (url: string) => fileType(url) === "video"

// ── Types ────────────────────────────────────────────────────────────────────

interface CreateActionModalProps {
  open: boolean
  onClose: () => void
  editData?: IAction | null
  additionalData?: {
    questionId?: string
    inspectionId?: string
    actionTitle?: string
    actionDisc?: string
    // Optional back-link to the ComplianceObligation this action remediates
    // (aexa-frontend#166). Threaded straight onto the create payload below —
    // not a user-editable form field, and only sent on create, mirroring the
    // backend which sets it once at creation (aexa-server#226).
    complianceObligationId?: string
  }
}

// The Assignees UI works with raw user ids, not the {id, name} objects
// IAction.assignBy holds — form state stores ids, editData.assignBy gets
// normalized to ids on load, and submitted as-is.
type FindingFormValues = Omit<IAction, "assignBy"> & { assignBy: string[] }

// ── Helpers ──────────────────────────────────────────────────────────────────

const defaultDueDate = () => {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return toLocalDatetimeInputValue(d)
}

const PRIORITY_STYLES: Record<string, string> = {
  Low: SEVERITY_STYLES.low.text,
  Medium: SEVERITY_STYLES.medium.text,
  High: SEVERITY_STYLES.high.text,
}

// Same status->severity mapping as FindingDetails.tsx/AllFindingsPage.tsx.
const STATUS_STYLES: Record<string, string> = {
  TO_DO: SEVERITY_STYLES.medium.text,
  IN_PROGRESS: SEVERITY_STYLES.info.text,
  COMPLETE: SEVERITY_STYLES.low.text,
  CANT_DO: SEVERITY_STYLES.critical.text,
}

export default function CreateNewFindingModal({
  open,
  onClose,
  editData,
  additionalData,
}: CreateActionModalProps) {
  const { t } = useTranslation()
  const isEdit = !!editData
  // aexa-server#252: COMPLETE/CANT_DO can now only be reached via an approved
  // closure request (FindingClosureControls.tsx) -- a direct PATCH sending
  // either as `status` 400s, even as a no-op resend of the finding's own
  // current value. Once a finding is already closed, this form must not
  // offer those two values or include `status` in its payload at all; there
  // is no "reopen" endpoint on the backend, so a closed finding's status is
  // shown read-only here instead of editable.
  const isClosed =
    isEdit && (editData?.status === "COMPLETE" || editData?.status === "CANT_DO")
  // aexa-frontend#340: the dueDate "must be in the future" validator below
  // used to run unconditionally on every submit, including edits -- so
  // editing an already-overdue finding (any change at all: status, a
  // comment, assignee) failed validation unless the user also bumped the
  // due date forward. Mirrors isClosed's carve-out just above: only enforce
  // "must be in the future" for a *new* due date value being set, not for
  // preserving an already-past one unchanged on edit. Compared as the same
  // local-datetime-input string the form field itself holds (not raw ISO
  // strings), since that's what the validator's `v` argument receives.
  const originalDueDateInputValue =
    isEdit && editData?.dueDate
      ? toLocalDatetimeInputValue(new Date(editData.dueDate))
      : null
  const originalDueDateWasPast =
    isEdit && editData?.dueDate
      ? new Date(editData.dueDate) <= new Date()
      : false
  // ── API hooks ──────────────────────────────────────────────────────────────
  const [uploadFIle] = useUploadAnyFileAwsMutation()
  const { data: usersData, isLoading: usersLoading } =
    useGetAllOrgUsersQuery(undefined)

  const inspectionQueryArgs = useMemo(
    () => ({ page: 1, limit: 100, searchTerm: "", status: "", siteId: "" }),
    []
  )
  const { data: inspectionsData, isLoading: inspectionsLoading } =
    useGetAllInspectionQuery(inspectionQueryArgs)

  const [addAction, { isLoading: isCreating }] = useCreateNewFindingMutation()
  const [updateAction, { isLoading: isUpdating }] =
    useUpdateFindingByIdMutation()
  // Separate endpoint -- update_action_into_db (PATCH, used by updateAction
  // above) never persists body.messages. Adding a comment to an existing
  // finding has to go through this PUT endpoint instead (#170).
  const [addMessage, { isLoading: isAddingMessage }] =
    useAddFindingMessageMutation()

  // The list row passed in as `editData` no longer carries full message
  // bodies (aexa-server issue #162 — the list endpoint's `messages` include
  // was trimmed to a count-only shape). Fetch the single-action detail on
  // open so the existing conversation thread still renders correctly.
  const { data: findingDetail } = useGetFindingByIdQuery(editData?.id ?? "", {
    skip: !open || !editData?.id,
  })

  const isSaving = isCreating || isUpdating || isAddingMessage
  const users = usersData?.data || []
  const inspectionList: any[] = inspectionsData?.data || []

  // ── Derived: questions from selected inspection ────────────────────────────
  const [selectedInspectionId, setSelectedInspectionId] = useState("")

  // ── Messages & media state ─────────────────────────────────────────────────
  const [messageInput, setMessageInput] = useState("")
  const [messages, setMessages] = useState<IActionMessage[]>([])
  const [mediaFiles, setMediaFiles] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Five Cs (aexa-server#244) are optional and mostly relevant to formal
  // audit findings, not plain remediation tasks — collapsed by default so
  // the common case stays uncluttered, expanded automatically when editing
  // a finding that already has one of these set.
  const [showFiveCs, setShowFiveCs] = useState(false)

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files as FileList
    if (!files || files.length === 0) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", files[0])
      const res = await uploadFIle(formData).unwrap()
      setMediaFiles((prev) => [...prev, res.data])
      toast.success(t("organization.findings.fileUploaded"))
    } catch {
      toast.error(t("organization.findings.mediaUploadFailed"))
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const removeMedia = useCallback(
    (url: string) => setMediaFiles((prev) => prev.filter((u) => u !== url)),
    []
  )

  // ── react-hook-form ────────────────────────────────────────────────────────
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FindingFormValues>({
    defaultValues: {
      actionTitle: additionalData?.actionTitle || "",
      actionDisc: additionalData?.actionDisc || "",
      priority: "Low",
      status: "TO_DO",
      dueDate: defaultDueDate(),
      assignBy: [],
      inspectionId: additionalData?.inspectionId || "",
      questionId: additionalData?.questionId || "",
      messages: [],
      criteria: "",
      condition: "",
      cause: "",
      effect: "",
      // aexa-server#97: required on create (no sensible default -- an
      // Action covers both 1st-line-like remediation work and 3rd-line-like
      // audit findings, so guessing would misclassify roughly half of them,
      // same reasoning as action.validation.ts's own comment on this
      // field). Left unset here so the required-field validation below
      // actually forces a choice instead of silently submitting a guess.
      line_of_defense: null,
    },
  })

  useEffect(() => {
    if (!open) return

    if (editData) {
      const insId = editData.inspectionId ?? ""
      setSelectedInspectionId(insId)
      // Deliberately NOT seeded from editData.messages here (unlike every
      // other field below): editData may be a list row, whose messages are
      // now id-only stubs post-aexa-server#162, not full IActionMessage
      // objects with a `.message` body to render. Left empty until the
      // detail-fetch effect below resolves and fills in the real bodies —
      // a brief empty state beats a flash of blank/undefined message text.
      setMessages([])
      setMediaFiles(editData.attachments ?? [])
      setShowFiveCs(
        !!(
          editData.criteria ||
          editData.condition ||
          editData.cause ||
          editData.effect
        )
      )
      reset({
        actionTitle: editData.actionTitle,
        actionDisc: editData.actionDisc ?? "",
        priority: editData.priority,
        status: editData.status ?? "TO_DO",
        dueDate: editData.dueDate
          ? toLocalDatetimeInputValue(new Date(editData.dueDate))
          : defaultDueDate(),
        inspectionId: insId,
        questionId: editData.questionId ?? "",
        messages: [],
        assignBy: (editData.assignBy ?? []).map((a) => a.id),
        criteria: editData.criteria ?? "",
        condition: editData.condition ?? "",
        cause: editData.cause ?? "",
        effect: editData.effect ?? "",
        // Existing rows from before #97 may have no value -- update_action
        // keeps this field optional (unlike create), so an untouched edit
        // correctly stays null/"Unclassified" rather than forcing a guess.
        line_of_defense: editData.line_of_defense ?? null,
      })
    } else {
      setSelectedInspectionId(additionalData?.inspectionId ?? "")
      setMessages([])
      setMediaFiles([])
      setShowFiveCs(false)
      reset({
        actionTitle: additionalData?.actionTitle || "",
        actionDisc: additionalData?.actionDisc || "",
        priority: "Low",
        status: "TO_DO",
        dueDate: defaultDueDate(),
        assignBy: [],
        inspectionId: additionalData?.inspectionId ?? "",
        messages: [],
        questionId: additionalData?.questionId ?? "",
        criteria: "",
        condition: "",
        cause: "",
        effect: "",
        line_of_defense: null,
      })
    }
  }, [open, editData, reset])

  // Once the detail fetch above resolves, replace the (possibly empty)
  // messages the list row seeded the form with. Deliberately not folded
  // into the effect above / a full `reset()`: this can resolve after the
  // user has already started editing other fields, and a full reset would
  // clobber that in-progress input.
  useEffect(() => {
    if (!open || !editData) return
    const detailMessages = findingDetail?.data?.messages
    if (detailMessages) {
      setMessages(detailMessages)
      setValue("messages", detailMessages)
    }
  }, [open, editData, findingDetail, setValue])

  const handleInspectionChange = useCallback(
    (id: string) => {
      setSelectedInspectionId(id)
      setValue("inspectionId", id)
      setValue("questionId", "")
    },
    [inspectionList, setValue]
  )

  // ── User dropdown ──────────────────────────────────────────────────────────
  const [showUserDropdown, setShowUserDropdown] = useState(false)

  // The org-users endpoint (022b7ce) and the dropdown list below key/display
  // users by `user.id` / `user.account?.profile?.fullName`, not the
  // `u._id` / `u.firstName` this helper originally used -- that mismatch
  // meant it always fell through to "1 user" or undefined, so it got
  // commented out rather than fixed. Restored here against the real shape.
  const getSelectedUserNames = useCallback(
    (ids: string[]) => {
      if (!ids.length) return t("organization.findings.addAssignees")
      if (ids.length === 1) {
        const user = users.find((u: any) => u.id === ids[0])
        return (
          user?.account?.profile?.fullName ||
          user?.account?.email ||
          t("organization.findings.oneUserSelected")
        )
      }
      return t("organization.findings.multipleUsersSelected", {
        count: ids.length,
      })
    },
    [users, t]
  )

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (values: FindingFormValues) => {
    const newMessage = messageInput.trim()

    try {
      const payload = {
        actionTitle: values.actionTitle.trim(),
        // values.actionDisc can now be null/undefined at the type level
        // (IAction.actionDisc is optional/nullable -- aexa-server#173), even
        // though this form's own defaultValues always seed "" for it.
        actionDisc: values.actionDisc?.trim() || undefined,
        priority: values.priority,
        // aexa-server#252: never resend `status` for an already-closed
        // finding -- even the finding's own current COMPLETE/CANT_DO value
        // is rejected (400) by a direct PATCH now that closure is
        // maker-checker-gated. Not applicable on create (isClosed is always
        // false there).
        status: isClosed ? undefined : values.status,
        dueDate: new Date(values.dueDate).toISOString(),
        assignBy: values.assignBy.length ? values.assignBy : undefined,
        questionId: values.questionId || undefined,
        inspectionId: values.inspectionId || undefined,
        // create_action_into_db (POST) persists this array as the finding's
        // initial comments. update_action_into_db (PATCH, used below for
        // edits) ignores it entirely -- an edit's new comment goes through
        // addMessage instead, since there's nothing to "add" beyond the
        // single new message (messages/values.messages here would already
        // both hold the pre-existing comments, so folding them back into
        // this array would double them up -- #170).
        messages: !isEdit && newMessage ? [{ message: newMessage }] : undefined,
        // Real Action field is `attachments` (see prisma/schema/action.prisma
        // on aexa-server) — sending `mediaFiles` here used to be silently
        // dropped by the backend, which only reads body.attachments.
        attachments: mediaFiles,
        // Five Cs (aexa-server#244) — optional, omitted rather than sent as
        // an empty string so an untouched field doesn't overwrite an
        // existing value with "" on edit. Same tradeoff as actionDisc just
        // above: clearing a field back to blank via this form is a no-op
        // (the empty value never round-trips), not just leaving it
        // untouched — a pre-existing limitation, not new to these four
        // fields. Left as-is rather than diverging actionDisc/Five-Cs
        // clear-semantics from each other; fixing it for real needs a
        // deliberate explicit-null-vs-omitted design across both, out of
        // scope here (found during review, aexa-frontend#213).
        criteria: values.criteria?.trim() || undefined,
        condition: values.condition?.trim() || undefined,
        cause: values.cause?.trim() || undefined,
        effect: values.effect?.trim() || undefined,
        // Required on create (action.validation.ts's create_action schema
        // rejects a missing value with no default -- aexa-server#97), the
        // required-field validation on the select below guarantees this is
        // never "" by the time onSubmit runs for a new Action. Optional on
        // edit: sending the existing value back is a no-op PATCH, same as
        // priority/status above; only actually changes anything if the user
        // touched the select.
        line_of_defense: values.line_of_defense || undefined,
      }

      if (isEdit) {
        await updateAction({ id: editData!.id, body: payload }).unwrap()
        // Comments on an existing finding persist through the dedicated PUT
        // endpoint (#106), not the PATCH above -- see addFindingMessage's
        // doc comment in findings.api.ts (#170).
        //
        // Separate try/catch from the PATCH above: by this point the
        // action's fields (title/priority/status/etc.) have genuinely been
        // saved, so a failure here is a partial success, not a full
        // failure -- it needs its own toast rather than falling into the
        // shared catch below, which would tell the user the whole update
        // failed (and never fire the success toast) even though only the
        // comment was lost. Found by independent review.
        if (newMessage) {
          try {
            await addMessage({ id: editData!.id, message: newMessage }).unwrap()
          } catch (msgErr: any) {
            toast.error(
              msgErr?.data?.message ||
                t("organization.findings.commentFailed")
            )
            return
          }
        }
        toast.success(t("organization.findings.updateSuccess"))
      } else {
        // complianceObligationId is only ever sent on create — the backend
        // sets this FK once at creation and its update handler never reads it
        // (aexa-server#226), so it's added here rather than to the shared
        // payload above. Undefined (the normal Findings/Inspection flows) is
        // simply omitted by the request serializer.
        await addAction({
          ...payload,
          complianceObligationId: additionalData?.complianceObligationId,
        }).unwrap()
        toast.success(t("organization.findings.createSuccess"))
      }
      setMessageInput("")
      onClose()
    } catch (err: any) {
      toast.error(
        err?.data?.message ||
          (isEdit
            ? t("organization.findings.updateFailed")
            : t("organization.findings.createFailed"))
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="flex max-h-[90vh] w-full max-w-xl min-w-xl flex-col gap-0 overflow-hidden bg-background p-0"
      >
        {/* ── Header ── */}
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <AlertTriangle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                {isEdit
                  ? t("organization.findings.editTitle")
                  : t("organization.findings.createTitle")}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* Action Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {t("organization.findings.actionTitleLabel")}
            </label>
            <input
              {...register("actionTitle", {
                required: t("organization.findings.actionTitleRequired"),
              })}
              placeholder={t("organization.findings.actionTitlePlaceholder")}
              className={`w-full rounded-lg border px-4 py-3 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none ${
                errors.actionTitle
                  ? "border-destructive bg-destructive/10"
                  : "border-input bg-background"
              }`}
            />
            {errors.actionTitle && (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle size={14} /> {errors.actionTitle.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {t("organization.findings.descriptionOptional")}
            </label>
            <TextareaAutosize
              {...register("actionDisc")}
              placeholder={t("organization.findings.descriptionPlaceholder")}
              rows={1}
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Inspection */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {t("organization.findings.inspectionLabel")}
            </label>
            <select
              value={selectedInspectionId}
              onChange={(e) => handleInspectionChange(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="">
                {t("organization.findings.selectInspection")}
              </option>
              {inspectionsLoading ? (
                <option disabled>{t("organization.findings.loading")}</option>
              ) : (
                inspectionList.map((ins) => (
                  <option key={ins.id} value={ins.id}>
                    {ins?.template?.templateName ||
                      t("organization.findings.unnamedInspection")}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* ── Action Details card ── */}
          <div className="space-y-4 rounded-lg border border-border bg-card p-5">
            <h3 className="text-base font-semibold text-card-foreground">
              {t("organization.findings.actionDetails")}
            </h3>

            {/* Priority */}
            <div className="flex items-center justify-between gap-4">
              <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle size={16} /> {t("organization.findings.priority")}
              </label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <select
                    {...field}
                    className={`w-full max-w-55 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium focus:ring-1 focus:ring-primary focus:outline-none ${PRIORITY_STYLES[field.value]}`}
                  >
                    <option className={`${PRIORITY_STYLES["Low"]}`} value="Low">
                      {t("organization.findings.priorityLow")}
                    </option>
                    <option
                      className={`${PRIORITY_STYLES["Medium"]}`}
                      value="Medium"
                    >
                      {t("organization.findings.priorityMedium")}
                    </option>
                    <option
                      className={`${PRIORITY_STYLES["High"]}`}
                      value="High"
                    >
                      {t("organization.findings.priorityHigh")}
                    </option>
                  </select>
                )}
              />
            </div>

            {/* Status */}
            <div className="flex items-center justify-between gap-4">
              <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle size={16} />{" "}
                {t("organization.findings.statusLabel")}
              </label>
              {isClosed ? (
                <div className="flex w-full max-w-55 flex-col items-end gap-1">
                  <span
                    className={`w-full rounded-lg px-4 py-2 text-right text-sm font-medium ${STATUS_STYLES[editData!.status]}`}
                  >
                    {editData!.status === "COMPLETE"
                      ? t("organization.findings.statusComplete")
                      : t("organization.findings.statusCantDo")}
                  </span>
                  <p className="text-right text-[11px] text-muted-foreground">
                    {t("organization.findings.statusClosedHint")}
                  </p>
                </div>
              ) : (
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <select
                      {...field}
                      className={`w-full max-w-55 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none ${STATUS_STYLES[field.value]}`}
                    >
                      <option
                        className={`${STATUS_STYLES["TO_DO"]}`}
                        value="TO_DO"
                      >
                        {t("organization.findings.statusToDo")}
                      </option>
                      <option
                        className={`${STATUS_STYLES["IN_PROGRESS"]}`}
                        value="IN_PROGRESS"
                      >
                        {t("organization.findings.statusInProgress")}
                      </option>
                    </select>
                  )}
                />
              )}
            </div>

            {/* Line of Defense -- aexa-server#97: required on create (see
                onSubmit's payload comment for why), optional on edit. */}
            <div>
              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor="line-of-defense-select"
                  className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground"
                >
                  <AlertCircle size={16} />{" "}
                  {t("organization.findings.lineOfDefenseLabel")}
                </label>
                <Controller
                  control={control}
                  name="line_of_defense"
                  rules={{
                    required: isEdit
                      ? false
                      : t("organization.findings.lineOfDefenseRequired"),
                  }}
                  render={({ field }) => (
                    <select
                      {...field}
                      id="line-of-defense-select"
                      // Pre-#97 Actions have line_of_defense: null (see
                      // IAction's own doc comment) -- an HTML <select>'s
                      // value can't be null, only a string, so this falls
                      // back to "" (the "Unclassified" option) for display
                      // without changing what actually gets submitted.
                      value={field.value ?? ""}
                      className={`w-full max-w-55 rounded-lg border px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none ${
                        errors.line_of_defense
                          ? "border-destructive bg-destructive/10"
                          : "border-input bg-background"
                      }`}
                    >
                      <option value="" disabled={!isEdit}>
                        {isEdit
                          ? t("organization.findings.lineOfDefenseUnclassified")
                          : t("organization.findings.lineOfDefenseSelect")}
                      </option>
                      <option value="FIRST">
                        {t("organization.threeLinesOfDefense.lines.first")}
                      </option>
                      <option value="SECOND">
                        {t("organization.threeLinesOfDefense.lines.second")}
                      </option>
                      <option value="THIRD">
                        {t("organization.threeLinesOfDefense.lines.third")}
                      </option>
                      <option value="GOVERNING_BODY">
                        {t(
                          "organization.threeLinesOfDefense.lines.governingBody"
                        )}
                      </option>
                    </select>
                  )}
                />
              </div>
              {errors.line_of_defense && (
                <p className="mt-1.5 flex items-center justify-end gap-1.5 text-sm text-destructive">
                  <AlertCircle size={14} /> {errors.line_of_defense.message}
                </p>
              )}
            </div>

            {/* Due Date */}
            <div className="flex items-start justify-between gap-4">
              <label className="mt-2 flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                <Calendar size={16} /> {t("organization.findings.dueDateLabel")}
              </label>
              <div className="flex w-full max-w-55 flex-col items-end gap-1">
                <input
                  type="datetime-local"
                  {...register("dueDate", {
                    required: t("organization.findings.dueDateRequired"),
                    validate: (v) => {
                      if (
                        isEdit &&
                        originalDueDateWasPast &&
                        v === originalDueDateInputValue
                      ) {
                        return true
                      }
                      return (
                        new Date(v) > new Date() ||
                        t("organization.findings.dueDatePast")
                      )
                    },
                  })}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none ${
                    errors.dueDate
                      ? "border-destructive bg-destructive/10"
                      : "border-input bg-background"
                  }`}
                />
                {errors.dueDate && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle size={12} /> {errors.dueDate.message}
                  </p>
                )}
              </div>
            </div>

            {/* Assignees */}
            <div className="flex items-start justify-between gap-4">
              <label className="mt-2 flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                <User size={16} /> {t("organization.findings.assignees")}
              </label>
              <Controller
                control={control}
                name="assignBy"
                render={({ field }) => (
                  <div className="relative w-full max-w-55">
                    <button
                      type="button"
                      onClick={() => setShowUserDropdown((p) => !p)}
                      aria-haspopup="true"
                      aria-expanded={showUserDropdown}
                      className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-ring focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      <span
                        className={
                          field.value.length === 0
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }
                      >
                        {getSelectedUserNames(field.value)}
                      </span>
                      <ChevronDown
                        size={14}
                        className="text-muted-foreground"
                      />
                    </button>

                    {showUserDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowUserDropdown(false)}
                        />
                        <div className="absolute top-full right-0 z-20 mt-1 max-h-52 w-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                          <div className="space-y-0.5 p-2">
                            {usersLoading ? (
                              <p className="p-3 text-center text-sm text-muted-foreground">
                                {t("organization.findings.loading")}
                              </p>
                            ) : (
                              users.map((user: any) => (
                                <label
                                  key={user.id}
                                  className="flex cursor-pointer items-center gap-3 rounded p-2.5 hover:bg-accent hover:text-accent-foreground"
                                >
                                  <input
                                    type="checkbox"
                                    checked={field.value.includes(user.id)}
                                    onChange={() => {
                                      const next = field.value.includes(
                                        user.id
                                      )
                                        ? field.value.filter(
                                            (id) => id !== user.id
                                          )
                                        : [...field.value, user.id]
                                      field.onChange(next)
                                    }}
                                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-popover-foreground">
                                      {user.account?.profile?.fullName ||
                                        user.account?.email}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {user.account?.email}
                                    </p>
                                  </div>
                                  {field.value.includes(user.id) && (
                                    <Check
                                      size={14}
                                      className="shrink-0 text-primary"
                                    />
                                  )}
                                </label>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              />
            </div>
          </div>

          {/* ── Five Cs (formal finding details, optional) ── */}
          <div className="rounded-lg border border-border bg-card">
            <button
              type="button"
              onClick={() => setShowFiveCs((p) => !p)}
              aria-expanded={showFiveCs}
              aria-controls="finding-five-cs-panel"
              className="flex w-full items-center justify-between px-5 py-3 text-left"
            >
              <h3 className="text-base font-semibold text-card-foreground">
                {t("organization.findings.fiveCsSectionTitle")}
              </h3>
              <ChevronDown
                size={16}
                className={`text-muted-foreground transition-transform ${
                  showFiveCs ? "rotate-180" : ""
                }`}
              />
            </button>

            {showFiveCs && (
              <div
                id="finding-five-cs-panel"
                className="space-y-4 border-t border-border p-5"
              >
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {t("organization.findings.criteriaLabel")}
                  </label>
                  <TextareaAutosize
                    {...register("criteria")}
                    placeholder={t("organization.findings.criteriaPlaceholder")}
                    rows={1}
                    className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {t("organization.findings.conditionLabel")}
                  </label>
                  <TextareaAutosize
                    {...register("condition")}
                    placeholder={t("organization.findings.conditionPlaceholder")}
                    rows={1}
                    className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {t("organization.findings.causeLabel")}
                  </label>
                  <TextareaAutosize
                    {...register("cause")}
                    placeholder={t("organization.findings.causePlaceholder")}
                    rows={1}
                    className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {t("organization.findings.effectLabel")}
                  </label>
                  <TextareaAutosize
                    {...register("effect")}
                    placeholder={t("organization.findings.effectPlaceholder")}
                    rows={1}
                    className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Updates / Messages section ── */}
          <div className="space-y-3">
            {/* Existing messages */}
            {messages.length > 0 && (
              <div className="max-h-36 space-y-2 overflow-y-auto">
                {messages.map((msg: IActionMessage, i: number) => (
                  <div
                    key={i}
                    className="rounded-lg bg-muted px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {msg.account?.profile?.fullName ||
                        msg.account?.organizationProfile?.organizationName ||
                        t("organization.findings.unknownUser")}
                      :{" "}
                    </span>
                    <span className="text-muted-foreground">{msg.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Media previews */}
            {mediaFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {mediaFiles.map((url, i) => (
                  <div key={i} className="group relative">
                    {isVideoUrl(url) ? (
                      <video
                        src={url}
                        muted
                        className="h-16 w-16 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <img
                        src={url}
                        alt={t("organization.findings.uploadMediaAlt", {
                          index: i,
                        })}
                        className="h-16 w-16 rounded-lg border border-border object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(url)}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X size={10} className="text-destructive-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 justify-between gap-3 border-t border-border px-6 py-4">
          {/* Message input row: media | input | send */}
          <div className="flex flex-1 items-center gap-2">
            {/* Media upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleMediaUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title={t("organization.findings.uploadMedia")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-input bg-background text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-50"
            >
              {isUploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <Image size={18} />
              )}
            </button>

            {/* Text input */}
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={t("organization.findings.addUpdatePlaceholder")}
              className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                {isEdit
                  ? t("organization.findings.updating")
                  : t("organization.findings.creating")}
              </>
            ) : isEdit ? (
              t("organization.findings.updateFindingBtn")
            ) : (
              t("organization.findings.createFindingBtn")
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
