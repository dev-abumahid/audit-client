/* eslint-disable @typescript-eslint/no-explicit-any */
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import { useMyAssignedInspectionIds } from "@/hooks/useMyAssignments"
import { useMyOrgRole } from "@/hooks/useMyOrgRole"
import { useModalA11y } from "@/hooks/useModalA11y"
import { canWriteInspection } from "@/utils/assignmentScope"
import {
  useAddFindingMessageMutation,
  useDeleteFindingByIdMutation,
  useGetFindingByIdQuery,
  useUpdateFindingByIdMutation,
  useUploadFindingAttachmentMutation,
} from "@/redux/apis/organization/findings.api"
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  Clock,
  Download,
  Edit,
  Eye,
  File,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  Upload,
  User,
  Users,
  Video,
  X,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import type { IAction } from "@/types/finding"
import { attachmentFileName } from "@/utils/attachmentFileName"
import { fileType } from "@/utils/fileType"
import { formatLocaleDate } from "@/utils/formatDate"
import CreateNewFindingModal from "./CreateNewFindingModal"
import FindingClosureControls from "./FindingClosureControls"

type Tab = "details" | "messages" | "files"

// Backend status enum -> i18n key. Resolved with t() at render time; the raw
// enum is used as a fallback for any unmapped value.
const STATUS_DISPLAY_KEYS: Record<string, string> = {
  TO_DO: "organization.findings.statusToDo",
  IN_PROGRESS: "organization.findings.statusInProgress",
  COMPLETE: "organization.findings.statusComplete",
  CANT_DO: "organization.findings.statusCantDo",
}

const STATUS_STYLE: Record<string, string> = {
  TO_DO: "bg-risk-medium/10 text-risk-medium border-risk-medium/20",
  IN_PROGRESS: "bg-risk-info/10 text-risk-info border-risk-info/20",
  COMPLETE: "bg-risk-low/10 text-risk-low border-risk-low/20",
  CANT_DO: "bg-risk-critical/10 text-risk-critical border-risk-critical/20",
}

const PRIORITY_DISPLAY_KEYS: Record<string, string> = {
  Low: "organization.findings.priorityLow",
  Medium: "organization.findings.priorityMedium",
  High: "organization.findings.priorityHigh",
}

const PRIORITY_STYLE: Record<string, string> = {
  Low: "bg-risk-low/10 text-risk-low border-risk-low/20",
  Medium: "bg-risk-medium/10 text-risk-medium border-risk-medium/20",
  High: "bg-risk-high/10 text-risk-high border-risk-high/20",
}

const StatusIcon = ({ status }: { status?: string }) => {
  const s = status?.toUpperCase()
  if (s === "COMPLETE") return <CheckCircle className="h-4 w-4" />
  if (s === "IN_PROGRESS") return <Clock className="h-4 w-4" />
  if (s === "CANT_DO") return <X className="h-4 w-4" />
  return <AlertCircle className="h-4 w-4" />
}

// Translated caption for the fileType() discriminator above -- fileType()
// itself must keep returning the raw "image"/"video"/"document"/"file"
// strings since those are used as comparison keys, not just display text.
const FILE_TYPE_LABEL_KEYS: Record<string, string> = {
  image: "organization.findings.fileTypeImage",
  video: "organization.findings.fileTypeVideo",
  document: "organization.findings.fileTypeDocument",
  file: "organization.findings.fileTypeFile",
}

