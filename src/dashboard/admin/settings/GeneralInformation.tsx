import { ChevronDown, Upload, X } from "lucide-react"
import React, { useRef, useState } from "react"

const GeneralInformation = () => {
  const [formData, setFormData] = useState({
    platFormName: "RiskGuard Pro",
    platformEmail: "support@riskguard.com",
    platformPhone: "+880 1234-567890",
    platformAddress: "Dhaka, Bangladesh",
    platformCurrency: "USD",
  })

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>(
    "https://via.placeholder.com/120x120/3b82f6/ffffff?text=RG"
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { id, value } = e.target
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

  // Handle logo file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/svg+xml",
      "image/gif",
    ]
    if (!validTypes.includes(file.type)) {
      alert("Please upload a valid image file (JPEG, PNG, SVG, GIF)")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size should be less than 5MB")
      return
    }

    setLogoFile(file)

    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview("https://via.placeholder.com/120x120/3b82f6/ffffff?text=RG")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Handle form submit (simulated - will be replaced with backend call)
  const handleSubmit = async () => {
    if (!formData.platFormName.trim()) {
      alert("Platform name is required")
      return
    }

    if (!formData.platformEmail.trim()) {
      alert("Email is required")
      return
    }

    setIsSubmitting(true)

    // Simulate API call
    setTimeout(() => {
      alert("Settings updated successfully!")
      setIsSubmitting(false)
      // In real implementation, call your update API here
    }, 800)
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          General Information
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your platform's basic details and branding
        </p>
      </div>

      <div className="space-y-6">
        {/* Platform Name */}
        <div>
          <label
            htmlFor="platFormName"
            className="mb-1.5 block text-sm font-medium text-muted-foreground"
          >
            Platform Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="platFormName"
            value={formData.platFormName}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="Enter platform name"
          />
        </div>

        {/* Logo Upload */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
            Platform Logo
          </label>

          <div className="flex items-center gap-6">
            {/* Preview */}
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-border bg-muted">
              {logoPreview && (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="h-full w-full object-cover"
                />
              )}
              {logoFile && (
                <button
                  onClick={handleRemoveLogo}
                  className="text-destructive-foreground absolute -top-2 -right-2 rounded-full bg-destructive p-1 hover:bg-destructive/90"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Upload Controls */}
            <div>
              <button
                type="button"
                onClick={handleUploadClick}
                className="flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Upload className="h-4 w-4" />
                {logoFile || logoPreview ? "Change Logo" : "Upload Logo"}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                Recommended: Square image (PNG, JPG, SVG). Max 5MB
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/jpg,image/png,image/svg+xml,image/gif"
              className="hidden"
            />
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="platformEmail"
              className="mb-1.5 block text-sm font-medium text-muted-foreground"
            >
              Contact Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="platformEmail"
              value={formData.platformEmail}
              onChange={handleInputChange}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="support@yourcompany.com"
            />
          </div>

          <div>
            <label
              htmlFor="platformPhone"
              className="mb-1.5 block text-sm font-medium text-muted-foreground"
            >
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="platformPhone"
              value={formData.platformPhone}
              onChange={handleInputChange}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="+880 1234-567890"
            />
          </div>
        </div>

        {/* Address & Currency */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="platformAddress"
              className="mb-1.5 block text-sm font-medium text-muted-foreground"
            >
              Address
            </label>
            <input
              type="text"
              id="platformAddress"
              value={formData.platformAddress}
              onChange={handleInputChange}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="123 Business Street, Dhaka"
            />
          </div>

          <div>
            <label
              htmlFor="platformCurrency"
              className="mb-1.5 block text-sm font-medium text-muted-foreground"
            >
              Default Currency
            </label>
            <div className="relative">
              <select
                id="platformCurrency"
                value={formData.platformCurrency}
                onChange={handleInputChange}
                className="w-full appearance-none rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {[
                  { value: "USD", label: "USD ($)" },
                  { value: "EUR", label: "EUR (€)" },
                  { value: "GBP", label: "GBP (£)" },
                  { value: "BDT", label: "BDT (৳)" },
                ].map((currency) => (
                  <option key={currency.value} value={currency.value}>
                    {currency.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end border-t border-border pt-6">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Saving Changes...
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>
    </div>
  )
}

export default GeneralInformation
