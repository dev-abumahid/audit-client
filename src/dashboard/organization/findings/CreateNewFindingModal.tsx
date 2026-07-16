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
  useCreateNewFindingMutation,
  useUpdateFindingByIdMutation,
} from "@/redux/apis/organization/findings.api"
import { useGetAllInspectionQuery } from "@/redux/apis/organization/inspection.api"
import { useGetAllOrgUsersQuery } from "@/redux/apis/organization/org.user.api"
import type { IAction, IActionMessage } from "@/types/finding"
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
import TextareaAutosize from "react-textarea-autosize"
import { toast } from "sonner"

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
  return d.toISOString().slice(0, 16)
}

const PRIORITY_STYLES: Record<string, string> = {
  Low: "text-risk-low dark:text-risk-low",
  Medium: "text-risk-medium dark:text-risk-medium",
  High: "text-risk-high dark:text-risk-high",
}

const STATUS_STYLES: Record<string, string> = {
  TO_DO: "text-blue-600 dark:text-blue-400",
  IN_PROGRESS: "text-yellow-600 dark:text-yellow-400",
  COMPLETE: "text-green-600 dark:text-green-400",
  CANT_DO: "text-red-600 dark:text-red-400",
}

export default function CreateNewFindingModal({
  open,
  onClose,
  editData,
  additionalData,
}: CreateActionModalProps) {
  const isEdit = !!editData
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

  const isSaving = isCreating || isUpdating
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

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files as FileList
    if (!files || files.length === 0) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", files[0])
      const res = await uploadFIle(formData).unwrap()
      setMediaFiles((prev) => [...prev, res.data])
      toast.success(`File uploaded`)
    } catch {
      toast.error("Media upload failed.")
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
    },
  })

  useEffect(() => {
    if (!open) return

    if (editData) {
      const insId = editData.inspectionId ?? ""
      setSelectedInspectionId(insId)
      setMessages(editData.messages ?? [])
      setMediaFiles(editData.mediaFiles ?? [])
      reset({
        actionTitle: editData.actionTitle,
        actionDisc: editData.actionDisc ?? "",
        priority: editData.priority,
        status: editData.status ?? "TO_DO",
        dueDate: editData.dueDate?.slice(0, 16) ?? defaultDueDate(),
        inspectionId: insId,
        questionId: editData.questionId ?? "",
        messages: editData.messages ?? [],
        assignBy: (editData.assignBy ?? []).map((a) => a.id),
      })
    } else {
      setSelectedInspectionId(additionalData?.inspectionId ?? "")
      setMessages([])
      setMediaFiles([])
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
      })
    }
  }, [open, editData, reset])

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

  // const getSelectedUserNames = useCallback(
  //   (ids: string[]) => {
  //     if (!ids.length) return "Add assignees"
  //     if (ids.length === 1)
  //       return users.find((u: any) => u._id === ids[0])?.firstName ?? "1 user"
  //     return `${ids.length} users selected`
  //   },
  //   [users]
  // )

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (values: FindingFormValues) => {
    try {
      const finalMessages = messageInput.trim()
        ? [
            ...messages,
            { sender: "MM", message: messageInput.trim() },
            ...values.messages,
          ]
        : messages

      const payload = {
        actionTitle: values.actionTitle.trim(),
        actionDisc: values.actionDisc.trim() || undefined,
        priority: values.priority,
        status: values.status,
        dueDate: new Date(values.dueDate).toISOString(),
        assignBy: values.assignBy.length ? values.assignBy : undefined,
        questionId: values.questionId,
        inspectionId: values.inspectionId || undefined,
        messages: finalMessages,
        mediaFiles,
      }

      if (isEdit) {
        await updateAction({ id: editData!.id, body: payload }).unwrap()
        toast.success("Action updated successfully!")
      } else {
        await addAction(payload).unwrap()
        toast.success("Action created successfully!")
      }
      onClose()
    } catch (err: any) {
      toast.error(
        err?.data?.message ||
          `Failed to ${isEdit ? "update" : "create"} action.`
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
                {isEdit ? "Edit Finding" : "Create Finding"}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* Action Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Action Title *
            </label>
            <input
              {...register("actionTitle", {
                required: "Action title is required",
              })}
              placeholder="Enter action title..."
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
              Description (Optional)
            </label>
            <TextareaAutosize
              {...register("actionDisc")}
              placeholder="Add Description"
              rows={1}
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Inspection */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Inspection
            </label>
            <select
              value={selectedInspectionId}
              onChange={(e) => handleInspectionChange(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="">Select an inspection...</option>
              {inspectionsLoading ? (
                <option disabled>Loading...</option>
              ) : (
                inspectionList.map((ins) => (
                  <option key={ins._id} value={ins.id}>
                    {ins?.template?.templateName || "Unnamed Inspection"}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* ── Action Details card ── */}
          <div className="space-y-4 rounded-lg border border-border bg-card p-5">
            <h3 className="text-base font-semibold text-card-foreground">
              Action Details
            </h3>

            {/* Priority */}
            <div className="flex items-center justify-between gap-4">
              <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle size={16} /> Priority
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
                      Low
                    </option>
                    <option
                      className={`${PRIORITY_STYLES["Medium"]}`}
                      value="Medium"
                    >
                      Medium
                    </option>
                    <option
                      className={`${PRIORITY_STYLES["High"]}`}
                      value="High"
                    >
                      High
                    </option>
                  </select>
                )}
              />
            </div>

            {/* Status */}
            <div className="flex items-center justify-between gap-4">
              <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle size={16} /> Status
              </label>
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
                      To Do
                    </option>
                    <option
                      className={`${STATUS_STYLES["IN_PROGRESS"]}`}
                      value="IN_PROGRESS"
                    >
                      In Progress
                    </option>
                    <option
                      className={`${STATUS_STYLES["COMPLETE"]}`}
                      value="COMPLETE"
                    >
                      Complete
                    </option>
                    <option
                      className={`${STATUS_STYLES["CANT_DO"]}`}
                      value="CANT_DO"
                    >
                      Can't Do
                    </option>
                  </select>
                )}
              />
            </div>

            {/* Due Date */}
            <div className="flex items-start justify-between gap-4">
              <label className="mt-2 flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                <Calendar size={16} /> Due Date *
              </label>
              <div className="flex w-full max-w-55 flex-col items-end gap-1">
                <input
                  type="datetime-local"
                  {...register("dueDate", {
                    required: "Due date is required",
                    validate: (v) =>
                      new Date(v) > new Date() ||
                      "Due date cannot be in the past",
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
                <User size={16} /> Assignees
              </label>
              <Controller
                control={control}
                name="assignBy"
                render={({ field }) => (
                  <div className="relative w-full max-w-55">
                    <button
                      type="button"
                      onClick={() => setShowUserDropdown((p) => !p)}
                      className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-ring focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      <span
                        className={
                          field.value.length === 0
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }
                      >
                        {/* {getSelectedUserNames(field.value)} */}
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
                                Loading...
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
                      {/* {msg.sender}:{" "} */}
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
                    <img
                      src={url}
                      alt={`upload-${i}`}
                      className="h-16 w-16 rounded-lg border border-border object-cover"
                    />
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
              title="Upload media"
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
              placeholder="Add an update"
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
                {isEdit ? "Updating..." : "Creating..."}
              </>
            ) : isEdit ? (
              "Update Finding"
            ) : (
              "Create Finding"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
