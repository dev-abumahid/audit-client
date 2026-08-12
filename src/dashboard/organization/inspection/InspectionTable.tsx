/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useDeleteInspectionMutation,
  useGetAllInspectionQuery,
} from "@/redux/apis/organization/inspection.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import type { InspectionSummary } from "@/types/inspection"

import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import FilteredByNotice from "@/components/shared/FilteredByNotice"
import Pagination from "@/components/shared/Pagination"
import { useClampPageToTotal } from "@/hooks/useClampPageToTotal"
import { useMyAssignedInspectionIds } from "@/hooks/useMyAssignments"
import { useMyOrgRole } from "@/hooks/useMyOrgRole"
import { canWriteInspection } from "@/utils/assignmentScope"
import { formatLocaleDate } from "@/utils/formatDate"
import {
  getInspectionStatusLabel,
  getInspectionStatusSeverity,
} from "@/utils/inspectionStatus"
import { severityBadgeClasses } from "@/utils/severityStyles"
import { Edit2, Eye, Plus, Search, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useSearchParams } from "react-router"
import { toast } from "sonner"
import StartInspectionModal from "./StartInspectionModal"

const InspectionTable = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  // aexa-frontend#242 -- Inspection had zero role gating, unlike every
  // sibling entity (Audit/Templates/Reports/Risk/Sites/Findings/KRI/
  // Compliance), which are already gated via useMyOrgRole()/
  // canWriteOrgResource(role) per #217 (extended in #226/#227/#239). A
  // VIEWER/LIGHT_USER saw the same Start New/Edit/Delete affordances as an
  // ADMIN and only found out they couldn't act via a 403 toast.
  const role = useMyOrgRole()
  // aexa-frontend#276: create_inspection_into_db is ADMIN-only server-side
  // (inspection creation has no InspectionAssignment to scope a LEAD_AUDITOR
  // "within" -- see inspection.service.ts's create_inspection_into_db
  // comment), so the page-level "Start New" affordance is gated on the exact
  // role rather than the broader canWrite (ADMIN||LEAD_AUDITOR) used
  // elsewhere on this page. A LEAD_AUDITOR was previously shown a button
  // that always 403'd. Per-row Edit/Delete stay on canWriteInspection below,
  // which narrows further for LEAD_AUDITOR using the caller's real
  // assignment state; `undefined` (still loading / fetch failed) degrades
  // canWriteInspection back to the same role-only behavior as before #270.
  const canCreateInspection = role === "ADMIN"
  // quality-bar-loop (Inspections, round 50, efficiency finding): role is
  // already resolved above, so pass it through to skip the assignments
  // fetch entirely once it's known to be a role that can never have any
  // (VIEWER/LIGHT_USER) -- see useMyAssignedInspectionIds's own comment.
  const assignedInspectionIds = useMyAssignedInspectionIds(role)
  const [searchParams] = useSearchParams()
  // quality-bar-loop round 14 (industry-standards): the dashboard's
  // "Active Inspections" KPI card used to be a static, non-clickable
  // number -- it now links here with ?status=active, meaning DRAFT or
  // IN_PROGRESS (the same two statuses Overview.tsx's own KPI count
  // already uses). The status dropdown/API below only support one exact
  // status value at a time, with no combined option, so a naive
  // `status=active` pass-through to the backend wouldn't work. Instead,
  // while this filter is active, fetch every status (limit:100, matching
  // the same convention AllFindingsPage.tsx uses for its own equivalent
  // ?status=open link) and filter that whole window client-side, with
  // pagination hidden -- consistent with how the KPI number being linked
  // to was computed in the first place.
  const activeStatusFilter = searchParams.get("status") === "active"
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [siteFilter, setSiteFilter] = useState("ALL")
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletedInspectionId, setDeletedInspectionId] = useState<string>("")
  // quality-bar-loop (Inspections, round 23, industry-standards finding):
  // this table had no bulk actions at all -- every reference tool in this
  // category (GoCanvas, Device Magic) supports multi-record bulk delete
  // from the list view. Selection is scoped to the current page's rows
  // (cleared on page/filter change below) rather than persisted across
  // pages, matching this table's own existing per-page pagination model.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const limit = 10

  // API Calls
  // quality-bar-loop round 16 (resilience regression): this query never
  // checked isError -- a genuine fetch failure fell through to `data?.data
  // || []`, rendering the same empty-table state as "no inspections match
  // this filter," surfaced by round 14's dashboard link making an
  // empty-looking result more reachable.
  const {
    data,
    isLoading,
    isError: inspectionsError,
    refetch: refetchInspections,
  } = useGetAllInspectionQuery({
    page: activeStatusFilter ? 1 : currentPage,
    limit: activeStatusFilter ? 100 : limit,
    searchTerm: debouncedSearchTerm,
    status: activeStatusFilter
      ? ""
      : statusFilter === "ALL"
        ? ""
        : statusFilter,
    siteId: siteFilter === "ALL" ? "" : siteFilter,
  })
  const { data: sitesData } = useGetAllSitesQuery({
    page: 1,
    limit: 1000,
    searchTerm: "",
  })
  const [deleteInspection, { isLoading: isInspectionDeleting }] =
    useDeleteInspectionMutation()

  const fetchedInspections = data?.data || []
  const inspections = activeStatusFilter
    ? fetchedInspections.filter(
        (i: InspectionSummary) =>
          i.status === "DRAFT" || i.status === "IN_PROGRESS"
      )
    : fetchedInspections
  const meta = data?.meta
  const totalPages = activeStatusFilter ? 1 : meta?.totalPage || 1

  // aexa-frontend#265: deleting the last inspection on the last page shrinks
  // totalPages without touching any filter, stranding currentPage out of
  // range (empty list, pagination hidden since it's gated on totalPages > 1)
  // -- the delete-path counterpart to #234/#243 below. Deliberately clamps
  // against meta?.totalPage directly (not the `|| 1` fallback above): that
  // fallback exists only so the "page X / totalPages" label and the
  // totalPages > 1 gate have a sane value while `meta` is momentarily
  // undefined during a loading/refetching query, and treating that
  // placeholder 1 as real here would clamp the user back to page 1 mid
  // navigation any time a page change causes a brief loading state.
  useClampPageToTotal(currentPage, meta?.totalPage ?? 0, setCurrentPage)

  // aexa-frontend#243: searchTerm was passed straight into
  // useGetAllInspectionQuery on every keystroke while this effect only
  // debounced the page-1 reset, not the query value itself. On a deep page
  // with an active filter, typing a character fired e.g. {page: 3,
  // searchTerm: "x"} against the new filtered set before the reset landed --
  // an out-of-range page producing the same false empty state (pagination
  // hidden) that #234 fixed for the status/site filters. Unlike those
  // Select-driven filters, a text input can't reset the page synchronously
  // on every change (that would defeat the point of debouncing), so both the
  // query value and the page reset are now committed together, after the
  // delay, from a single effect -- the query never sees a fresh searchTerm
  // paired with a stale page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setCurrentPage(1)
      setSelectedIds(new Set())
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // aexa-frontend#234: statusFilter/siteFilter feed the same paginated
  // query as searchTerm but never reset currentPage, unlike every sibling
  // list page (AllFindingsPage/CompliancePage/SitesEntities/AuditPage all
  // reset to page 1 on every filter change). A user paged deep into one
  // filtered set, then applying a NEW filter with fewer total pages, landed
  // on an out-of-range page -- an empty "no inspections found" state with
  // the pagination controls also hidden (they're gated on totalPages > 1),
  // leaving no way back to page 1 short of clearing the filter or
  // reloading. Set directly in the handler (matching AllFindingsPage's
  // handleSiteFilter convention) rather than a useEffect, since a
  // synchronous setState inside an effect risks a cascading-render lint
  // error.
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value)
    setCurrentPage(1)
    setSelectedIds(new Set())
  }

  const handleSiteFilterChange = (value: string) => {
    setSiteFilter(value)
    setCurrentPage(1)
    setSelectedIds(new Set())
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setSelectedIds(new Set())
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = (selectableIds: string[]) => {
    setSelectedIds((prev) => {
      const allSelected =
        selectableIds.length > 0 &&
        selectableIds.every((id) => prev.has(id))
      return allSelected ? new Set() : new Set(selectableIds)
    })
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || isBulkDeleting) return

    setIsBulkDeleting(true)
    const ids = [...selectedIds]
    try {
      const results = await Promise.allSettled(
        ids.map((id) => deleteInspection(id).unwrap())
      )
      // Review finding on PR #697: aligns with handleConfirmDelete's own
      // success check (`res?.success`) above rather than treating any
      // resolved promise as a success -- both paths now agree on what
      // "succeeded" means.
      const succeededCount = results.filter(
        (r) => r.status === "fulfilled" && (r.value as any)?.success
      ).length
      const failedCount = ids.length - succeededCount

      if (succeededCount > 0) {
        toast.success(
          t("organization.inspection.bulkDeleteSuccessToast", {
            count: succeededCount,
          })
        )
      }
      if (failedCount > 0) {
        toast.error(
          t("organization.inspection.bulkDeleteFailedToast", {
            count: failedCount,
          })
        )
      }
      setSelectedIds(new Set())
      setBulkDeleteModalOpen(false)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleViewReport = (inspectionId: string) => {
    navigate(`/organization/audit/inspections/report/${inspectionId}`)
  }

  const handleEdit = (inspectionId: string) => {
    navigate(`/organization/audit/inspection/update/${inspectionId}`)
  }

  const handleDeleteConfirmModal = (id: string) => {
    setDeleteModalOpen(true)
    setDeletedInspectionId(id)
  }

  const handleConfirmDelete = async () => {
    // Same discarded-isLoading double-submission bug fixed for
    // RiskRegisterPage/aexa-frontend#620 -- the disabled button prop is the
    // primary guard, but a defensive check inside the handler closes the
    // theoretical window where a second call could land before a re-render
    // commits the disabled state.
    if (!deletedInspectionId || isInspectionDeleting) return

    try {
      const res = await deleteInspection(deletedInspectionId).unwrap()
      if (res?.success) {
        toast.success(t("organization.inspection.deleteSuccessToast"))
        setDeleteModalOpen(false)
        setDeletedInspectionId("")
      }
    } catch (err: any) {
      toast.error(
        err?.data?.message || t("organization.inspection.deleteFailedToast")
      )
    }
  }

  // Only rows the caller can actually delete are selectable -- mirrors the
  // per-row canWriteInspection gate already applied to the Edit/Delete
  // buttons below.
  const selectableIds = inspections
    .filter((item: InspectionSummary) =>
      canWriteInspection(role, item.id, assignedInspectionIds)
    )
    .map((item: InspectionSummary) => item.id)

  return (
    <div className="bg-background p-4 md:p-6">
      <div className="mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {t("organization.inspection.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("organization.inspection.subtitle")}
            </p>
          </div>

          {canCreateInspection && (
            // quality-bar-loop round 2 (mobile, round-1 finding): the
            // shared Button component's default size (h-7) is well under
            // the 44px touch-target guideline, same bug class fixed on
            // 9+ pages this session.
            <Button onClick={() => setOpen(true)} className="h-11">
              <Plus className="mr-2 h-4 w-4" />
              {t("organization.inspection.startNew")}
            </Button>
          )}
        </div>

        {activeStatusFilter && (
          <FilteredByNotice
            id="active-status-filter-notice"
            className="mb-4"
            label={t("organization.inspection.filteredByActiveStatus")}
            clearLabel={t("organization.inspection.clearStatusFilter")}
            clearHref="/organization/audit/inspections"
          />
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-col justify-end gap-4 md:flex-row">
          <div className="relative max-w-md flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("organization.inspection.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 pl-10"
            />
          </div>

          {/* Round-1 review of quality-bar-loop round 14: while
              ?status=active is applied, the query's own status is
              force-overridden below regardless of this dropdown's value --
              leaving it enabled let a user pick e.g. "Completed" and see
              the selection change with zero effect on the (still
              DRAFT/IN_PROGRESS-only) results, a silent no-op. Disabled
              while the URL filter is active; the clear-filter link above
              is the way back to normal filtering. Round-2 review: a
              disabled control with no stated reason is its own
              discoverability gap for a keyboard/screen-reader user who
              tabs to it without having already read the notice above --
              aria-describedby ties the two together. */}
          <Select
            value={statusFilter}
            onValueChange={handleStatusFilterChange}
            disabled={activeStatusFilter}
          >
            {/* `!h-11`, not a plain `h-11`: SelectTrigger's own height
                comes from a data-attribute-scoped utility
                (`data-[size=default]:h-7`), which tailwind-merge doesn't
                reliably dedupe against a plain `h-11` override the way
                it does for a cva size variant's un-scoped classes (the
                Button/Input override pattern used everywhere else this
                session) -- confirmed live-broken (still 28px) before
                switching to `!h-11`, which forces the override
                regardless of generated-CSS ordering. */}
            <SelectTrigger
              className="!h-11 w-full md:w-48"
              aria-describedby={
                activeStatusFilter ? "active-status-filter-notice" : undefined
              }
            >
              <SelectValue placeholder={t("organization.inspection.statusAll")} />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="ALL">
                {t("organization.inspection.statusAll")}
              </SelectItem>
              <SelectItem value="IN_PROGRESS">
                {t("organization.inspection.statusInProgress")}
              </SelectItem>
              <SelectItem value="COMPLETED">
                {t("organization.inspection.statusCompleted")}
              </SelectItem>
              <SelectItem value="CANCELLED">
                {t("organization.inspection.statusCancelled")}
              </SelectItem>
              <SelectItem value="DRAFT">
                {t("organization.inspection.statusDraft")}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={siteFilter} onValueChange={handleSiteFilterChange}>
            {/* `!h-11` -- see the comment on the status SelectTrigger
                above for why a plain `h-11` doesn't reliably override
                this component's own data-attribute-scoped height. */}
            <SelectTrigger className="!h-11 w-full md:w-48">
              <SelectValue placeholder={t("organization.inspection.allSites")} />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="ALL">
                {t("organization.inspection.allSites")}
              </SelectItem>
              {sitesData?.data.map((site: any) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* quality-bar-loop (Inspections, round 23, industry-standards
            finding): this table had no bulk actions at all, unlike every
            reference tool in this category. Only shown once at least one
            row is selected, matching the established convention of
            keeping a list view's default toolbar uncluttered. */}
        {selectedIds.size > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-2.5">
            <span className="text-sm font-medium">
              {t("organization.inspection.selectedCount", {
                count: selectedIds.size,
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-11"
                onClick={() => setSelectedIds(new Set())}
              >
                {t("organization.inspection.clearSelection")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-11"
                onClick={() => setBulkDeleteModalOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("organization.inspection.deleteSelected")}
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-11">
                  {/* quality-bar-loop round 2 (mobile, round-1 finding)
                      pattern reused here: the native checkbox's visual
                      box is well under 44px, so a wrapping element with
                      min-h-11/min-w-11 (not a className on the input
                      itself) gives the real clickable area, same fix as
                      every answer-form checkbox elsewhere in this
                      feature. */}
                  <span className="flex min-h-11 min-w-11 items-center justify-center">
                    <input
                      type="checkbox"
                      aria-label={t("organization.inspection.selectAll")}
                      checked={
                        selectableIds.length > 0 &&
                        selectableIds.every((id) => selectedIds.has(id))
                      }
                      onChange={() => toggleSelectAll(selectableIds)}
                      className="h-4 w-4 accent-primary"
                    />
                  </span>
                </TableHead>
                <TableHead>
                  {t("organization.inspection.colInspection")}
                </TableHead>
                <TableHead>{t("organization.inspection.colSite")}</TableHead>
                <TableHead>{t("organization.inspection.colUpdated")}</TableHead>
                <TableHead>{t("organization.inspection.colStatus")}</TableHead>
                <TableHead>{t("organization.inspection.colAuthor")}</TableHead>
                <TableHead className="text-right">
                  {t("organization.inspection.colActions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    {t("organization.inspection.loading")}
                  </TableCell>
                </TableRow>
              ) : inspectionsError ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    {/* quality-bar-loop (Inspections, round 54, UX
                        finding): unlike InspectionReport.tsx's equivalent
                        error state (a real "Back to Inspections" button),
                        this was static text with zero recovery affordance
                        -- and unlike the detail page, "go back to the
                        list" isn't a meaningful escape hatch here, since
                        this IS the list. A retry (re-run the same query)
                        is the actual useful action for a transient
                        failure. */}
                    <div className="flex flex-col items-center gap-2">
                      <span role="alert" className="text-muted-foreground">
                        {t("organization.inspection.listLoadError")}
                      </span>
                      {/* quality-bar-loop (Inspections, round 56, visual-
                          polish/mobile finding): round 54's `size="sm"`
                          resolved to h-6 (24px) -- every other actionable
                          control on this page (Start New, bulk-toolbar
                          buttons, row actions) uses an explicit h-11 (44px)
                          override, a convention this loop established back
                          in round 2. `size="sm"` still gives the right
                          padding/text-size for a secondary action; only the
                          height needed the same override as its neighbors. */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-11"
                        onClick={() => refetchInspections()}
                      >
                        {t("organization.inspection.retryLoadInspections")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : inspections.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t("organization.inspection.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                inspections.map((item: InspectionSummary) => {
                  const canWriteThisInspection = canWriteInspection(
                    role,
                    item.id,
                    assignedInspectionIds
                  )
                  return (
                  <TableRow key={item.id} className="animate-fade-in hover:bg-muted/50">
                    <TableCell>
                      {canWriteThisInspection && (
                        <span className="flex min-h-11 min-w-11 items-center justify-center">
                          <input
                            type="checkbox"
                            aria-label={t("organization.inspection.selectRowLabel", {
                              name:
                                item.template?.templateName ||
                                t("organization.inspection.orgFallback"),
                            })}
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelected(item.id)}
                            className="h-4 w-4 accent-primary"
                          />
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {/* aexa-frontend#564: item.template.id was already
                          available but rendered as plain text -- same
                          route TemplatesPage.tsx already links to. */}
                      {item.template ? (
                        <Link
                          to={`/organization/audit/template/report/${item.template.id}`}
                          className="focus-ring text-primary hover:underline"
                        >
                          {item.template.templateName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {/* aexa-frontend#563: item.site.id was already
                          available but rendered as plain text -- reuses
                          the established ?siteId=&search= pattern
                          (#533/#552). */}
                      {item.site ? (
                        <Link
                          to={`/organization/sites?siteId=${encodeURIComponent(item.site.id)}&search=${encodeURIComponent(item.site.name)}`}
                          className="focus-ring text-primary hover:underline"
                        >
                          {item.site.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {formatLocaleDate(item.updatedAt, i18n.language)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs ${severityBadgeClasses(
                          getInspectionStatusSeverity(item.status)
                        )}`}
                      >
                        {getInspectionStatusLabel(t, item.status)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item?.inspector?.fullName ||
                        t("organization.inspection.orgFallback")}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* quality-bar-loop round 2 (mobile + accessibility,
                          round-1 findings): `size="sm"` resolves to `h-6`
                          (24px tall), well under the 44px touch-target
                          guideline -- same bug class fixed on 9+ pages
                          this session. These icon-only buttons also had
                          zero accessible name (confirmed live: ariaLabel
                          null, empty text) -- a screen reader announced
                          only "button, button, button" with no way to
                          tell view/edit/delete apart. */}
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewReport(item.id)}
                          aria-label={t("organization.inspection.viewButtonLabel", {
                            name:
                              item.template?.templateName ||
                              t("organization.inspection.orgFallback"),
                          })}
                          className="h-11 w-11"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canWriteThisInspection && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(item.id)}
                            aria-label={t("organization.inspection.editButtonLabel", {
                              name:
                                item.template?.templateName ||
                                t("organization.inspection.orgFallback"),
                            })}
                            className="h-11 w-11"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        {canWriteThisInspection && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteConfirmModal(item.id)}
                            aria-label={t("organization.inspection.deleteButtonLabel", {
                              name:
                                item.template?.templateName ||
                                t("organization.inspection.orgFallback"),
                            })}
                            className="h-11 w-11 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <Pagination
          page={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          label={t("organization.inspection.pageOf", {
            current: currentPage,
            total: totalPages,
          })}
          prevAriaLabel={t("organization.inspection.prevPage")}
          nextAriaLabel={t("organization.inspection.nextPage")}
          className="mt-6"
        />
      </div>
      <StartInspectionModal open={open} setOpen={setOpen} />
      {/* -------- Delete Modal -------- */}
      <DeleteAlertModal
        open={deleteModalOpen}
        setOpen={setDeleteModalOpen}
        title={t("organization.inspection.deleteTitle")}
        description={t("organization.inspection.deleteDescription")}
        onConfirm={handleConfirmDelete}
        loading={isInspectionDeleting}
      />
      {/* -------- Bulk Delete Modal -------- */}
      <DeleteAlertModal
        open={bulkDeleteModalOpen}
        setOpen={setBulkDeleteModalOpen}
        title={t("organization.inspection.bulkDeleteTitle")}
        description={t("organization.inspection.bulkDeleteDescription", {
          count: selectedIds.size,
        })}
        onConfirm={handleBulkDelete}
        loading={isBulkDeleting}
      />
    </div>
  )
}

export default InspectionTable
