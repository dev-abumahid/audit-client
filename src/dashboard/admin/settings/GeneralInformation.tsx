import { Building2, ChevronDown, Upload, X } from "lucide-react"
import React, { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

// No platform-settings backend endpoint exists yet, and there's no canonical
// Qiyrix branding recorded anywhere in the codebase to pre-fill this with.
// Defaulting to another product's fake data ("RiskGuard Pro" / a Bangladesh
// support address) misrepresented these as the platform's real settings, so
// this now starts blank/unconfigured rather than guessing.
const GeneralInformation = () => {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    platFormName: "",
    platformEmail: "",
    platformPhone: "",
    platformAddress: "",
    platformCurrency: "USD",
  })

  const [logoFile, setLogoFile] = useState<File | null>(null)
  // No logo uploaded yet -- null renders the "no logo" placeholder below
  // instead of a via.placeholder.com URL (that service has shut down and
  // 404s).
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
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
      alert(t("admin.settings.general.invalidImage"))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(t("admin.settings.general.fileTooLarge"))
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
    setLogoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Handle form submit. There is no platform-settings backend endpoint yet
  // (no src/redux/apis/admin/* covers this), so this only updates local
  // component state for the current session -- the success message says so
  // explicitly rather than claiming a real save happened.
  const handleSubmit = async () => {
    if (!formData.platFormName.trim()) {
      alert(t("admin.settings.general.nameRequired"))
      return
    }

    if (!formData.platformEmail.trim()) {
      alert(t("admin.settings.general.emailRequired"))
      return
    }

    if (!formData.platformPhone.trim()) {
      alert(t("admin.settings.general.phoneRequired"))
      return
    }

    setIsSubmitting(true)

    // No backend call to make yet -- see comment above handleSubmit.
    setTimeout(() => {
      alert(t("admin.settings.general.updateSuccess"))
      setIsSubmitting(false)
    }, 800)
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {t("admin.settings.general.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.settings.general.subtitle")}
        </p>
      </div>

      <div className="space-y-6">
        {/* Platform Name */}
        <div>
          <label
            htmlFor="platFormName"
            className="mb-1.5 block text-sm font-medium text-muted-foreground"
          >
            {t("admin.settings.general.platformName")}{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="platFormName"
            value={formData.platFormName}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder={t("admin.settings.general.platformNamePlaceholder")}
          />
        </div>

        {/* Logo Upload */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
            {t("admin.settings.general.platformLogo")}
          </label>

          <div className="flex items-center gap-6">
            {/* Preview */}
            <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt={t("admin.settings.general.logoAlt")}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 px-2 text-center">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                  <span className="text-[10px] leading-tight text-muted-foreground">
                    {t("admin.settings.general.noLogoUploaded")}
                  </span>
                </div>
              )}
              {logoFile && (
                <button
                  onClick={handleRemoveLogo}
                  className="text-destructive-foreground absolute -top-2 -right-2 rounded-full bg-destructive p-1 hover:bg-destructive/90"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">
                    {t("admin.settings.general.removeLogo")}
                  </span>
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
                {logoFile || logoPreview
                  ? t("admin.settings.general.changeLogo")
                  : t("admin.settings.general.uploadLogo")}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("admin.settings.general.logoHint")}
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
              {t("admin.settings.general.contactEmail")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="platformEmail"
              value={formData.platformEmail}
              onChange={handleInputChange}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder={t("admin.settings.general.emailPlaceholder")}
            />
          </div>

          <div>
            <label
              htmlFor="platformPhone"
              className="mb-1.5 block text-sm font-medium text-muted-foreground"
            >
              {t("admin.settings.general.phoneNumber")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="platformPhone"
              value={formData.platformPhone}
              onChange={handleInputChange}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder={t("admin.settings.general.phonePlaceholder")}
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
              {t("admin.settings.general.address")}
            </label>
            <input
              type="text"
              id="platformAddress"
              value={formData.platformAddress}
              onChange={handleInputChange}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder={t("admin.settings.general.addressPlaceholder")}
            />
          </div>

          <div>
            <label
              htmlFor="platformCurrency"
              className="mb-1.5 block text-sm font-medium text-muted-foreground"
            >
              {t("admin.settings.general.defaultCurrency")}
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
              {t("admin.settings.general.saving")}
            </>
          ) : (
            t("admin.settings.general.saveChanges")
          )}
        </button>
      </div>
    </div>
  )
}

export default GeneralInformation
