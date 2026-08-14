import { Loader2, Save, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { KRI } from "@/types/organization"
import { useModalA11y } from "@/hooks/useModalA11y"
import { formatKriNumber } from "./kriConfig"

interface UpdateValueModalProps {
  kri: KRI | null | undefined
  value: string
  onValueChange: (value: string) => void
  onClose: () => void
  onSave: () => void
  isSaving: boolean
}

// Only ever mounted while `updatingKriId` is set (parent renders
// `{updatingKriId && <UpdateValueModal .../>}`), so useModalA11y here is
// always called with isOpen=true -- unmounting on close runs the same
// cleanup (focus return, Escape listener teardown) the hook would have run
// on an isOpen:true->false transition in a persistently-mounted component.
export default function UpdateValueModal({
  kri,
  value,
  onValueChange,
  onClose,
  onSave,
  isSaving,
}: UpdateValueModalProps) {
  const { t, i18n } = useTranslation()
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
        aria-labelledby="kri-update-value-title"
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="kri-update-value-title"
            className="text-lg font-bold text-foreground"
          >
            {t("organization.kri.updateValueTitle")}
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
        {kri && (
          <div className="mb-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {kri.name}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("organization.kri.thresholdLabel")}{" "}
              {formatKriNumber(Number(kri.alert_threshold), i18n.language)} ·{" "}
              {t("organization.kri.targetLabel")}{" "}
              {formatKriNumber(Number(kri.target_value), i18n.language)}
              {kri.unit ? ` ${kri.unit}` : ""}
            </p>
          </div>
        )}
        <label
          htmlFor="kri-update-value-input"
          className="text-xs font-medium text-muted-foreground"
        >
          {t("organization.kri.form.currentValue")}
        </label>
        {/* Round 16 (accessibility finding): `autoFocus` here fired during
            React's commit, before useModalA11y's own effect ran -- so by
            the time that effect captured `document.activeElement` as "the
            trigger to restore focus to on close," it captured THIS input
            instead of the button that actually opened the modal.
            useModalA11y's own focusable[0]?.focus() already overrides
            autoFocus's target anyway (focus visibly lands on the close
            button, not this input), so autoFocus was never doing anything
            except silently corrupting the trigger-restore ref. Removing it
            changes nothing about where focus lands on open, only fixes
            where it lands on close. */}
        <input
          id="kri-update-value-input"
          type="number"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
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
            disabled={isSaving}
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
