import { Loader2, Save, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useModalA11y } from "@/hooks/useModalA11y"
import { KriFormField, KriFrequencySelect } from "./kriShared"
import type { KriEditFormState } from "./kriConfig"

interface EditKriModalProps {
  form: KriEditFormState
  setForm: (updater: (prev: KriEditFormState) => KriEditFormState) => void
  onClose: () => void
  onSave: () => void
  isSaving: boolean
}

// Round-5 industry-standards finding: no way to edit a KRI's own fields
// (name/unit/thresholds/frequency) after creation existed at all -- only
// its current value (UpdateValueModal). Mirrors the New KRI modal's fields
// minus risk_id/current_value, which update_kri's own backend schema
// doesn't accept. Only ever mounted while `editingKriId` is set, so
// useModalA11y here is always called with isOpen=true -- see
// UpdateValueModal's own comment for why that's equivalent to the previous
// isOpen-toggling-in-a-persistently-mounted-component behavior.
export default function EditKriModal({
  form,
  setForm,
  onClose,
  onSave,
  isSaving,
}: EditKriModalProps) {
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
        aria-labelledby="kri-edit-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="kri-edit-title" className="text-lg font-bold text-foreground">
            {t("organization.kri.editKriTitle")}
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
            id="kri-edit-name"
            label={t("organization.kri.form.name")}
            required
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder={t("organization.kri.form.namePlaceholder")}
          />

          <KriFormField
            id="kri-edit-unit"
            label={t("organization.kri.form.unit")}
            value={form.unit}
            onChange={(v) => setForm((f) => ({ ...f, unit: v }))}
            placeholder={t("organization.kri.form.unitPlaceholder")}
          />

          <KriFormField
            id="kri-edit-owner"
            label={t("organization.kri.form.owner")}
            value={form.owner}
            onChange={(v) => setForm((f) => ({ ...f, owner: v }))}
            placeholder={t("organization.kri.form.ownerPlaceholder")}
          />

          <div className="grid grid-cols-2 gap-3">
            <KriFormField
              id="kri-edit-alert-threshold"
              label={t("organization.kri.form.alertThreshold")}
              type="number"
              value={form.alert_threshold}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  alert_threshold: Number(v),
                }))
              }
            />
            <KriFormField
              id="kri-edit-target"
              label={t("organization.kri.form.target")}
              type="number"
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
            id="kri-edit-frequency"
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
            disabled={isSaving || !form.name}
            className="focus-ring flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t("organization.kri.save")}
          </button>
        </div>
      </div>
    </div>
  )
}
