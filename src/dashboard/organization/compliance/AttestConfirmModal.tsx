import { Loader2, RotateCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ComplianceObligation } from "@/redux/apis/organization/compliance.api"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
// Phase D (modal consolidation): was a hand-rolled overlay div +
// useModalA11y; now the shared Radix-backed Dialog (focus trap, Escape,
// backdrop-click, return-focus-on-close, role="dialog"/aria-modal all
// handled by the shared component instead of duplicated here). Only ever
// mounted while an obligation is selected (parent renders
// `{attestObligation && <AttestConfirmModal .../>}`), so `open` is always
// true -- Radix's own onOpenChange fires false on Escape/backdrop-click/
// its close button, all of which should just call onClose.
export default function AttestConfirmModal({
  obligation,
  note,
  onNoteChange,
  onClose,
  onConfirm,
  isSubmitting,
}: AttestConfirmModalProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("organization.compliance.attest.modalTitle")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("organization.compliance.attest.modalSubtitle", {
            title: obligation.title,
          })}
        </p>
        <div>
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
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring flex h-11 items-center justify-center rounded-lg border border-input px-4 text-sm text-muted-foreground hover:bg-muted"
          >
            {t("organization.compliance.form.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="focus-ring flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
            {t("organization.compliance.attest.confirmButton")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
