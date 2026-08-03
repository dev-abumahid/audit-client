import React, { useEffect, useState } from "react"
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
    planDescription: string
    planPrice: number
    planType: string
    planFeatures: string[]
  } | null
}

const EditPricingModal: React.FC<Props> = ({ open, setOpen, plan }) => {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState({
    planName: "",
    planDescription: "",
    planPrice: "",
    planType: "monthly",
    planFeatures: [""] as string[],
  })

  // Prefill form when plan changes
  useEffect(() => {
    if (plan) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        planName: plan.planName || "",
        planDescription: plan.planDescription || "",
        planPrice: plan.planPrice != null ? String(plan.planPrice) : "",
        planType: plan.planType || "monthly",
        planFeatures: plan.planFeatures?.length ? plan.planFeatures : [""],
      })
    }
  }, [plan])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFeatureChange = (index: number, value: string) => {
    const updated = [...form.planFeatures]
    updated[index] = value
    setForm((prev) => ({ ...prev, planFeatures: updated }))
  }

  const addFeature = () => {
    setForm((prev) => ({
      ...prev,
      planFeatures: [...prev.planFeatures, ""],
    }))
  }

  const removeFeature = (index: number) => {
    if (form.planFeatures.length === 1) return
    setForm((prev) => ({
      ...prev,
      planFeatures: prev.planFeatures.filter((_, i) => i !== index),
    }))
  }

  const handleUpdate = async () => {
    if (!form.planName.trim()) {
      alert(t("admin.settings.pricing.editModal.nameRequired"))
      return
    }

    const price = Number(form.planPrice)
    if (form.planPrice.trim() === "" || Number.isNaN(price) || price < 0) {
      alert(t("admin.settings.pricing.editModal.priceInvalid"))
      return
    }

    setIsSubmitting(true)

    // Simulate API call (replace with your actual update API later)
    setTimeout(() => {
      alert(
        t("admin.settings.pricing.editModal.updateSuccess", {
          name: form.planName,
        })
      )
      setOpen(false)
      setIsSubmitting(false)
    }, 800)
  }

  return (
    <Dialog open={open && !!plan} onOpenChange={setOpen}>
      <DialogContent className="w-full max-w-lg gap-0 rounded-2xl border border-border bg-card p-6 shadow-xl sm:max-w-lg">
        {/* Header */}
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold text-foreground">
            {t("admin.settings.pricing.editModal.title")}
          </DialogTitle>
        </DialogHeader>

        {/* Form */}
        <div className="space-y-5">
          {/* Plan Name */}
          <div>
            <label
              htmlFor="edit-plan-name"
              className="mb-1.5 block text-sm font-medium text-muted-foreground"
            >
              {t("admin.settings.pricing.form.planNameLabel")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-plan-name"
              name="planName"
              type="text"
              value={form.planName}
              onChange={handleChange}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="edit-plan-description"
              className="mb-1.5 block text-sm font-medium text-muted-foreground"
            >
              {t("admin.settings.pricing.form.descriptionLabel")}
            </label>
            <input
              id="edit-plan-description"
              name="planDescription"
              type="text"
              value={form.planDescription}
              onChange={handleChange}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Price & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="edit-plan-price"
                className="mb-1.5 block text-sm font-medium text-muted-foreground"
              >
                {t("admin.settings.pricing.form.priceLabel")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-plan-price"
                name="planPrice"
                type="number"
                min="0"
                value={form.planPrice}
                onChange={handleChange}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="edit-plan-type"
                className="mb-1.5 block text-sm font-medium text-muted-foreground"
              >
                {t("admin.settings.pricing.form.billingCycleLabel")}
              </label>
              <select
                id="edit-plan-type"
                name="planType"
                value={form.planType}
                onChange={handleChange}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="monthly">
                  {t("admin.settings.pricing.form.monthly")}
                </option>
                <option value="quarterly">
                  {t("admin.settings.pricing.form.quarterly")}
                </option>
                <option value="yearly">
                  {t("admin.settings.pricing.form.yearly")}
                </option>
              </select>
            </div>
          </div>

          {/* Features */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                {t("admin.settings.pricing.form.featuresLabel")}
              </label>
              <button
                type="button"
                onClick={addFeature}
                className="text-xs text-primary hover:underline"
              >
                {t("admin.settings.pricing.form.addFeature")}
              </button>
            </div>

            <div className="space-y-2">
              {form.planFeatures.map((feature, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={feature}
                    aria-label={t(
                      "admin.settings.pricing.form.featurePlaceholder",
                      { number: index + 1 }
                    )}
                    placeholder={t(
                      "admin.settings.pricing.form.featurePlaceholder",
                      { number: index + 1 }
                    )}
                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                    className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeFeature(index)}
                    disabled={form.planFeatures.length === 1}
                    className="rounded-xl border border-border px-4 text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    ✕
                    <span className="sr-only">
                      {t("admin.settings.pricing.form.removeFeature", {
                        number: index + 1,
                      })}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-3">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t("admin.settings.pricing.form.cancel")}
          </button>

          <button
            onClick={handleUpdate}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting
              ? t("admin.settings.pricing.editModal.updating")
              : t("admin.settings.pricing.editModal.update")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default EditPricingModal
