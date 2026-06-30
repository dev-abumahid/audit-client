import React, { useState } from "react"
import { X } from "lucide-react"

interface Props {
  open: boolean
  setOpen: (value: boolean) => void
}

const AddPricingModal: React.FC<Props> = ({ open, setOpen }) => {
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
      alert("Plan name is required")
      return
    }
    if (!form.planPrice) {
      alert("Plan price is required")
      return
    }

    setIsSubmitting(true)

    // Simulate API call
    setTimeout(() => {
      alert(`Pricing plan "${form.planName}" created successfully!`)
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            Add New Pricing Plan
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-5">
          {/* Plan Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Plan Name <span className="text-red-500">*</span>
            </label>
            <input
              name="planName"
              type="text"
              value={form.planName}
              onChange={handleChange}
              placeholder="e.g. Professional"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Plan Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Description
            </label>
            <input
              name="planDescription"
              type="text"
              value={form.planDescription}
              onChange={handleChange}
              placeholder="Brief description of the plan"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Price & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Price <span className="text-red-500">*</span>
              </label>
              <input
                name="planPrice"
                type="number"
                value={form.planPrice}
                onChange={handleChange}
                placeholder="149"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Billing Cycle
              </label>
              <select
                name="planType"
                value={form.planType}
                onChange={handleChange}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          {/* Features */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                Plan Features
              </label>
              <button
                type="button"
                onClick={addFeature}
                className="text-xs text-primary hover:underline"
              >
                + Add Feature
              </button>
            </div>

            <div className="space-y-2">
              {form.planFeatures.map((feature, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={feature}
                    placeholder={`Feature ${index + 1}`}
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
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? "Creating Plan..." : "Create Plan"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddPricingModal
