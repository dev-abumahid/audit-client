/* eslint-disable @typescript-eslint/no-explicit-any */
import { useGetFindingByIdQuery } from "@/redux/apis/organization/findings.api"
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
  MapPin,
  MessageSquare,
  Paperclip,
  Trash2,
  User,
  Users,
  Video,
  X,
} from "lucide-react"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"

// Types based on your API response
interface Site {
  name: string
  id: string
}

interface Action {
  id: string
  orgAccountId: string
  inspectionId: string
  siteId: string
  questionId: string | null
  actionTitle: string
  actionDisc: string
  priority: "Low" | "Medium" | "High"
  dueDate: string
  status: "TO_DO" | "IN_PROGRESS" | "COMPLETE" | "CANT_DO"
  createdAt: string
  updatedAt: string
  messages: any[]
  site: Site
}

type Tab = "details" | "messages" | "files"

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
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

const STATUS_DISPLAY: Record<string, string> = {
  TO_DO: "To Do",
  IN_PROGRESS: "In Progress",
  COMPLETE: "Complete",
  CANT_DO: "Can't Do",
}

const STATUS_STYLE: Record<string, string> = {
  TO_DO: "bg-risk-medium/10 text-risk-medium border-risk-medium/20",
  IN_PROGRESS: "bg-risk-info/10 text-risk-info border-risk-info/20",
  COMPLETE: "bg-risk-low/10 text-risk-low border-risk-low/20",
  CANT_DO: "bg-risk-critical/10 text-risk-critical border-risk-critical/20",
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

// Helper functions for file handling (mock for now)
const fileType = (url: string) => {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? ""
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff"].includes(ext))
    return "image"
  if (["mp4", "mov", "avi", "mkv", "webm", "wmv"].includes(ext)) return "video"
  if (["pdf", "doc", "docx", "txt", "rtf"].includes(ext)) return "document"
  return "file"
}

const fileName = (url: string) => {
  try {
    return decodeURIComponent(url.split("/").pop() || "file")
  } catch {
    return url.split("/").pop() || "file"
  }
}

const downloadFile = (url: string) => {
  // Mock download - to be implemented later
  toast.info(`Visit at: ${url}`)
}

// Preview Modal Component
const PreviewModal = ({
  url,
  onClose,
}: {
  url: string
  onClose: () => void
}) => {
  const type = fileType(url)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
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
            <p className="truncate text-sm font-medium text-foreground">
              {fileName(url)}
            </p>
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-2">
            <button
              onClick={() => downloadFile(url)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Download className="h-4 w-4" /> Download
            </button>
            <button
              onClick={onClose}
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
              alt="Preview"
              className="max-h-[70vh] max-w-full rounded object-contain"
            />
          )}
          {type === "video" && (
            <video controls className="max-h-[70vh] max-w-full rounded">
              <source src={url} />
              Your browser does not support video preview.
            </video>
          )}
          {type === "document" && url.endsWith(".pdf") && (
            <iframe
              src={url}
              className="h-[70vh] w-full rounded border-0"
              title="PDF Preview"
            />
          )}
          {(type === "file" ||
            (type === "document" && !url.endsWith(".pdf"))) && (
            <div className="py-12 text-center">
              <File className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-3 font-medium text-foreground">
                Preview not available
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Download to view this file
              </p>
              <button
                onClick={() => downloadFile(url)}
                className="mx-auto mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Download className="h-4 w-4" /> Download File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Mock data for attachments (to be replaced with actual API data)
const mockAttachments: string[] = []

export default function FindingDetails() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useGetFindingByIdQuery(id as string)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("details")

  // Mock delete function - to be implemented later
  const handleDelete = async () => {
    toast.info("Delete functionality will be implemented soon")
  }

  // Mock edit function - to be implemented later
  const handleEdit = () => {
    toast.info("Edit functionality will be implemented soon")
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const action = data?.data as Action | undefined

  if (!action) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Finding Not Found
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="mx-auto flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ChevronLeft className="h-4 w-4" /> Go Back
          </button>
        </div>
      </div>
    )
  }

  const TABS: {
    key: Tab
    label: string
    icon: React.ReactNode
    count?: number
  }[] = [
    {
      key: "details",
      label: "Details",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      key: "messages",
      label: "Messages",
      icon: <MessageSquare className="h-4 w-4" />,
      count: action.messages?.length,
    },
    {
      key: "files",
      label: "Attachments",
      icon: <Paperclip className="h-4 w-4" />,
      count: mockAttachments.length,
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
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <h1 className="mb-3 text-2xl font-bold text-foreground">
              {action.actionTitle}
            </h1>
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${STATUS_STYLE[action.status]}`}
              >
                <StatusIcon status={action.status} />
                {STATUS_DISPLAY[action.status]}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${PRIORITY_STYLE[action.priority]}`}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {action.priority} Priority
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Edit size={18} /> Edit
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              <Trash2 size={18} /> Delete
            </button>
          </div>
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
                        Description
                      </p>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                        {action.actionDisc ? (
                          <div
                            dangerouslySetInnerHTML={{
                              __html: action.actionDisc.replace(/\n/g, "<br/>"),
                            }}
                          />
                        ) : (
                          <p className="text-muted-foreground">
                            No description provided.
                          </p>
                        )}
                      </div>
                    </div>

                    <hr className="border-border" />

                    <div>
                      <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        Timeline
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Calendar className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Due Date
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
                              Created
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
                              Last Updated
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
                                {msg.sender || "Unknown"}
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
                          No messages yet
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Files Tab */}
                {activeTab === "files" && (
                  <div className="space-y-6">
                    {mockAttachments.length === 0 ? (
                      <div className="py-12 text-center">
                        <Paperclip className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">
                          No attachments
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Images Grid */}
                        {mockAttachments.filter(
                          (url) => fileType(url) === "image"
                        ).length > 0 && (
                          <div>
                            <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                              <ImageIcon className="h-4 w-4" /> Images
                            </p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                              {mockAttachments
                                .filter((url) => fileType(url) === "image")
                                .map((url, i) => (
                                  <div
                                    key={i}
                                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                                  >
                                    <img
                                      src={url || "/placeholder.svg"}
                                      alt={`attachment-${i}`}
                                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-colors group-hover:bg-black/40">
                                      <button
                                        onClick={() => setPreviewUrl(url)}
                                        className="rounded-lg bg-background p-2 transition-colors hover:bg-muted"
                                        title="Preview"
                                      >
                                        <Eye className="h-4 w-4 text-foreground" />
                                      </button>
                                      <button
                                        onClick={() => downloadFile(url)}
                                        className="rounded-lg bg-background p-2 transition-colors hover:bg-muted"
                                        title="Download"
                                      >
                                        <Download className="h-4 w-4 text-foreground" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Other Files List */}
                        {mockAttachments.filter(
                          (url) => fileType(url) !== "image"
                        ).length > 0 && (
                          <div>
                            <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                              <File className="h-4 w-4" /> Files
                            </p>
                            <div className="space-y-2">
                              {mockAttachments
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
                                          {fileName(url)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {fileType(url)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="ml-3 flex shrink-0 items-center gap-2">
                                      <button
                                        onClick={() => setPreviewUrl(url)}
                                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        title="Preview"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => downloadFile(url)}
                                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        title="Download"
                                      >
                                        <Download className="h-4 w-4" />
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
                <MapPin className="h-4 w-4" /> Site
              </p>
              <p className="text-sm font-semibold text-foreground">
                {action.site?.name || "Not specified"}
              </p>
            </div>
            {/* Inspection Info - Placeholder */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <AlertCircle className="h-4 w-4" /> Inspection
              </p>
              <p className="text-sm font-medium text-foreground">
                {action.inspectionId
                  ? "Linked to Inspection"
                  : "No inspection linked"}
              </p>
              {action.inspectionId && (
                <p className="mt-1 font-mono text-xs text-muted-foreground hover:underline hover:decoration-primary">
                  ID:{" "}
                  <Link
                    to={`/organization/audit/inspections/report/${action.inspectionId}`}
                  >
                    {action.inspectionId.slice(-8)}
                  </Link>
                </p>
              )}
            </div>

            {/* Assigned Users - Placeholder */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <Users className="h-4 w-4" /> Assigned Responsible
              </p>
              <div className="py-3 text-center">
                <p className="text-sm text-muted-foreground">
                  No users assigned yet
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <PreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
      )}
    </div>
  )
}
