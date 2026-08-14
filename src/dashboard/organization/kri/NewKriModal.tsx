import { Loader2, Save, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Risk } from "@/types/organization"
import { useModalA11y } from "@/hooks/useModalA11y"
import { KriFormField, KriFrequencySelect } from "./kriShared"
import { RISK_NAME_TRUNCATE_LENGTH, type KriFormState } from "./kriConfig"

interface NewKriModalProps {
  form: KriFormState
  setForm: (updater: (prev: KriFormState) => KriFormState) => void
  risks: Risk[]
  onClose: () => void
  onSave: () => void
  isSaving: boolean
}

// Only ever mounted while `showForm` is true, so useModalA11y here is
// always called with isOpen=true -- see UpdateValueModal's own comment for
// why that's equivalent to the previous isOpen-toggling-in-a-persistently-
// mounted-component behavior.
export default function NewKriModal({
  form,
  setForm,
  risks,
  onClose,
  onSave,
  isSaving,
}: NewKriModalProps) {
  const { t } = useTranslation()
  const modalRef = useModalA11y(true, onClose)

  const selectedRisk = risks.find((r) => r.id === form.risk_id)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kri-new-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="kri-new-title" className="text-lg font-bold text-foreground">
            {t("organization.kri.newKri")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("organization.kri.cancel")}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <KriFormField
            id="kri-form-name"
            label={t("organization.kri.form.name")}
            required
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder={t("organization.kri.form.namePlaceholder")}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="kri-form-risk"
                className="text-xs font-medium text-muted-foreground"
              >
                {t("organization.kri.form.risk")} *
              </label>
              <select
                id="kri-form-risk"
                required
                aria-required="true"
                value={form.risk_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, risk_id: e.target.value }))
                }
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">
                  {t("organization.kri.form.selectRisk")}
                </option>
                {risks.map((r) => (
                  <option key={r.id} value={r.id} title={r.name}>
                    {r.name.length > RISK_NAME_TRUNCATE_LENGTH
                      ? `${r.name.slice(0, RISK_NAME_TRUNCATE_LENGTH)}...`
                      : r.name}
                  </option>
                ))}
              </select>
              {/* option-element title tooltips don't reliably render
                  everywhere (same constraint the ReportsPage "Coming soon"
                  fix documents), so the full name of a truncated selection
                  is also always visible here, not just on hover. */}
              {selectedRisk &&
                selectedRisk.name.length > RISK_NAME_TRUNCATE_LENGTH && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {selectedRisk.name}
                  </p>
                )}
            </div>
            <KriFormField
              id="kri-form-unit"
              label={t("organization.kri.form.unit")}
              required
              value={form.unit}
              onChange={(v) => setForm((f) => ({ ...f, unit: v }))}
              placeholder={t("organization.kri.form.unitPlaceholder")}
            />
          </div>

          <KriFormField
            id="kri-form-owner"
            label={t("organization.kri.form.owner")}
            value={form.owner}
            onChange={(v) => setForm((f) => ({ ...f, owner: v }))}
            placeholder={t("organization.kri.form.ownerPlaceholder")}
          />

          <div className="grid grid-cols-3 gap-3">
            <KriFormField
              id="kri-form-current-value"
              label={t("organization.kri.form.currentValue")}
              type="number"
              min={0}
              value={form.current_value}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  current_value: Number(v),
                }))
              }
            />
            <KriFormField
              id="kri-form-alert-threshold"
              label={t("organization.kri.form.alertThreshold")}
              type="number"
              min={0}
              value={form.alert_threshold}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  alert_threshold: Number(v),
                }))
              }
            />
            <KriFormField
              id="kri-form-target"
              label={t("organization.kri.form.target")}
              type="number"
              min={0}
              value={form.target_value}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  target_value: Number(v),
                }))
              }
            />
          </div>

          <KriFrequencySelect
            id="kri-form-frequency"
            value={form.frequency}
            onChange={(v) => setForm((f) => ({ ...f, frequency: v }))}
            t={t}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            {t("organization.kri.cancel")}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !form.name || !form.risk_id || !form.unit}
            className="focus-ring flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t("organization.kri.createKri")}
          </button>
        </div>
      </div>
    </div>
  )
}
