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
import {
  useCreateNewSupplierMutation,
  useDeleteSupplierMutation,
  useGetAllSuppliersQuery,
  useUpdateSupplierMutation,
} from "@/redux/apis/organization/supplier.api"
import SupplierDiscoveryPanel from "./SupplierDiscoveryPanel"
import SupplierFormModal, { type SupplierFormState } from "./SupplierFormModal"

const PAGE_SIZE = 20

const EMPTY_FORM: SupplierFormState = { id: "", name: "", country: "", notes: "" }

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
  const debouncedSearch = useDebouncedValue(search, 300)
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const { data, isLoading, error } = useGetAllSuppliersQuery({
    page,
    limit: PAGE_SIZE,
    searchTerm: debouncedSearch,
  })
  const suppliers = data?.data ?? []
  const totalPages = data?.meta?.totalPage ?? 1
  useClampPageToTotal(page, totalPages, setPage)

  const [createNewSupplier, { isLoading: isCreating }] =
    useCreateNewSupplierMutation()
  const [updateSupplier, { isLoading: isUpdating }] = useUpdateSupplierMutation()
  const [deleteSupplier, { isLoading: isDeleting }] = useDeleteSupplierMutation()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

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
    } catch {
      toast.error(t("organization.suppliers.deleteFailed"))
    } finally {
      setDeleteTargetId(null)
    }
  }

  return (
    <div className="space-y-4">
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
        <div className="border-b border-border p-3">
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
        </div>

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
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">
                      {supplier.name}
                    </span>
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
    </div>
  )
}