const downloadFile = (url: string) => {
  // Was a mock (just a toast with the URL) — attachments are direct Cloudinary
  // file URLs, so a real download is just a temporary anchor with `download`
  // set; the browser handles cross-origin download itself, no fetch/blob
  // needed. Found and fixed while wiring real attachments in, since shipping
  // real files behind a fake download button would be the same
  // looks-real-but-isn't problem this pass exists to fix.
  const link = document.createElement("a")
  link.href = url
  link.download = attachmentFileName(url)
  link.target = "_blank"
  link.rel = "noopener noreferrer"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Preview Modal Component
const PreviewModal = ({
  url,
  onClose,
}: {
  url: string
  onClose: () => void
}) => {
  const { t } = useTranslation()
  const type = fileType(url)

  // Round 13 (#506) -- role="dialog"/focus-trap/Escape for the attachment
  // preview overlay, same pattern InspectionReport.tsx's media lightbox and
  // EditTemplatePage.tsx's add-modal use. This component only renders while
  // its parent's previewUrl is set, so it's open for its entire mounted
  // lifetime.
  const previewModalRef = useModalA11y(true, onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={previewModalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="finding-attachment-preview-title"
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="text-muted-foreground">
              {type === "image" && <ImageIcon className="h-5 w-5" />}
              {type === "video" && <Video className="h-5 w-5" />}
              {type === "document" && <FileText className="h-5 w-5" />}
              {type === "file" && <File className="h-5 w-5" />}
            </div>
            <h2
              id="finding-attachment-preview-title"
              className="truncate text-sm font-medium text-foreground"
            >
              {attachmentFileName(url)}
            </h2>
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-2">
            <button
              onClick={() => downloadFile(url)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />{" "}
              {t("organization.findings.download")}
            </button>
            <button
              onClick={onClose}
              aria-label={t("organization.findings.closePreview")}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-75 flex-1 items-center justify-center overflow-auto bg-muted/30 p-4">
          {type === "image" && (
            <img
              src={url || "/placeholder.svg"}
              alt={t("organization.findings.preview")}
              className="max-h-[70vh] max-w-full rounded object-contain"
            />
          )}
          {type === "video" && (
            <video controls className="max-h-[70vh] max-w-full rounded">
              <source src={url} />
              {t("organization.findings.videoUnsupported")}
            </video>
          )}
          {type === "document" && url.endsWith(".pdf") && (
            <iframe
              src={url}
              className="h-[70vh] w-full rounded border-0"
              title={t("organization.findings.pdfPreview")}
            />
          )}
          {(type === "file" ||
            (type === "document" && !url.endsWith(".pdf"))) && (
            <div className="py-12 text-center">
              <File className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-3 font-medium text-foreground">
                {t("organization.findings.previewUnavailable")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("organization.findings.downloadToView")}
              </p>
              <button
                onClick={() => downloadFile(url)}
                className="mx-auto mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Download className="h-4 w-4" />{" "}
                {t("organization.findings.downloadFile")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FindingDetails() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  // Was toLocaleDateString("en-US", ...) hardcoded -- silently ignored the
  // app's selected language and always showed English month names under a
  // French UI. Uses the shared formatLocaleDate helper (built in round 3 to
  // prevent exactly this bug class -- aexa-frontend#339) instead of a
  // second local en-US-only formatter.
  const formatDate = (dateString: string) => {
    try {
      return formatLocaleDate(dateString, i18n.language, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateString
    }
  }
  // aexa-frontend#217
  const role = useMyOrgRole()
  // aexa-frontend#270: assignment data is fetched unconditionally here
  // (hooks can't be called after the early returns below) and combined with
  // `action.inspectionId` once `action` is known, to narrow LEAD_AUDITOR's
  // Edit/Delete below to only findings on an inspection they're actually
  // assigned to -- see canWrite's new definition after the `action` guard.
  const assignedInspectionIds = useMyAssignedInspectionIds()
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useGetFindingByIdQuery(id as string)
  const [deleteFinding, { isLoading: isDeleting }] =
    useDeleteFindingByIdMutation()
  const [updateFinding] = useUpdateFindingByIdMutation()
  const [uploadAttachment] = useUploadFindingAttachmentMutation()
  // #170/#215: update_action_into_db (PATCH, used for edits) never persists
  // body.messages -- a new comment on an existing finding has to go through
  // this dedicated PUT endpoint instead. CreateNewFindingModal.tsx already
  // does this from its own edit flow; this page's Messages tab never called
  // it at all, so posting a message here was silently impossible.
  const [addMessage, { isLoading: isSendingMessage }] =
    useAddFindingMessageMutation()
  const [newMessageText, setNewMessageText] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("details")
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [removingAttachmentUrl, setRemovingAttachmentUrl] = useState<
    string | null
  >(null)
  // Upload/remove both PATCH the finding with a body built from the
  // `action.attachments` array captured in this render's closure — that
  // array only reflects reality again once updateFindingById's own
  // invalidatesTags refetch lands and re-renders with fresh data, a real
  // async gap. Two attachment mutations started inside that gap (e.g.
  // clicking Remove on two different attachments back to back) both read
  // the same stale array and can race, with whichever PATCH resolves last
  // silently undoing the other's change. Rather than trying to always read
  // fresher state, serialize: disable every upload/remove control while ANY
  // attachment mutation is in flight, not just the specific one clicked.
  // Found by independent review.
  const isMutatingAttachments = isUploadingAttachment || removingAttachmentUrl !== null

  const handleDelete = () => {
    setDeleteConfirmOpen(true)
  }

  const handleEdit = () => {
    setEditModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!id) return
    try {
      await deleteFinding(id).unwrap()
      toast.success(t("organization.findings.deleteSuccess"))
      navigate(-1)
    } catch (err: any) {
      toast.error(
        err?.data?.message || t("organization.findings.deleteFailed")
      )
    }
  }

  const handleSendMessage = async () => {
    const message = newMessageText.trim()
    if (!id || !message) return
    try {
      await addMessage({ id, message }).unwrap()
      // No local state to update -- addFindingMessage's invalidatesTags
      // refetches getFindingById (providesTags: ["FINDINGS"]), which brings
      // the new message back in `action.messages`.
      setNewMessageText("")
    } catch (err: any) {
      toast.error(
        err?.data?.message || t("organization.findings.sendMessageFailed")
      )
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            {t("organization.findings.loading")}
          </p>
        </div>
      </div>
    )
  }

  const action: IAction | undefined = data?.data

  // aexa-frontend#270: replaces the old canWriteOrgResource(role) coarse
  // gate -- ADMIN is unaffected, LEAD_AUDITOR now additionally needs to be
  // assigned to this finding's parent inspection (mirrors
  // assertCanWriteToAction's LEAD_AUDITOR branch server-side), and
  // VIEWER/LIGHT_USER stay excluded exactly as before (LIGHT_USER's
  // FindingAssignment-based finding-edit access is a separate, narrower
  // surface -- see FindingClosureControls.tsx -- not extended to this raw
  // Edit/Delete control in this issue).
  const canWrite = action
    ? canWriteInspection(role, action.inspectionId, assignedInspectionIds)
    : false

  if (!action) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            {t("organization.findings.notFound")}
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="mx-auto flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ChevronLeft className="h-4 w-4" />{" "}
            {t("organization.findings.goBack")}
          </button>
        </div>
      </div>
    )
  }

  const handleUploadAttachment = async (file: File) => {
    setIsUploadingAttachment(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const uploadRes = await uploadAttachment(formData).unwrap()
      const url: string | undefined = uploadRes?.data?.url
      if (!url) {
        toast.error(t("organization.findings.uploadFailedShort"))
        return
      }
      // Separate try/catch from the upload above: by this point the file
      // itself has genuinely been uploaded, so a failure here is a partial
      // success, not a full failure -- it needs its own toast rather than
      // falling into the shared catch below, which would tell the user the
      // upload itself failed even though only attaching the URL to the
      // finding was lost (#123, same pattern as #170).
      //
      // `url` isn't persisted anywhere on this failure -- there's no
      // retry-attach path that skips a fresh upload, so the message says so
      // explicitly rather than implying the already-uploaded file can be
      // reattached without re-uploading it.
      try {
        await updateFinding({
          id: action.id,
          body: { attachments: [...action.attachments, url] },
        }).unwrap()
      } catch (attachErr: any) {
        toast.error(
          attachErr?.data?.message ||
            t("organization.findings.attachFailed")
        )
        return
      }
      toast.success(t("organization.findings.attachmentUploaded"))
    } catch (err: any) {
      toast.error(
        err?.data?.message || t("organization.findings.uploadAttachmentFailed")
      )
    } finally {
      setIsUploadingAttachment(false)
    }
  }

  const handleRemoveAttachment = async (url: string) => {
    setRemovingAttachmentUrl(url)
    try {
      await updateFinding({
        id: action.id,
        body: {
          attachments: action.attachments.filter(
            (existing) => existing !== url
          ),
        },
      }).unwrap()
      toast.success(t("organization.findings.attachmentRemoved"))
    } catch (err: any) {
      toast.error(
        err?.data?.message || t("organization.findings.removeAttachmentFailed")
      )
    } finally {
      setRemovingAttachmentUrl(null)
    }
  }

  const TABS: {
    key: Tab
    label: string
    icon: React.ReactNode
    count?: number
  }[] = [
    {
      key: "details",
      label: t("organization.findings.tabDetails"),
      icon: <FileText className="h-4 w-4" />,
    },
    {
      key: "messages",
      label: t("organization.findings.tabMessages"),
      icon: <MessageSquare className="h-4 w-4" />,
      count: action.messages?.length,
    },
    {
      key: "files",
      label: t("organization.findings.tabAttachments"),
      icon: <Paperclip className="h-4 w-4" />,
      count: action.attachments.length,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> {t("organization.findings.back")}
            </button>
            <h1 className="mb-3 text-2xl font-bold text-foreground">
              {action.actionTitle}
            </h1>
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${STATUS_STYLE[action.status]}`}
              >
                <StatusIcon status={action.status} />
                {STATUS_DISPLAY_KEYS[action.status]
                  ? t(STATUS_DISPLAY_KEYS[action.status])
                  : action.status}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${PRIORITY_STYLE[action.priority]}`}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {t("organization.findings.priorityLabel", {
                  level: PRIORITY_DISPLAY_KEYS[action.priority]
                    ? t(PRIORITY_DISPLAY_KEYS[action.priority])
                    : action.priority,
                })}
              </span>
            </div>
            <div className="mt-3">
              <FindingClosureControls action={action} />
            </div>
          </div>

          {/* #217: same coarse ADMIN/LEAD_AUDITOR gate as AllFindingsPage --
              see that file's comment for why full per-assignment gating
              isn't done here yet. */}
          {canWrite && (
            <div className="flex gap-2">
              <button
                onClick={handleEdit}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Edit size={18} /> {t("organization.findings.edit")}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
              >
                <Trash2 size={18} /> {t("organization.findings.delete")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-9xl mx-auto px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Tabs Content */}
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl border border-border bg-card">
              {/* Tab Navigation */}
              <div className="flex border-b border-border px-4">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-3.5 text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {!!tab.count && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {/* Details Tab */}
                {activeTab === "details" && (
                  <div className="space-y-5">
                    <div>
                      <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        {t("organization.findings.descriptionLabel")}
                      </p>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                        {action.actionDisc ? (
                          <div className="whitespace-pre-wrap">
                            {action.actionDisc}
                          </div>
                        ) : (
                          <p className="text-muted-foreground">
                            {t("organization.findings.noDescription")}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Five Cs (aexa-server#244) — optional formal finding
                        details; only rendered when at least one is set, so a
                        plain remediation task's Details tab stays unchanged. */}
                    {(action.criteria ||
                      action.condition ||
                      action.cause ||
                      action.effect) && (
                      <>
                        <hr className="border-border" />
                        <div>
                          <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                            {t("organization.findings.fiveCsSectionTitle")}
                          </p>
                          <div className="space-y-3 text-sm">
                            {action.criteria && (
                              <div>
                                <p className="font-medium text-foreground">
                                  {t("organization.findings.criteriaLabel")}
                                </p>
                                <p className="whitespace-pre-wrap text-muted-foreground">
                                  {action.criteria}
                                </p>
                              </div>
                            )}
                            {action.condition && (
                              <div>
                                <p className="font-medium text-foreground">
                                  {t("organization.findings.conditionLabel")}
                                </p>
                                <p className="whitespace-pre-wrap text-muted-foreground">
                                  {action.condition}
                                </p>
                              </div>
                            )}
                            {action.cause && (
                              <div>
                                <p className="font-medium text-foreground">
                                  {t("organization.findings.causeLabel")}
                                </p>
                                <p className="whitespace-pre-wrap text-muted-foreground">
                                  {action.cause}
                                </p>
                              </div>
                            )}
                            {action.effect && (
                              <div>
                                <p className="font-medium text-foreground">
                                  {t("organization.findings.effectLabel")}
                                </p>
                                <p className="whitespace-pre-wrap text-muted-foreground">
                                  {action.effect}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    <hr className="border-border" />

                    <div>
                      <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        {t("organization.findings.timeline")}
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Calendar className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {t("organization.findings.dueDate")}
                            </p>
                            <p className="font-medium text-foreground">
                              {formatDate(action.dueDate)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {t("organization.findings.createdLabel")}
                            </p>
                            <p className="font-medium text-foreground">
                              {formatDate(action.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {t("organization.findings.lastUpdated")}
                            </p>
                            <p className="font-medium text-foreground">
                              {formatDate(action.updatedAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Messages Tab */}
                {activeTab === "messages" && (
                  <div className="space-y-4">
                  <div className="max-h-120 space-y-3 overflow-y-auto">
                    {action.messages && action.messages.length > 0 ? (
                      action.messages.map((msg, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 rounded-lg bg-muted/50 px-4 py-3">
                            <div className="mb-1 flex items-center justify-between">
                              <p className="text-sm font-semibold text-foreground">
                                {msg.account?.profile?.fullName ||
                                  msg.account?.organizationProfile
                                    ?.organizationName ||
                                  t("organization.findings.unknownUser")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(msg.createdAt)}
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {msg.message}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center">
                        <MessageSquare className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">
                          {t("organization.findings.noMessages")}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Compose box (#170/#215) */}
                  <div className="flex items-center gap-2 border-t border-border pt-4">
                    <input
                      type="text"
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                      placeholder={t("organization.findings.addUpdatePlaceholder")}
                      disabled={isSendingMessage}
                      className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={isSendingMessage || !newMessageText.trim()}
                      aria-label={t("organization.findings.sendMessage")}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isSendingMessage ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  </div>
                )}

                {/* Files Tab */}
                {activeTab === "files" && (
                  <div className="space-y-6">
                    <div className="flex justify-end">
                      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                        {isUploadingAttachment ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {t("organization.findings.uploadFile")}
                        <input
                          type="file"
                          className="hidden"
                          disabled={isMutatingAttachments}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadAttachment(file)
                            e.target.value = ""
                          }}
                        />
                      </label>
                    </div>

                    {action.attachments.length === 0 ? (
                      <div className="py-12 text-center">
                        <Paperclip className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">
                          {t("organization.findings.noAttachments")}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Images Grid */}
                        {action.attachments.filter(
                          (url) => fileType(url) === "image"
                        ).length > 0 && (
                          <div>
                            <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                              <ImageIcon className="h-4 w-4" /> {t("organization.findings.images")}
                            </p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                              {action.attachments
                                .filter((url) => fileType(url) === "image")
                                .map((url, i) => (
                                  <div
                                    key={i}
                                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                                  >
                                    <img
                                      src={url || "/placeholder.svg"}
                                      alt={t("organization.findings.attachmentMediaAlt", {
                                        index: i,
                                      })}
                                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-colors group-hover:bg-black/40">
                                      <button
                                        onClick={() => setPreviewUrl(url)}
                                        className="rounded-lg bg-background p-2 transition-colors hover:bg-muted"
                                        title={t("organization.findings.preview")}
                                      >
                                        <Eye className="h-4 w-4 text-foreground" />
                                      </button>
                                      <button
                                        onClick={() => downloadFile(url)}
                                        className="rounded-lg bg-background p-2 transition-colors hover:bg-muted"
                                        title={t("organization.findings.download")}
                                      >
                                        <Download className="h-4 w-4 text-foreground" />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleRemoveAttachment(url)
                                        }
                                        disabled={isMutatingAttachments}
                                        className="rounded-lg bg-background p-2 transition-colors hover:bg-destructive/10 disabled:opacity-50"
                                        title={t("organization.findings.remove")}
                                      >
                                        {removingAttachmentUrl === url ? (
                                          <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                                        ) : (
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Other Files List */}
                        {action.attachments.filter(
                          (url) => fileType(url) !== "image"
                        ).length > 0 && (
                          <div>
                            <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                              <File className="h-4 w-4" /> {t("organization.findings.files")}
                            </p>
                            <div className="space-y-2">
                              {action.attachments
                                .filter((url) => fileType(url) !== "image")
                                .map((url, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                                  >
                                    <div className="flex min-w-0 items-center gap-3">
                                      <File className="h-5 w-5 shrink-0 text-muted-foreground" />
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-foreground">
                                          {attachmentFileName(url)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {t(FILE_TYPE_LABEL_KEYS[fileType(url)])}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="ml-3 flex shrink-0 items-center gap-2">
                                      <button
                                        onClick={() => setPreviewUrl(url)}
                                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        title={t("organization.findings.preview")}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => downloadFile(url)}
                                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        title={t("organization.findings.download")}
                                      >
                                        <Download className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleRemoveAttachment(url)
                                        }
                                        disabled={isMutatingAttachments}
                                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                        title={t("organization.findings.remove")}
                                      >
                                        {removingAttachmentUrl === url ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* Site Info */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <MapPin className="h-4 w-4" /> {t("organization.findings.site")}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {action.site?.name || t("organization.findings.notSpecified")}
              </p>
            </div>
            {/* Inspection Info - Placeholder */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <AlertCircle className="h-4 w-4" /> {t("organization.findings.inspectionLabel")}
              </p>
              <p className="text-sm font-medium text-foreground">
                {action.inspectionId
                  ? t("organization.findings.linkedToInspection")
                  : t("organization.findings.noInspectionLinked")}
              </p>
              {action.inspectionId && (
                <p className="mt-1 font-mono text-xs text-muted-foreground hover:underline hover:decoration-primary">
                  {t("organization.findings.idLabel")}:{" "}
                  <Link
                    to={`/organization/audit/inspections/report/${action.inspectionId}`}
                  >
                    {action.inspectionId.slice(-8)}
                  </Link>
                </p>
              )}
            </div>

            {/* Assigned Users (#215 -- this used to always render the empty
                state, never reading action.assignBy at all) */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <Users className="h-4 w-4" /> {t("organization.findings.assignedResponsible")}
              </p>
              {action.assignBy && action.assignBy.length > 0 ? (
                <div className="space-y-2">
                  {action.assignBy.map((user) => (
                    <div key={user.id} className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <p className="truncate text-sm font-medium text-foreground">
                        {user.name}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("organization.findings.noUsersAssigned")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <PreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
      )}

      <CreateNewFindingModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        editData={action as any}
      />

      <DeleteAlertModal
        open={deleteConfirmOpen}
        setOpen={setDeleteConfirmOpen}
        onConfirm={confirmDelete}
        loading={isDeleting}
        title={t("organization.findings.deleteConfirmTitle")}
        description={t("organization.findings.deleteConfirmDesc")}
      />
    </div>
  )
}
