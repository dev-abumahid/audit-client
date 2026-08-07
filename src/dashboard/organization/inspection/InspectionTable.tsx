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
import Pagination from "@/components/shared/Pagination"
import { useClampPageToTotal } from "@/hooks/useClampPageToTotal"
import { useMyAssignedInspectionIds } from "@/hooks/useMyAssignments"
import { useMyOrgRole } from "@/hooks/useMyOrgRole"
import { canWriteInspection } from "@/utils/assignmentScope"
import { formatLocaleDate } from "@/utils/formatDate"
import { getInspectionStatusLabel } from "@/utils/inspectionStatus"
import { severityBadgeClasses } from "@/utils/severityStyles"
import { Edit2, Eye, Plus, Search, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"
import StartInspectionModal from "./StartInspectionModal"

// Round-4 final-review finding: this table hand-rolled its own green/amber/
// red/gray/blue status ladder even though severityStyles.ts's header
// comment explicitly lists InspectionTable as one of the maps it replaces.
const STATUS_BADGE: Record<string, string> = {
  COMPLETED: severityBadgeClasses("low"),
  IN_PROGRESS: severityBadgeClasses("medium"),
  CANCELLED: severityBadgeClasses("critical"),
  DRAFT: severityBadgeClasses("neutral"),
}

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
  const assignedInspectionIds = useMyAssignedInspectionIds()
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [siteFilter, setSiteFilter] = useState("ALL")
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletedInspectionId, setDeletedInspectionId] = useState<string>("")
  const limit = 10

  // API Calls
  const { data, isLoading } = useGetAllInspectionQuery({
    page: currentPage,
    limit,
    searchTerm: debouncedSearchTerm,
    status: statusFilter === "ALL" ? "" : statusFilter,
    siteId: siteFilter === "ALL" ? "" : siteFilter,
  })
  const { data: sitesData } = useGetAllSitesQuery({
    page: 1,
    limit: 1000,
    searchTerm: "",
  })
  const [deleteInspection] = useDeleteInspectionMutation()

  const inspections = data?.data || []
  const meta = data?.meta
  const totalPages = meta?.totalPage || 1

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
  }

  const handleSiteFilterChange = (value: string) => {
    setSiteFilter(value)
    setCurrentPage(1)
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
    if (!deletedInspectionId) return

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
            <Button onClick={() => setOpen(true)} className="">
              <Plus className="mr-2 h-4 w-4" />
              {t("organization.inspection.startNew")}
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col justify-end gap-4 md:flex-row">
          <div className="relative max-w-md flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("organization.inspection.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-full md:w-48">
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
            <SelectTrigger className="w-full md:w-48">
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

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={6} className="h-24 text-center">
                    {t("organization.inspection.loading")}
                  </TableCell>
                </TableRow>
              ) : inspections.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
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
                        className={`inline-block rounded-full px-3 py-1 text-xs ${
                          STATUS_BADGE[item.status] ||
                          severityBadgeClasses("info")
                        }`}
                      >
                        {getInspectionStatusLabel(t, item.status)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item?.inspector?.fullName ||
                        t("organization.inspection.orgFallback")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewReport(item.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canWriteThisInspection && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(item.id)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        {canWriteThisInspection && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteConfirmModal(item.id)}
                            className="text-destructive hover:text-destructive"
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
          onPageChange={setCurrentPage}
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
      />
    </div>
  )
}

export default InspectionTable
