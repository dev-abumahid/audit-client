import { X } from "lucide-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

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

  if (!open || !plan) return null

  const handleDelete = async () => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
              <span className="text-xl text-red-600">🗑</span>
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              {t("admin.settings.pricing.deleteModal.title")}
            </h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
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

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t("admin.settings.pricing.form.cancel")}
          </button>

          <button
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
      </div>
    </div>
  )
}

export default DeletePricingModal
