/* eslint-disable @typescript-eslint/no-explicit-any */
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import FilteredByNotice from "@/components/shared/FilteredByNotice"
import Pagination from "@/components/shared/Pagination"
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
import { severityBadgeClasses } from "@/utils/severityStyles"
import type { TFunction } from "i18next"
import {
  ChevronsUpDown,
  Clock,
  Edit2,
  Filter,
  MapPin,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useSearchParams } from "react-router"
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

// Same STATUS_COLORS/PRIORITY_BADGES mapping as FindingDetails.tsx, both
// sourced from severityBadgeClasses() so the same finding renders the same
// color regardless of which page shows it (see src/utils/severityStyles.ts).
const STATUS_COLORS: Record<string, string> = {
  TO_DO: severityBadgeClasses("medium"),
  IN_PROGRESS: severityBadgeClasses("info"),
  COMPLETE: severityBadgeClasses("low"),
  CANT_DO: severityBadgeClasses("critical"),
}

const PRIORITY_BADGES: Record<string, string> = {
  Low: severityBadgeClasses("low"),
  Medium: severityBadgeClasses("medium"),
  High: severityBadgeClasses("high"),
}

// quality-bar-loop round 17 (resilience, spotted in passing while fixing
// the same bug class in AlertsPage.tsx/RiskBadge.tsx): unlike the label
// text below (`STATUS_KEYS[x] ? t(...) : x`), the badge color lookups had
// no fallback for a status/priority outside the map -- not a crash, but
// `undefined` interpolated straight into the className renders a
// styleless badge instead of a legible neutral one.
const NEUTRAL_BADGE = severityBadgeClasses("neutral")

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
  const [searchParams] = useSearchParams()
  // quality-bar-loop round 14 (industry-standards): the dashboard's
  // "Open Actions" KPI card used to be a static, non-clickable number --
  // it now links here with ?status=open, meaning TO_DO or IN_PROGRESS
  // (the same two statuses Overview.tsx's own KPI count already uses).
  // GetAllFindingsArgs has no status param and this list is server-
  // paginated at limit:20, so a naive client-side filter would only ever
  // filter whatever 20 rows happen to be on the current page. Instead,
  // while this filter is active, fetch with the same limit:100 Overview.tsx
  // itself already uses for this exact count, filter that whole window
  // client-side, and hide pagination -- consistent with how the KPI number
  // being linked to was computed in the first place, not a paginated view.
  const openStatusFilter = searchParams.get("status") === "open"
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
  // quality-bar-loop round 16 (resilience regression): this query never
  // checked isError -- a genuine fetch failure fell through to `data?.data
  // || []`, rendering the same empty-table state as "no findings match
  // this filter," surfaced by round 14's dashboard link making an
  // empty-looking result more reachable.
  const {
    data,
    isLoading,
    isError: findingsError,
    refetch,
  } = useGetAllFindingsQuery({
    page: openStatusFilter ? 1 : page,
    limit: openStatusFilter ? 100 : 20,
    searchTerm: search,
    siteId: selectedSiteId || "",
  })

  const [deleteAction, { isLoading: isDeleting }] =
    useDeleteFindingByIdMutation()
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  // quality-bar-loop round 32 (Inspections, incidentally): this route was
  // once observed hanging indefinitely on this exact spinner with no way
  // out -- not reproduced since, but `fetchBaseQuery` has no request
  // timeout (baseApi.ts), so a genuine network-level stall (dropped
  // connection, server never responding) leaves `isLoading` true forever
  // with zero escape hatch, unlike the `findingsError` branch below which
  // only ever fires once the request actually settles. This is a
  // defensive floor for that failure mode, not a claimed root-cause fix --
  // surface a manual retry once loading has clearly gone on too long
  // rather than trusting it'll always resolve on its own.
  const [loadingTooLong, setLoadingTooLong] = useState(false)
  useEffect(() => {
    if (!isLoading) {
      // Scheduled rather than called synchronously in the effect body, per
      // this codebase's react-hooks/set-state-in-effect rule.
      const reset = setTimeout(() => setLoadingTooLong(false), 0)
      return () => clearTimeout(reset)
    }
    const timer = setTimeout(() => setLoadingTooLong(true), 10000)
    return () => clearTimeout(timer)
  }, [isLoading])

  const fetchedActions: IAction[] = data?.data || []
  const actions: IAction[] = openStatusFilter
    ? fetchedActions.filter(
        (a) => a.status === "TO_DO" || a.status === "IN_PROGRESS"
      )
    : fetchedActions
  const meta = data?.meta
  const totalPages = openStatusFilter ? 1 : meta?.totalPage || 0

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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-muted-foreground">
            {t("organization.findings.loadingFindings")}
          </p>
          {loadingTooLong && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                {t("organization.findings.loadingTakingTooLong")}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-2 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {t("organization.findings.retryLoad")}
              </button>
            </div>
          )}
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
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
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
              type="button"
              onClick={() => setModalState({ open: true, editData: null })}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus size={18} /> {t("organization.findings.createTitle")}
            </button>
          )}
        </div>
        {openStatusFilter && (
          <FilteredByNotice
            className="mt-2"
            label={t("organization.findings.filteredByOpenStatus")}
            clearLabel={t("organization.findings.clearStatusFilter")}
            clearHref="/organization/findings"
          />
        )}
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
                type="button"
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
                        type="button"
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
                          type="button"
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
                          type="button"
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
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
                  {findingsError ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12">
                        {/* quality-bar-loop round 17 (mobile): `text-center`
                            centered this message against the table's full
                            scrollable width (widest among the KPI
                            drill-down destinations), not the visible
                            viewport -- since the centered position is
                            computed from that full width, it sat off-screen
                            at mobile widths even before any scrolling
                            happened (`position: sticky` alone doesn't fix
                            this -- it only clamps a scroll-triggered
                            excursion, not an already off-center static
                            position). Left-aligning keeps it anchored near
                            the cell's own padding, always visible at
                            scrollLeft: 0 regardless of the table's width.
                            (The empty-state row below has the same root
                            cause but stays centered via `sticky inset-x-0`
                            instead -- that row's multi-element "icon +
                            heading + paragraph" illustration reads as
                            broken left-aligned, unlike this single line.) */}
                        <span role="alert" className="text-muted-foreground">
                          {t("organization.findings.loadError")}
                        </span>
                      </td>
                    </tr>
                  ) : actions.length > 0 ? (
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
                            {action?.site ? (
                              // aexa-frontend#562: action.site.id was
                              // already available but rendered as plain
                              // text -- reuses the established
                              // ?siteId=&search= pattern (#533/#552). Row
                              // itself navigates on click, so this needs
                              // stopPropagation like the Edit/Delete
                              // buttons in the same row already do.
                              <Link
                                to={`/organization/sites?siteId=${encodeURIComponent(action.site.id)}&search=${encodeURIComponent(action.site.name)}`}
                                onClick={(e) => e.stopPropagation()}
                                className="focus-ring text-sm text-primary hover:underline"
                              >
                                {action.site.name}
                              </Link>
                            ) : (
                              <span className="text-sm text-foreground">
                                {t("organization.findings.notAvailable")}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[action.status] ?? NEUTRAL_BADGE}`}
                          >
                            {STATUS_KEYS[action.status]
                              ? t(STATUS_KEYS[action.status])
                              : action.status}
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_BADGES[action.priority] ?? NEUTRAL_BADGE}`}
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
                      <td colSpan={7} className="px-4 py-12">
                        {/* quality-bar-loop round 17 (mobile, review-loop
                            round 1): same off-screen-at-mobile-width bug
                            just fixed on the error row above -- `text-center`
                            centered this block against the table's full
                            scrollable width instead of the visible
                            viewport. `sticky inset-x-0` (left:0 + right:0)
                            clamps the box to the currently-visible portion
                            of the scroll container regardless of the row's
                            own width, so centering it inside that box
                            centers it on-screen instead. */}
                        <div className="sticky inset-x-0 mx-auto flex w-fit flex-col items-center text-center">
                          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
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
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            prevAriaLabel={t("organization.findings.prevPage")}
            nextAriaLabel={t("organization.findings.nextPage")}
            className="mt-6"
          />
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
