/* eslint-disable @typescript-eslint/no-explicit-any */
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import { Button } from "@/components/ui/button"
import {
  useDeleteFindingByIdMutation,
  useGetAllFindingsQuery,
} from "@/redux/apis/organization/findings.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import { useClampPageToTotal } from "@/hooks/useClampPageToTotal"
import { useMyAssignedInspectionIds } from "@/hooks/useMyAssignments"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import type { IAction } from "@/types/finding"
import { canWriteInspection } from "@/utils/assignmentScope"
import { formatLocaleDate } from "@/utils/formatDate"
import type { TFunction } from "i18next"
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
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import CreateNewFindingModal from "./CreateNewFindingModal"

// Backend status enum -> i18n key. Resolved with t() at render time so the
// badge label follows the active locale (the enum value itself is data).
const STATUS_KEYS: Record<string, string> = {
  TO_DO: "organization.findings.statusToDo",
  IN_PROGRESS: "organization.findings.statusInProgress",
  COMPLETE: "organization.findings.statusComplete",
  CANT_DO: "organization.findings.statusCantDo",
}

// Priority enum -> i18n key, same pattern as STATUS_KEYS.
const PRIORITY_KEYS: Record<string, string> = {
  Low: "organization.findings.priorityLow",
  Medium: "organization.findings.priorityMedium",
  High: "organization.findings.priorityHigh",
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETE:
    "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30",
  IN_PROGRESS:
    "text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/30",
  CANT_DO: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30",
  TO_DO: "text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/30",
}

const PRIORITY_BADGES: Record<string, string> = {
  Low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  High: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

// aexa-frontend round-3 audit bug #3: hardcoded "en-US" ignored the active
// locale, always showing the month abbreviation in English even in French.
// The day/year are locale-invariant Arabic numerals so only the month piece
// needs to go through the locale-aware helper (see formatDate.ts).
const formatDate = (dateString: string, language: string | undefined) => {
  const date = new Date(dateString)
  return `${date.getDate()} ${formatLocaleDate(date, language, { month: "short" })} ${date.getFullYear()}`
}

const getRelativeTime = (dateString: string, t: TFunction) => {
  const days = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 86400000
  )
  if (days === 0) return t("organization.findings.today")
  if (days < 30) return t("organization.findings.daysAgo", { count: days })
  return t("organization.findings.monthsAgo", { count: Math.floor(days / 30) })
}

