/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useDeleteFindingByIdMutation,
  useGetAllFindingsQuery,
} from "@/redux/apis/organization/findings.api"
import type { IAction } from "@/types/finding"
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  MapPin,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import CreateNewFindingModal from "./CreateNewFindingModal"

const STATUS_COLORS: Record<string, string> = {
  COMPLETE: "text-risk-low",
  IN_PROGRESS: "text-risk-medium",
  CANT_DO: "text-risk-critical",
  TO_DO: "text-muted-foreground",
}

const STATUS_DISPLAY: Record<string, string> = {
  TO_DO: "To Do",
  IN_PROGRESS: "In Progress",
  COMPLETE: "Complete",
  CANT_DO: "Can't Do",
}

const PRIORITY_COLORS: Record<string, string> = {
  Low: "text-risk-low bg-risk-low/10 border-risk-low/20",
  Medium: "text-risk-medium bg-risk-medium/10 border-risk-medium/20",
  High: "text-risk-high bg-risk-high/10 border-risk-high/20",
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return `${date.getDate()} ${date.toLocaleDateString("en-US", { month: "short" })} ${date.getFullYear()}`
}

const getRelativeTime = (dateString: string) => {
  const days = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 86400000
  )
  if (days === 0) return "Today"
  if (days === 1) return "1 day ago"
  if (days < 30) return `${days} days ago`
  return days < 60 ? "1 month ago" : `${Math.floor(days / 30)} months ago`
}

export default function AllFindingsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [dropdownId, setDropdownId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [modalState, setModalState] = useState<{
    open: boolean
    editData?: IAction | null
  }>({ open: false })

  const { data, isLoading } = useGetAllFindingsQuery({
    page,
    limit: 20,
    searchTerm: search,
  })

  const [deleteAction] = useDeleteFindingByIdMutation()

  const actions: IAction[] = data?.data || []
  const meta = data?.meta
  const totalPages = meta?.totalPage || 0

  const handleDelete = async (id: string) => {
    try {
      const res = await deleteAction(id).unwrap()
      toast.success(res.message || "Action deleted successfully!")
      setDropdownId(null)
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete action")
    }
  }

  const getPageNumbers = () => {
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-muted-foreground">Loading actions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">
              All Findings
            </h1>
            <span className="text-sm text-muted-foreground">
              • {meta?.total || 0} total
            </span>
          </div>
          <button
            onClick={() => setModalState({ open: true, editData: null })}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={18} /> Create Finding
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">
          {/* Search Bar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search Findings..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
            />
          </div>

          {/* Actions List */}
          <div className="space-y-3">
            {actions.length > 0 ? (
              actions.map((action) => (
                <div
                  key={action.id}
                  className="group relative rounded-lg border border-border bg-card p-4 transition-all hover:border-muted-foreground/20 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left Section */}
                    <div
                      className="flex min-w-0 flex-1 cursor-pointer items-start gap-3"
                      onClick={() =>
                        navigate(`/dashboard/single-action/${action.id}`)
                      }
                    >
                      <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                        <span className="text-sm font-medium text-muted-foreground">
                          {action.actionTitle.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-medium text-foreground">
                            {action.actionTitle}
                          </h3>
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[action.priority]}`}
                          >
                            {action.priority}
                          </span>
                          <span
                            className={`text-xs font-medium ${STATUS_COLORS[action.status]}`}
                          >
                            {STATUS_DISPLAY[action.status]}
                          </span>
                        </div>

                        {action.actionDisc && (
                          <p className="mb-2 line-clamp-1 text-sm text-muted-foreground">
                            {action.actionDisc}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> Due:{" "}
                            {formatDate(action.dueDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin size={12} /> {action?.site?.name}
                          </span>
                          <span>
                            Updated {getRelativeTime(action.updatedAt)}
                          </span>
                        </div>

                        {action.messages.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground/60">
                            💬 {action.messages.length} message
                            {action.messages.length !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Section */}
                    <div className="relative flex flex-shrink-0 items-start">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDropdownId(
                            dropdownId === action.id ? null : action.id
                          )
                        }}
                        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {/* Dropdown Menu */}
                      {dropdownId === action.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setDropdownId(null)}
                          />
                          <div className="absolute top-8 right-0 z-50 w-48 rounded-lg border border-border bg-popover py-1 shadow-lg">
                            <button
                              onClick={() => {
                                setModalState({ open: true, editData: action })
                                setDropdownId(null)
                              }}
                              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-popover-foreground hover:bg-muted"
                            >
                              <Edit2 size={16} className="text-primary" /> Edit
                            </button>
                            <button
                              onClick={() => handleDelete(action.id)}
                              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 size={16} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-border bg-card py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Plus size={24} className="text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-medium text-foreground">
                  {search ? "No actions found" : "No actions yet"}
                </h3>
                <p className="text-muted-foreground">
                  {search
                    ? "Try adjusting your search terms."
                    : "Get started by creating your first action."}
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={20} />
              </button>

              {getPageNumbers().map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    page === pageNum
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>

      <CreateNewFindingModal
        open={modalState.open}
        onClose={() => setModalState({ open: false, editData: null })}
        editData={modalState.editData}
      />
    </div>
  )
}
