import { Loader2, RotateCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ComplianceObligation } from "@/redux/apis/organization/compliance.api"
import { useModalA11y } from "@/hooks/useModalA11y"

interface AttestConfirmModalProps {
  obligation: ComplianceObligation
  note: string
  onNoteChange: (note: string) => void
  onClose: () => void
  onConfirm: () => void
  isSubmitting: boolean
}

// Re-attest confirm modal (aexa-server#250). Legal for any obligation,
// recurring or not -- see the row action's own comment in CompliancePage.
// Only ever mounted while an obligation is selected (parent renders
// `{attestObligation && <AttestConfirmModal .../>}`), so useModalA11y here
// is always called with isOpen=true -- unmounting on close runs the same
// cleanup (focus return, Escape listener teardown) the hook would have run
// on an isOpen:true->false transition in a persistently-mounted component.
export default function AttestConfirmModal({
  obligation,
  note,
  onNoteChange,
  onClose,
  onConfirm,
  isSubmitting,
}: AttestConfirmModalProps) {
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
        aria-labelledby="attest-modal-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="attest-modal-title"
          className="mb-1 text-lg font-bold text-foreground"
        >
          {t("organization.compliance.attest.modalTitle")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {t("organization.compliance.attest.modalSubtitle", {
            title: obligation.title,
          })}
        </p>
        <label
          htmlFor="attest-confirm-note"
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          {t("organization.compliance.attest.noteLabel")}
        </label>
        <textarea
          id="attest-confirm-note"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={3}
          placeholder={t("organization.compliance.attest.notePlaceholder")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring flex h-11 items-center rounded-lg border border-input px-4 text-sm text-muted-foreground hover:bg-muted"
          >
            {t("organization.compliance.form.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="focus-ring flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
            {t("organization.compliance.attest.confirmButton")}
          </button>
        </div>
      </div>
    </div>
  )
}
