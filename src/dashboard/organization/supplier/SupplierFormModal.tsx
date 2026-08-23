import { Loader2, Save, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { COUNTRIES } from "@/data/countries"
import { useModalA11y } from "@/hooks/useModalA11y"

export interface SupplierFormState {
  id: string
  name: string
  country: string
  notes: string
}

interface SupplierFormModalProps {
  form: SupplierFormState
  setForm: (updater: (prev: SupplierFormState) => SupplierFormState) => void
  editingId: string | null
  onClose: () => void
  onSave: () => void
  isSaving: boolean
}

// Create / Edit Supplier modal. Only ever mounted while showForm is true
// (parent renders `{showForm && <SupplierFormModal .../>}`), same
// always-open useModalA11y(true, onClose) convention as
// ComplianceFormModal/AttestConfirmModal.
export default function SupplierFormModal({
  form,
  setForm,
  editingId,
  onClose,
  onSave,
  isSaving,
}: SupplierFormModalProps) {
  const { t } = useTranslation()
  const modalRef = useModalA11y(true, onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-form-modal-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="supplier-form-modal-title"
            className="text-lg font-bold text-foreground"
          >
            {editingId
              ? t("organization.suppliers.form.editTitle")
              : t("organization.suppliers.form.newTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("organization.suppliers.form.close")}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="supplier-form-name"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              {t("organization.suppliers.form.name")} *
            </label>
            <input
              id="supplier-form-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="supplier-form-country"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {t("organization.suppliers.form.country")}
            </label>
            <input
              id="supplier-form-country"
              list="supplier-form-country-list"
              value={form.country}
              onChange={(e) =>
                setForm((p) => ({ ...p, country: e.target.value }))
              }
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            <datalist id="supplier-form-country-list">
              {COUNTRIES.map((country) => (
                <option key={country} value={country} />
              ))}
            </datalist>
          </div>

          <div>
            <label
              htmlFor="supplier-form-notes"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {t("organization.suppliers.form.notes")}
            </label>
            <textarea
              id="supplier-form-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring h-10 rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            {t("organization.suppliers.form.cancel")}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !form.name.trim()}
            className="focus-ring flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            {t("organization.suppliers.form.save")}
          </button>
        </div>
      </div>
    </div>
  )
}
