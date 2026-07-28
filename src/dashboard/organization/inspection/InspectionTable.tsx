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
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import StartInspectionModal from "./StartInspectionModal"

const InspectionTable = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
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
            <h1 className="text-3xl font-bold text-foreground">
              {t("organization.inspection.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("organization.inspection.subtitle")}
            </p>
          </div>

          <Button onClick={() => setOpen(true)} className="">
            <Plus className="mr-2 h-4 w-4" />
            {t("organization.inspection.startNew")}
          </Button>
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
                inspections.map((item: InspectionSummary) => (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell>{item.template?.templateName || "—"}</TableCell>
                    <TableCell>{item.site?.name || "—"}</TableCell>
                    <TableCell>
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs ${
                          item.status === "COMPLETED"
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400"
                            : item.status === "IN_PROGRESS"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-400"
                              : item.status === "CANCELLED"
                                ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400"
                                : item.status === "DRAFT"
                                  ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-400"
                        }`}
                      >
                        {item.status}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item.id)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteConfirmModal(item.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("organization.inspection.pageOf", {
                current: currentPage,
                total: totalPages,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
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
