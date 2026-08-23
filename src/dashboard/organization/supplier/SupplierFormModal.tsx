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
  risk_tier: "" | "LOW" | "MEDIUM" | "HIGH"
  next_review_date: string
  primary_contact_name: string
  primary_contact_email: string
  contract_status: "" | "ACTIVE" | "EXPIRED" | "PENDING"
  status: "ACTIVE" | "UNDER_REVIEW" | "INACTIVE"
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

          {/* Vendor-risk fields (quality-bar-loop feature scoping, 2026-08-22):
              risk tier, review cadence, primary contact, contract status and
              lifecycle status -- all optional except status (which defaults
              to ACTIVE server-side), same "enrichment, not gating" posture
              as country/notes above. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label
                htmlFor="supplier-form-risk-tier"
                className="mb-1 text-xs font-medium text-muted-foreground"
              >
                {t("organization.suppliers.form.riskTier")}
              </Label>
              <select
                id="supplier-form-risk-tier"
                value={form.risk_tier}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    risk_tier: e.target.value as SupplierFormState["risk_tier"],
                  }))
                }
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("organization.suppliers.form.notSet")}</option>
                <option value="LOW">{t("organization.suppliers.riskLow")}</option>
                <option value="MEDIUM">
                  {t("organization.suppliers.riskMedium")}
                </option>
                <option value="HIGH">{t("organization.suppliers.riskHigh")}</option>
              </select>
            </div>

            <div>
              <Label
                htmlFor="supplier-form-status"
                className="mb-1 text-xs font-medium text-muted-foreground"
              >
                {t("organization.suppliers.form.status")}
              </Label>
              <select
                id="supplier-form-status"
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    status: e.target.value as SupplierFormState["status"],
                  }))
                }
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
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
            </div>
          </div>

          <div>
            <Label
              htmlFor="supplier-form-next-review-date"
              className="mb-1 text-xs font-medium text-muted-foreground"
            >
              {t("organization.suppliers.form.nextReviewDate")}
            </Label>
            <Input
              id="supplier-form-next-review-date"
              type="date"
              value={form.next_review_date}
              onChange={(e) =>
                setForm((p) => ({ ...p, next_review_date: e.target.value }))
              }
              className="h-11 w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label
                htmlFor="supplier-form-contact-name"
                className="mb-1 text-xs font-medium text-muted-foreground"
              >
                {t("organization.suppliers.form.primaryContactName")}
              </Label>
              <Input
                id="supplier-form-contact-name"
                value={form.primary_contact_name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, primary_contact_name: e.target.value }))
                }
                className="h-11 w-full"
              />
            </div>
            <div>
              <Label
                htmlFor="supplier-form-contact-email"
                className="mb-1 text-xs font-medium text-muted-foreground"
              >
                {t("organization.suppliers.form.primaryContactEmail")}
              </Label>
              <Input
                id="supplier-form-contact-email"
                type="email"
                value={form.primary_contact_email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, primary_contact_email: e.target.value }))
                }
                className="h-11 w-full"
              />
            </div>
          </div>

          <div>
            <Label
              htmlFor="supplier-form-contract-status"
              className="mb-1 text-xs font-medium text-muted-foreground"
            >
              {t("organization.suppliers.form.contractStatus")}
            </Label>
            <select
              id="supplier-form-contract-status"
              value={form.contract_status}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  contract_status: e.target
                    .value as SupplierFormState["contract_status"],
                }))
              }
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("organization.suppliers.form.notSet")}</option>
              <option value="ACTIVE">
                {t("organization.suppliers.contractStatusActive")}
              </option>
              <option value="EXPIRED">
                {t("organization.suppliers.contractStatusExpired")}
              </option>
              <option value="PENDING">
                {t("organization.suppliers.contractStatusPending")}
              </option>
            </select>
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
