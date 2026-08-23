import { Loader2, Save, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            onClick={onClose}
            aria-label={t("organization.suppliers.form.close")}
          >
            <X />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label
              htmlFor="supplier-form-name"
              className="mb-1 text-xs font-semibold text-foreground"
            >
              {t("organization.suppliers.form.name")} *
            </Label>
            <Input
              id="supplier-form-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="h-11 w-full"
            />
          </div>

          <div>
            <Label
              htmlFor="supplier-form-country"
              className="mb-1 text-xs font-medium text-muted-foreground"
            >
              {t("organization.suppliers.form.country")}
            </Label>
            <Input
              id="supplier-form-country"
              list="supplier-form-country-list"
              value={form.country}
              onChange={(e) =>
                setForm((p) => ({ ...p, country: e.target.value }))
              }
              className="h-11 w-full"
            />
            <datalist id="supplier-form-country-list">
              {COUNTRIES.map((country) => (
                <option key={country} value={country} />
              ))}
            </datalist>
          </div>

          <div>
            <Label
              htmlFor="supplier-form-notes"
              className="mb-1 text-xs font-medium text-muted-foreground"
            >
              {t("organization.suppliers.form.notes")}
            </Label>
            <Textarea
              id="supplier-form-notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="touch" onClick={onClose}>
            {t("organization.suppliers.form.cancel")}
          </Button>
          <Button
            type="button"
            size="touch"
            onClick={onSave}
            disabled={isSaving || !form.name.trim()}
          >
            {isSaving ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            {t("organization.suppliers.form.save")}
          </Button>
        </div>
      </div>
    </div>
  )
}
