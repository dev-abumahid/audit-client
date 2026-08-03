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
}

const AddPricingModal: React.FC<Props> = ({ open, setOpen }) => {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState({
    planName: "",
    planDescription: "",
    planPrice: "",
    planType: "monthly",
    planFeatures: [""] as string[],
  })

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // Handle feature input change
  const handleFeatureChange = (index: number, value: string) => {
    const updated = [...form.planFeatures]
    updated[index] = value
    setForm((prev) => ({ ...prev, planFeatures: updated }))
  }

  // Add new feature field
  const addFeature = () => {
    setForm((prev) => ({
      ...prev,
      planFeatures: [...prev.planFeatures, ""],
    }))
  }

  // Remove feature field
  const removeFeature = (index: number) => {
    if (form.planFeatures.length === 1) return
    setForm((prev) => ({
      ...prev,
      planFeatures: prev.planFeatures.filter((_, i) => i !== index),
    }))
  }

  // Handle form submission (simulated)
  const handleSubmit = async () => {
    if (!form.planName.trim()) {
      alert(t("admin.settings.pricing.addModal.nameRequired"))
      return
    }
    if (!form.planPrice.trim()) {
      alert(t("admin.settings.pricing.addModal.priceRequired"))
      return
    }
    if (Number.isNaN(Number(form.planPrice)) || Number(form.planPrice) < 0) {
      alert(t("admin.settings.pricing.addModal.priceInvalid"))
      return
    }

    setIsSubmitting(true)

    // Simulate API call
    setTimeout(() => {
      alert(
        t("admin.settings.pricing.addModal.createSuccess", {
          name: form.planName,
        })
      )
      setOpen(false)

      // Reset form
      setForm({
        planName: "",
        planDescription: "",
        planPrice: "",
        planType: "monthly",
        planFeatures: [""],
      })
      setIsSubmitting(false)
    }, 800)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-full max-w-lg gap-0 rounded-2xl border border-border bg-card p-6 shadow-xl sm:max-w-lg">
        {/* Header */}
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold text-foreground">
            {t("admin.settings.pricing.addModal.title")}
          </DialogTitle>
        </DialogHeader>

        {/* Form */}
        <div className="space-y-5">
          {/* Plan Name */}
          <div>
            <label
              htmlFor="add-plan-name"
              className="mb-1.5 block text-sm font-medium text-muted-foreground"
            >
              {t("admin.settings.pricing.form.planNameLabel")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              id="add-plan-name"
              name="planName"
              type="text"
              value={form.planName}
              onChange={handleChange}
              placeholder={t(
                "admin.settings.pricing.addModal.planNamePlaceholder"
              )}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Plan Description */}
          <div>
            <label
              htmlFor="add-plan-description"
              className="mb-1.5 block text-sm font-medium text-muted-foreground"
            >
              {t("admin.settings.pricing.form.descriptionLabel")}
            </label>
            <input
              id="add-plan-description"
              name="planDescription"
              type="text"
              value={form.planDescription}
              onChange={handleChange}
              placeholder={t(
                "admin.settings.pricing.addModal.descriptionPlaceholder"
              )}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Price & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="add-plan-price"
                className="mb-1.5 block text-sm font-medium text-muted-foreground"
              >
                {t("admin.settings.pricing.form.priceLabel")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                id="add-plan-price"
                name="planPrice"
                type="number"
                min="0"
                value={form.planPrice}
                onChange={handleChange}
                placeholder={t(
                  "admin.settings.pricing.addModal.pricePlaceholder"
                )}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="add-plan-type"
                className="mb-1.5 block text-sm font-medium text-muted-foreground"
              >
                {t("admin.settings.pricing.form.billingCycleLabel")}
              </label>
              <select
                id="add-plan-type"
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

        {/* Footer Buttons */}
        <div className="mt-8 flex gap-3">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t("admin.settings.pricing.form.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting
              ? t("admin.settings.pricing.addModal.creating")
              : t("admin.settings.pricing.addModal.create")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AddPricingModal
