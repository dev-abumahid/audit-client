/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button"
import {
  useDeleteFindingByIdMutation,
  useGetAllFindingsQuery,
} from "@/redux/apis/organization/findings.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import type { IAction } from "@/types/finding"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Edit2,
  Filter,
  MapPin,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import CreateNewFindingModal from "./CreateNewFindingModal"

const STATUS_COLORS: Record<string, string> = {
  COMPLETE:
    "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30",
  IN_PROGRESS:
    "text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/30",
  CANT_DO: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30",
  TO_DO: "text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/30",
}

const STATUS_DISPLAY: Record<string, string> = {
  TO_DO: "To Do",
  IN_PROGRESS: "In Progress",
  COMPLETE: "Complete",
  CANT_DO: "Can't Do",
}

const PRIORITY_BADGES: Record<string, string> = {
  Low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  High: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
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
  const [selectedSiteId, setSelectedSiteId] = useState<string>("")
  const [page, setPage] = useState(1)
  const [modalState, setModalState] = useState<{
    open: boolean
    editData?: IAction | null
  }>({ open: false })
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  // Fetch sites for filter dropdown
  const { data: sitesData } = useGetAllSitesQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
  })
  const sites = sitesData?.data || []

  // Fetch findings with filters
  const { data, isLoading, refetch } = useGetAllFindingsQuery({
    page,
    limit: 20,
    searchTerm: search,
    siteId: selectedSiteId || "",
  })

  const [deleteAction] = useDeleteFindingByIdMutation()

  const actions: IAction[] = data?.data || []
  const meta = data?.meta
  const totalPages = meta?.totalPage || 0

  const handleDelete = async (id: string) => {
    try {
      const res = await deleteAction(id).unwrap()
      toast.success(res.message || "Action deleted successfully!")
      refetch()
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete action")
    }
  }

  const handleSiteFilter = (siteId: string) => {
    setSelectedSiteId(siteId)
    setPage(1)
    setShowFilterDropdown(false)
  }

  const clearFilters = () => {
    setSearch("")
    setSelectedSiteId("")
    setPage(1)
    setShowFilterDropdown(false)
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
          <p className="mt-4 text-muted-foreground">Loading findings...</p>
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
        <div className="mx-auto">
          {/* Search and Filter Bar */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative max-w-md flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search findings..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="w-full rounded-lg border border-input bg-background py-2 pr-4 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
              />
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Filter size={16} />
                Filter
                {selectedSiteId && (
                  <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    1
                  </span>
                )}
                <ChevronsUpDown size={14} className="text-muted-foreground" />
              </button>

              {showFilterDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowFilterDropdown(false)}
                  />
                  <div className="absolute top-full right-0 z-50 mt-2 w-64 rounded-lg border border-border bg-popover shadow-lg">
                    <div className="border-b border-border p-3">
                      <h3 className="text-sm font-medium text-foreground">
                        Filter by Site
                      </h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2">
                      <button
                        onClick={() => handleSiteFilter("")}
                        className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                          !selectedSiteId
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        All Sites
                      </button>
                      {sites.map((site: any) => (
                        <button
                          key={site.id}
                          onClick={() => handleSiteFilter(site.id)}
                          className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                            selectedSiteId === site.id
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-muted"
                          }`}
                        >
                          {site.name}
                        </button>
                      ))}
                    </div>
                    {(search || selectedSiteId) && (
                      <div className="border-t border-border p-2">
                        <button
                          onClick={clearFilters}
                          className="w-full rounded-md px-3 py-2 text-center text-sm text-destructive hover:bg-destructive/10"
                        >
                          Clear all filters
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Table View - Professional Design */}
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Site
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Due Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Messages
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {actions.length > 0 ? (
                    actions.map((action) => (
                      <tr
                        key={action.id}
                        className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                        onClick={() =>
                          navigate(`/organization/finding/${action.id}`)
                        }
                      >
                        {/* Title */}
                        <td className="px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              {action.actionTitle}
                            </div>
                            {action.actionDisc && (
                              <div className="mt-1 max-w-md truncate text-xs text-muted-foreground">
                                {action.actionDisc}
                              </div>
                            )}
                            <div className="mt-1 text-xs text-muted-foreground/60">
                              Updated {getRelativeTime(action.updatedAt)}
                            </div>
                          </div>
                        </td>

                        {/* Site */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <MapPin
                              size={14}
                              className="text-muted-foreground"
                            />
                            <span className="text-sm text-foreground">
                              {action?.site?.name || "N/A"}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[action.status]}`}
                          >
                            {STATUS_DISPLAY[action.status]}
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_BADGES[action.priority]}`}
                          >
                            {action.priority}
                          </span>
                        </td>

                        {/* Due Date */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock
                              size={14}
                              className="text-muted-foreground"
                            />
                            <span className="text-sm text-foreground">
                              {formatDate(action.dueDate)}
                            </span>
                          </div>
                        </td>

                        {/* Messages */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                            {action.messages?.length || 0}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="flex justify-end gap-3 px-4 py-3 text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon-lg">
                            <Edit2 />
                          </Button>
                          <Button
                            onAbort={() => handleDelete(action.id)}
                            variant="destructive"
                            size="icon-lg"
                          >
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                          <Plus size={24} className="text-muted-foreground" />
                        </div>
                        <h3 className="mb-2 text-lg font-medium text-foreground">
                          {search || selectedSiteId
                            ? "No findings found"
                            : "No findings yet"}
                        </h3>
                        <p className="text-muted-foreground">
                          {search || selectedSiteId
                            ? "Try adjusting your search or filter criteria."
                            : "Get started by creating your first finding."}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
        onClose={() => {
          setModalState({ open: false, editData: null })
          refetch()
        }}
        editData={modalState.editData}
      />
    </div>
  )
}