export default function AllFindingsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  // aexa-frontend#217
  const role = useMyOrgRole()
  const canWrite = canWriteOrgResource(role)
  // aexa-frontend#270: assignment data for narrowing per-row Edit/Delete
  // below -- `canWrite` above stays role-only for the page-level "Create
  // new" affordance (creating a finding needs no assignment to narrow by;
  // it's inspection-scoped only, same reasoning as InspectionTable.tsx's
  // "Start New").
  const assignedInspectionIds = useMyAssignedInspectionIds()
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

  const [deleteAction, { isLoading: isDeleting }] =
    useDeleteFindingByIdMutation()
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const actions: IAction[] = data?.data || []
  const meta = data?.meta
  const totalPages = meta?.totalPage || 0

  // aexa-frontend#265: deleting the last finding on the last page shrinks
  // totalPages without a filter change (handleSiteFilter/clearFilters below
  // only reset page on filter changes), stranding the user on an
  // out-of-range empty page. Delete-path counterpart to #234/#243.
  useClampPageToTotal(page, totalPages, setPage)

  const handleDelete = async (id: string) => {
    try {
      const res = await deleteAction(id).unwrap()
      toast.success(
        res.message || t("organization.findings.actionDeleteSuccess")
      )
      setDeleteTargetId(null)
    } catch (err: any) {
      toast.error(
        err?.data?.message || t("organization.findings.actionDeleteFailed")
      )
      setDeleteTargetId(null)
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
          <p className="mt-4 text-muted-foreground">
            {t("organization.findings.loadingFindings")}
          </p>
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
              {t("organization.findings.allTitle")}
            </h1>
            <span className="text-sm text-muted-foreground">
              •{" "}
              {t("organization.findings.totalCount", {
                count: meta?.total || 0,
              })}
            </span>
          </div>
          {canWrite && (
            <button
              onClick={() => setModalState({ open: true, editData: null })}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus size={18} /> {t("organization.findings.createTitle")}
            </button>
          )}
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
                placeholder={t("organization.findings.searchPlaceholder")}
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
                aria-haspopup="true"
                aria-expanded={showFilterDropdown}
                className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Filter size={16} />
                {t("organization.findings.filter")}
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
                        {t("organization.findings.filterBySite")}
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
                        {t("organization.findings.allSites")}
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
                          {t("organization.findings.clearFilters")}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Screen-reader-only section heading: h1 (page title) was
              followed directly by h3s (filter popover, empty state) with
              no h2 anywhere on the page. This is the one heading that's
              always in the DOM regardless of render path, so it's what
              actually fixes the hierarchy gap rather than the two h3s
              above/below, which are conditional (aexa-frontend round-9
              audit #469). */}
          <h2 className="sr-only">
            {t("organization.findings.findingsListHeading")}
          </h2>

          {/* Table View - Professional Design */}
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t("organization.findings.colTitle")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t("organization.findings.site")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t("organization.findings.statusLabel")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t("organization.findings.priority")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t("organization.findings.dueDate")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t("organization.findings.tabMessages")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t("organization.findings.colActions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {actions.length > 0 ? (
                    actions.map((action) => {
                      const canWriteThisFinding = canWriteInspection(
                        role,
                        action.inspectionId,
                        assignedInspectionIds
                      )
                      return (
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
                              {t("organization.findings.updatedRelative", {
                                time: getRelativeTime(action.updatedAt, t),
                              })}
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
                              {action?.site?.name ||
                                t("organization.findings.notAvailable")}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[action.status]}`}
                          >
                            {STATUS_KEYS[action.status]
                              ? t(STATUS_KEYS[action.status])
                              : action.status}
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_BADGES[action.priority]}`}
                          >
                            {PRIORITY_KEYS[action.priority]
                              ? t(PRIORITY_KEYS[action.priority])
                              : action.priority}
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
                              {formatDate(action.dueDate, i18n.language)}
                            </span>
                          </div>
                        </td>

                        {/* Messages */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                            {action.messages?.length || 0}
                          </span>
                        </td>

                        {/* Actions -- aexa-frontend#270: per-row
                            ADMIN/assigned-LEAD_AUDITOR gate (canWriteInspection,
                            keyed by action.inspectionId) replacing the old
                            coarse role-only canWrite. LIGHT_USER's real
                            write access is the separate, narrower
                            per-FindingAssignment submit-for-closure surface
                            (FindingClosureControls.tsx), not this raw
                            Edit/Delete control. */}
                        <td className="flex justify-end gap-3 px-4 py-3 text-right whitespace-nowrap">
                          {canWriteThisFinding && (
                            <>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setModalState({ open: true, editData: action })
                                }}
                                disabled={
                                  isDeleting && deleteTargetId === action.id
                                }
                                aria-label={t("organization.findings.edit")}
                                title={t("organization.findings.edit")}
                                variant="ghost"
                                size="icon-lg"
                              >
                                <Edit2 />
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteTargetId(action.id)
                                }}
                                disabled={
                                  isDeleting && deleteTargetId === action.id
                                }
                                aria-label={t("organization.findings.delete")}
                                title={t("organization.findings.delete")}
                                variant="destructive"
                                size="icon-lg"
                              >
                                <Trash2 />
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                          <Plus size={24} className="text-muted-foreground" />
                        </div>
                        <h3 className="mb-2 text-lg font-medium text-foreground">
                          {search || selectedSiteId
                            ? t("organization.findings.noFindingsFound")
                            : t("organization.findings.noFindingsYet")}
                        </h3>
                        <p className="text-muted-foreground">
                          {search || selectedSiteId
                            ? t("organization.findings.adjustSearch")
                            : t("organization.findings.getStarted")}
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

      <DeleteAlertModal
        open={!!deleteTargetId}
        setOpen={(v) => !v && setDeleteTargetId(null)}
        loading={isDeleting}
        onConfirm={() => deleteTargetId && handleDelete(deleteTargetId)}
        title={t("organization.findings.deleteConfirmTitle")}
        description={t("organization.findings.deleteConfirmDesc")}
      />
    </div>
  )
}
