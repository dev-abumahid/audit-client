import { Trash2 } from "lucide-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Props {
  open: boolean
  setOpen: (value: boolean) => void
  plan: {
    _id: string
    planName: string
  } | null
}

const DeletePricingModal: React.FC<Props> = ({ open, setOpen, plan }) => {
  const { t } = useTranslation()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!plan) return
    setIsDeleting(true)

    // Simulate API call (replace with your backend call later)
    setTimeout(() => {
      alert(
        t("admin.settings.pricing.deleteModal.deleteSuccess", {
          name: plan.planName,
        })
      )
      setOpen(false)
      setIsDeleting(false)
    }, 800)
  }

  return (
    <Dialog open={open && !!plan} onOpenChange={setOpen}>
      <DialogContent className="w-full max-w-md gap-0 rounded-2xl border border-border bg-card p-6 shadow-xl sm:max-w-md">
        {/* Header */}
        <DialogHeader className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <Trash2 className="h-4.5 w-4.5 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle className="text-xl font-semibold text-foreground">
              {t("admin.settings.pricing.deleteModal.title")}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Content */}
        {plan && (
          <div className="mb-8">
            <p className="text-foreground">
              {t("admin.settings.pricing.deleteModal.confirmText", {
                name: plan.planName,
              })}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("admin.settings.pricing.deleteModal.warningText")}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t("admin.settings.pricing.form.cancel")}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-destructive-foreground flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive py-3 text-sm font-medium transition-colors hover:bg-destructive/90 disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {t("admin.settings.pricing.deleteModal.deleting")}
              </>
            ) : (
              t("admin.settings.pricing.deleteModal.confirmDelete")
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default DeletePricingModal
