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
import type { TInspection } from "@/types/organization"

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
import { useNavigate } from "react-router"
import { toast } from "sonner"
import StartInspectionModal from "./StartInspectionModal"

const InspectionTable = () => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
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
    searchTerm,
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
  const meta = data?.meta || {}
  const totalPages = meta.totalPage || 1

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

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
        toast.success("Inspection deleted successfully")
        setDeleteModalOpen(false)
        setDeletedInspectionId("")
      }
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete inspection")
    }
  }

  return (
    <div className="bg-background p-4 md:p-6">
      <div className="mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Inspections</h1>
            <p className="text-muted-foreground">Manage all your inspections</p>
          </div>

          <Button onClick={() => setOpen(true)} className="">
            <Plus className="mr-2 h-4 w-4" />
            Start New
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col justify-end gap-4 md:flex-row">
          <div className="relative max-w-md flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search inspections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
              <SelectItem value="COMPLETED">COMPLETED</SelectItem>
              <SelectItem value="CANCELLED">CANCELLED</SelectItem>
              <SelectItem value="DRAFT">DRAFT</SelectItem>
            </SelectContent>
          </Select>

          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="ALL">All Sites</SelectItem>
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
                <TableHead>Inspection</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Author</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Loading inspections...
                  </TableCell>
                </TableRow>
              ) : inspections.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No inspections found
                  </TableCell>
                </TableRow>
              ) : (
                inspections.map((item: TInspection) => (
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
                    <TableCell>{item?.inspector?.fullName || "Org"}</TableCell>
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
              Page {currentPage} of {totalPages}
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
        title="Delete Inspection?"
        description="This will permanently remove the inspection and all its notes, actions."
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export default InspectionTable
