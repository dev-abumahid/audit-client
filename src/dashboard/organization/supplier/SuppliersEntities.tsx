import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Pencil, Plus, Sparkles, Trash2, Truck } from "lucide-react"
import { toast } from "sonner"
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import Pagination from "@/components/shared/Pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useClampPageToTotal } from "@/hooks/useClampPageToTotal"
import { useDebouncedValue } from "@/hooks/Usedebouncedvalue"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import type { SupplierSortableField } from "@/redux/apis/organization/supplier.api"
import {
  useBulkDeleteSuppliersMutation,
  useBulkUpdateSupplierStatusMutation,
  useCreateNewSupplierMutation,
  useDeleteSupplierMutation,
  useGetAllSuppliersQuery,
  useUpdateSupplierMutation,
} from "@/redux/apis/organization/supplier.api"
import type { SupplierRiskTier, SupplierStatus } from "@/types/organization"
import SupplierDiscoveryPanel from "./SupplierDiscoveryPanel"
import SupplierFormModal, { type SupplierFormState } from "./SupplierFormModal"

const PAGE_SIZE = 20

const EMPTY_FORM: SupplierFormState = {
  id: "",
  name: "",
  country: "",
  notes: "",
  risk_tier: "",
  next_review_date: "",
  primary_contact_name: "",
  primary_contact_email: "",
  contract_status: "",
  status: "ACTIVE",
}

// Badge coloring mirrors the risk-tier severity mapping used across the
// app (Badge's low/medium/high variants ARE SEVERITY_STYLES, so this can
// never drift out of sync with how risk severity reads anywhere else --
// cross-view-integration axis).
const RISK_TIER_BADGE_VARIANT: Record<SupplierRiskTier, "low" | "medium" | "high"> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
}

const STATUS_BADGE_VARIANT: Record<
  SupplierStatus,
  "success" | "medium" | "secondary"
> = {
  ACTIVE: "success",
  UNDER_REVIEW: "medium",
  INACTIVE: "secondary",
}

const STATUS_LABEL_KEY: Record<SupplierStatus, string> = {
  ACTIVE: "organization.suppliers.statusActive",
  UNDER_REVIEW: "organization.suppliers.statusUnderReview",
  INACTIVE: "organization.suppliers.statusInactive",
}

const RISK_TIER_LABEL_KEY: Record<SupplierRiskTier, string> = {
  LOW: "organization.suppliers.riskLow",
  MEDIUM: "organization.suppliers.riskMedium",
  HIGH: "organization.suppliers.riskHigh",
}

// Suppliers is an optional org-scoped input alongside Sites -- adding
// suppliers, manually or via the AI-discovery panel below, gives the
// risk-anchoring pipeline more real-world data to screen against (e.g.
// France's business registry for supply-chain continuity risk), so it's
// deliberately not required for onboarding to proceed. See supplier
// .service.ts's discover_suppliers_for_org comment and aexa-ai#227 for the
// grounding guarantees behind the AI-discovered candidates.
export default function SuppliersEntities() {
  const { t } = useTranslation()
  const role = useMyOrgRole()
  const canWrite = canWriteOrgResource(role)

  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<"" | SupplierStatus>("")
  const [riskTierFilter, setRiskTierFilter] = useState<"" | SupplierRiskTier>("")
  const [sortBy, setSortBy] = useState<SupplierSortableField>("createdAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const debouncedSearch = useDebouncedValue(search, 300)
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, riskTierFilter, sortBy, sortOrder])

  const { data, isLoading, error } = useGetAllSuppliersQuery({
    page,
    limit: PAGE_SIZE,
    searchTerm: debouncedSearch,
    status: statusFilter || undefined,
    risk_tier: riskTierFilter || undefined,
    sortBy,
    sortOrder,
  })
  const suppliers = data?.data ?? []
  const totalPages = data?.meta?.totalPage ?? 1
  useClampPageToTotal(page, totalPages, setPage)

  const [createNewSupplier, { isLoading: isCreating }] =
    useCreateNewSupplierMutation()
  const [updateSupplier, { isLoading: isUpdating }] = useUpdateSupplierMutation()
  const [deleteSupplier, { isLoading: isDeleting }] = useDeleteSupplierMutation()
  const [bulkUpdateStatus, { isLoading: isBulkUpdating }] =
    useBulkUpdateSupplierStatusMutation()
  const [bulkDeleteSuppliers, { isLoading: isBulkDeleting }] =
    useBulkDeleteSuppliersMutation()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  // Selection is scoped to the current page only, same rationale as
  // RiskRegisterPage.tsx's own bulk-select: bulk-delete is a real, one-shot
  // destructive API call, not something that needs a cross-page "select all
  // matching filters" affordance.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    setSelectedIds(new Set())
  }, [page, debouncedSearch, statusFilter, riskTierFilter, sortBy, sortOrder])
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const allVisibleSelected =
    suppliers.length > 0 && suppliers.every((s) => selectedIds.has(s.id))
  const someVisibleSelected = suppliers.some((s) => selectedIds.has(s.id))
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        suppliers.forEach((s) => next.delete(s.id))
        return next
      }
      const next = new Set(prev)
      suppliers.forEach((s) => next.add(s.id))
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())

  const confirmBulkStatusChange = async (newStatus: string) => {
    // Review finding (PR #1087): the disabled prop on the toolbar's
    // <select> covers the common case, but only commits after a render --
    // this in-function isBulkUpdating check closes the same theoretical
    // double-fire window RiskRegisterPage's own bulk-status handler
    // (useRiskBulkActions.ts) already guards against.
    if (isBulkUpdating || !newStatus || selectedIds.size === 0) return
    try {
      const res = await bulkUpdateStatus({
        supplierIds: Array.from(selectedIds),
        status: newStatus as SupplierStatus,
      }).unwrap()
      toast.success(
        t(
          res.data.skipped > 0
            ? "organization.suppliers.bulkStatusPartial"
            : "organization.suppliers.bulkStatusSuccess",
          { updated: res.data.updated, skipped: res.data.skipped }
        )
      )
      clearSelection()
    } catch {
      toast.error(t("organization.suppliers.bulkStatusFailed"))
    }
  }

  const confirmBulkDelete = async () => {
    if (isBulkDeleting || selectedIds.size === 0) return
    try {
      const res = await bulkDeleteSuppliers(Array.from(selectedIds)).unwrap()
      toast.success(
        t(
          res.data.skipped > 0
            ? "organization.suppliers.bulkDeletePartial"
            : "organization.suppliers.bulkDeleteSuccess",
          { updated: res.data.updated, skipped: res.data.skipped }
        )
      )
      clearSelection()
    } catch {
      toast.error(t("organization.suppliers.bulkDeleteFailed"))
    } finally {
      setIsBulkDeleteModalOpen(false)
    }
  }

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (id: string) => {
    const supplier = suppliers.find((s) => s.id === id)
    if (!supplier) return
    setForm({
      id: supplier.id,
      name: supplier.name,
      country: supplier.country ?? "",
      notes: supplier.notes ?? "",
      risk_tier: supplier.risk_tier ?? "",
      next_review_date: supplier.next_review_date?.slice(0, 10) ?? "",
      primary_contact_name: supplier.primary_contact_name ?? "",
      primary_contact_email: supplier.primary_contact_email ?? "",
      contract_status: supplier.contract_status ?? "",
      status: supplier.status,
    })
    setEditingId(id)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const saveSupplier = async () => {
    if (!form.name.trim()) return
    const payload = {
      name: form.name.trim(),
      country: form.country.trim() || undefined,
      notes: form.notes.trim() || undefined,
      risk_tier: form.risk_tier || undefined,
      next_review_date: form.next_review_date || undefined,
      primary_contact_name: form.primary_contact_name.trim() || undefined,
      primary_contact_email: form.primary_contact_email.trim() || undefined,
      contract_status: form.contract_status || undefined,
      status: form.status,
    }
    try {
      if (editingId) {
        await updateSupplier({ id: editingId, data: payload }).unwrap()
        toast.success(t("organization.suppliers.updateSuccess"))
      } else {
        await createNewSupplier(payload).unwrap()
        toast.success(t("organization.suppliers.createSuccess"))
      }
      closeForm()
    } catch (err: unknown) {
      // The backend rejects a duplicate name (case/whitespace-insensitive,
      // per org) with a 409 -- give that its own clear message instead of
      // the generic "failed" toast, since "try a different name" is
      // actionable in a way "something went wrong" isn't.
      const isDuplicate =
        typeof err === "object" && err !== null && "status" in err && err.status === 409
      toast.error(
        t(
          isDuplicate
            ? editingId
              ? "organization.suppliers.updateDuplicate"
              : "organization.suppliers.createDuplicate"
            : editingId
              ? "organization.suppliers.updateFailed"
              : "organization.suppliers.createFailed"
        )
      )
    }
  }

  const confirmDelete = async () => {
    if (!deleteTargetId) return
    try {
      await deleteSupplier(deleteTargetId).unwrap()
      toast.success(t("organization.suppliers.deleteSuccess"))
      // Same stale-selection gap RiskRegisterPage's own single-row delete
      // once had: deleting a row that's also bulk-selected must clear it
      // from selectedIds, or the toolbar's "N selected" count outlives it.
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(deleteTargetId)
        return next
      })
    } catch {
      toast.error(t("organization.suppliers.deleteFailed"))
    } finally {
      setDeleteTargetId(null)
    }
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Truck className="h-5 w-5" aria-hidden="true" />
            {t("organization.suppliers.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organization.suppliers.subtitle")}
          </p>
        </div>
        {canWrite && (
          <Button type="button" size="touch" onClick={openCreate}>
            <Plus aria-hidden="true" />
            {t("organization.suppliers.addSupplier")}
          </Button>
        )}
      </div>

      <SupplierDiscoveryPanel canWrite={canWrite} />

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
          {/* quality-bar-loop round 12 (cross-view integration, round-2
              finding): shared Input defaults to h-7, well under the 44px
              touch-target guideline, same bug class fixed on 9+ pages this
              session (e.g. TemplatesPage.tsx's own search input). `h-11`
              overrides the component default via tailwind-merge, same
              pattern used everywhere else. */}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("organization.suppliers.searchPlaceholder")}
            aria-label={t("organization.suppliers.searchPlaceholder")}
            className="h-11 w-full max-w-xs"
          />
          {/* Filter/sort controls grouped together and pushed to the far
              side of the row (rather than left-stacked next to search),
              so this bar doesn't read as unbalanced dead space at wider
              viewports. */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | SupplierStatus)}
              aria-label={t("organization.suppliers.statusFilterLabel")}
              className="h-11 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">{t("organization.suppliers.allStatuses")}</option>
              <option value="ACTIVE">{t("organization.suppliers.statusActive")}</option>
              <option value="UNDER_REVIEW">
                {t("organization.suppliers.statusUnderReview")}
              </option>
              <option value="INACTIVE">
                {t("organization.suppliers.statusInactive")}
              </option>
            </select>
            <select
              value={riskTierFilter}
              onChange={(e) =>
                setRiskTierFilter(e.target.value as "" | SupplierRiskTier)
              }
              aria-label={t("organization.suppliers.riskTierFilterLabel")}
              className="h-11 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">{t("organization.suppliers.allRiskTiers")}</option>
              <option value="LOW">{t("organization.suppliers.riskLow")}</option>
              <option value="MEDIUM">{t("organization.suppliers.riskMedium")}</option>
              <option value="HIGH">{t("organization.suppliers.riskHigh")}</option>
            </select>
            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split(":") as [
                  SupplierSortableField,
                  "asc" | "desc",
                ]
                setSortBy(field)
                setSortOrder(order)
              }}
              aria-label={t("organization.suppliers.sortLabel")}
              className="h-11 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="createdAt:desc">
                {t("organization.suppliers.sortNewest")}
              </option>
              <option value="name:asc">{t("organization.suppliers.sortNameAsc")}</option>
              <option value="risk_tier:desc">
                {t("organization.suppliers.sortRiskTierDesc")}
              </option>
              <option value="next_review_date:asc">
                {t("organization.suppliers.sortNextReviewDate")}
              </option>
            </select>
          </div>
        </div>

        {/* Bulk-action toolbar: only rendered once at least one row on the
            current page is selected, same pattern as RiskRegisterPage's own
            bulk toolbar (role="status"/aria-live so the appearance itself
            is announced, not just its contents). */}
        {canWrite && someVisibleSelected && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-3 py-2 text-xs"
          >
            <span className="font-medium">
              {t("organization.suppliers.selectedCount", {
                count: selectedIds.size,
              })}
            </span>
            <select
              value=""
              disabled={isBulkUpdating}
              onChange={(e) => confirmBulkStatusChange(e.target.value)}
              aria-label={t("organization.suppliers.bulkChangeStatusLabel")}
              className="h-11 rounded-lg border border-input bg-card px-2 text-xs disabled:opacity-50"
            >
              <option value="">
                {t("organization.suppliers.bulkChangeStatus")}
              </option>
              <option value="ACTIVE">
                {t("organization.suppliers.statusActive")}
              </option>
              <option value="UNDER_REVIEW">
                {t("organization.suppliers.statusUnderReview")}
              </option>
              <option value="INACTIVE">
                {t("organization.suppliers.statusInactive")}
              </option>
            </select>
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("organization.suppliers.bulkDeleteSelected")}
            </Button>
            <Button type="button" variant="ghost" size="touch" onClick={clearSelection}>
              {t("organization.suppliers.clearSelection")}
            </Button>
          </div>
        )}

        {/* Only worth its own row once there's more than one supplier to
            select -- with exactly one row, "select all" is redundant with
            that row's own checkbox, and rendering it anyway left a bar
            with nothing beside it (visual-polish finding). */}
        {canWrite && suppliers.length > 1 && (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <label className="relative -m-2 flex h-8 w-8 cursor-pointer items-center justify-center">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected
                }}
                onChange={toggleSelectAll}
                aria-label={t("organization.suppliers.selectAllLabel")}
                className="h-4 w-4"
              />
            </label>
            <span className="text-xs text-muted-foreground">
              {t("organization.suppliers.selectAllLabel")}
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            {t("organization.suppliers.loadError")}
          </p>
        ) : suppliers.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t("organization.suppliers.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {suppliers.map((supplier) => (
              <li
                key={supplier.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3"
              >
                <div className="flex min-w-0 items-start gap-2">
                  {canWrite && (
                    <label className="relative -m-2 mt-0.5 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(supplier.id)}
                        onChange={() => toggleSelect(supplier.id)}
                        aria-label={t("organization.suppliers.selectFor", {
                          name: supplier.name,
                        })}
                        className="h-4 w-4"
                      />
                    </label>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground">
                        {supplier.name}
                      </span>
                      <Badge
                        variant={STATUS_BADGE_VARIANT[supplier.status]}
                        size="xs"
                        bordered
                      >
                        {t(STATUS_LABEL_KEY[supplier.status])}
                      </Badge>
                      {supplier.risk_tier && (
                        <Badge
                          variant={RISK_TIER_BADGE_VARIANT[supplier.risk_tier]}
                          size="xs"
                          bordered
                        >
                          {t(RISK_TIER_LABEL_KEY[supplier.risk_tier])}
                        </Badge>
                      )}
                      {supplier.country && (
                        <Badge variant="secondary" size="xs" bordered>
                          {supplier.country}
                        </Badge>
                      )}
                      {supplier.ai_generated && (
                        <Badge variant="primary" size="xs" bordered>
                          <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                          {t("organization.suppliers.aiDiscovered")}
                        </Badge>
                      )}
                    </div>
                    {supplier.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {supplier.notes}
                      </p>
                    )}
                  </div>
                </div>
                {canWrite && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-touch"
                      onClick={() => openEdit(supplier.id)}
                      aria-label={t("organization.suppliers.editFor", {
                        name: supplier.name,
                      })}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-touch"
                      onClick={() => setDeleteTargetId(supplier.id)}
                      aria-label={t("organization.suppliers.deleteFor", {
                        name: supplier.name,
                      })}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="border-t border-border p-3">
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              prevAriaLabel={t("organization.suppliers.prevPage")}
              nextAriaLabel={t("organization.suppliers.nextPage")}
            />
          </div>
        )}
      </div>

      {showForm && (
        <SupplierFormModal
          form={form}
          setForm={setForm}
          editingId={editingId}
          onClose={closeForm}
          onSave={saveSupplier}
          isSaving={isCreating || isUpdating}
        />
      )}

      <DeleteAlertModal
        open={deleteTargetId !== null}
        setOpen={(open) => {
          if (!open) setDeleteTargetId(null)
        }}
        onConfirm={confirmDelete}
        loading={isDeleting}
        title={t("organization.suppliers.deleteConfirmTitle")}
        description={t("organization.suppliers.deleteConfirmDescription")}
      />

      <DeleteAlertModal
        open={isBulkDeleteModalOpen}
        setOpen={setIsBulkDeleteModalOpen}
        onConfirm={confirmBulkDelete}
        loading={isBulkDeleting}
        title={t("organization.suppliers.bulkDeleteConfirmTitle")}
        description={t("organization.suppliers.bulkDeleteConfirmDescription", {
          count: selectedIds.size,
        })}
      />
    </div>
  )
}
