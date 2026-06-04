/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useDeleteFindingByIdMutation,
  useGetAllFindingsQuery,
} from "@/redux/apis/organization/findings.api"
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

// API Response Types
interface Message {
  id: string
  message: string
  senderAccountId: string
  createdAt: string
  updatedAt: string
  account: {
    profile: null
    organizationProfile: {
      organizationName: string
      organizationLogo: null
    }
  }
}

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
  messages: Message[]
  site: Site
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETE: "text-green-600",
  IN_PROGRESS: "text-orange-600",
  CANT_DO: "text-red-600",
  TO_DO: "text-gray-600",
}

const STATUS_DISPLAY: Record<string, string> = {
  TO_DO: "To Do",
  IN_PROGRESS: "In Progress",
  COMPLETE: "Complete",
  CANT_DO: "Can't Do",
}

const PRIORITY_COLORS: Record<string, string> = {
  Low: "text-blue-600 bg-blue-100 border-blue-200",
  Medium: "text-yellow-600 bg-yellow-100 border-yellow-200",
  High: "text-red-600 bg-red-100 border-red-200",
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
    editData?: Action | null
  }>({ open: false })

  const { data, isLoading } = useGetAllFindingsQuery({
    page,
    limit: 20,
    searchTerm: search,
  })

  const [deleteAction] = useDeleteFindingByIdMutation()

  const actions: Action[] = data?.data || []
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-green-600" />
          <p className="mt-4 text-gray-600">Loading actions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">
              All Findings
            </h1>
            <span className="text-sm text-gray-500">
              • {meta?.total || 0} total
            </span>
          </div>
          <button
            onClick={() => setModalState({ open: true, editData: null })}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            <Plus size={18} /> Create Action
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">
          {/* Search Bar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search actions..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
            />
          </div>

          {/* Actions List */}
          <div className="space-y-3">
            {actions.length > 0 ? (
              actions.map((action) => (
                <div
                  key={action.id}
                  className="group relative rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left Section */}
                    <div
                      className="flex min-w-0 flex-1 cursor-pointer items-start gap-3"
                      onClick={() =>
                        navigate(`/dashboard/single-action/${action.id}`)
                      }
                    >
                      <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                        <span className="text-sm font-medium text-gray-600">
                          {action.actionTitle.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-medium text-gray-900">
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
                          <p className="mb-2 line-clamp-1 text-sm text-gray-600">
                            {action.actionDisc}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> Due:{" "}
                            {formatDate(action.dueDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin size={12} /> {action.site.name}
                          </span>
                          <span>
                            Updated {getRelativeTime(action.updatedAt)}
                          </span>
                        </div>

                        {action.messages.length > 0 && (
                          <div className="mt-2 text-xs text-gray-400">
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
                        className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
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
                          <div className="absolute top-8 right-0 z-50 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                            <button
                              onClick={() => {
                                setModalState({ open: true, editData: action })
                                setDropdownId(null)
                              }}
                              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Edit2 size={16} className="text-green-600" />{" "}
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(action.id)}
                              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
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
              <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <Plus size={24} className="text-gray-400" />
                </div>
                <h3 className="mb-2 text-lg font-medium text-gray-900">
                  {search ? "No actions found" : "No actions yet"}
                </h3>
                <p className="text-gray-500">
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
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={20} />
              </button>

              {getPageNumbers().map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    page === pageNum
                      ? "bg-green-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
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
