/* eslint-disable @typescript-eslint/no-explicit-any */
import { useUpdateProfileMutation } from "@/redux/apis/profile.api"
import { Upload } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

interface PersonalInfoFormData {
  fullName: string
}

interface PersonalInfoFormProps {
  initialFullName: string
  profilePhoto?: string
}

export default function PersonalInfoForm({
  initialFullName,
  profilePhoto,
}: PersonalInfoFormProps) {
  const { t } = useTranslation()
  const [updateProfile, { isLoading }] = useUpdateProfileMutation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<PersonalInfoFormData>({
    defaultValues: { fullName: initialFullName },
  })

  // Revoke the previous object URL whenever it's replaced (a new file is
  // chosen, the form unmounts) — createObjectURL holds a reference to the
  // File's blob until explicitly revoked, otherwise it leaks memory.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error(t("organization.personalInfo.chooseImage"))
      return
    }
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const onSubmit = async (data: PersonalInfoFormData) => {
    try {
      const formData = new FormData()
      formData.append("data", JSON.stringify({ fullName: data.fullName }))
      if (selectedFile) {
        formData.append("file", selectedFile)
      }
      await updateProfile(formData).unwrap()
      toast.success(t("organization.personalInfo.updateSuccess"))
      setSelectedFile(null)
      setPreviewUrl(null)
      // Re-baseline isDirty against what was just saved — without this,
      // isDirty stays true for the rest of the component's lifetime (it's
      // computed against the defaultValues captured at mount, not the
      // current server value), so Save Changes would look perpetually
      // "unsaved" immediately after a successful save. Found by
      // independent review.
      reset({ fullName: data.fullName })
    } catch (error: any) {
      toast.error(
        error?.data?.message ?? t("organization.personalInfo.updateFailed")
      )
    }
  }

  const avatarSrc = previewUrl ?? profilePhoto

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        {t("organization.personalInfo.heading")}
      </h2>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        aria-label={t("organization.personalInfo.formLabel")}
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-primary/10">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={t("organization.personalInfo.profilePhotoAlt")}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-primary">
                  {initialFullName?.[0]?.toUpperCase() ?? "?"}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleAvatarClick}
              aria-label={t("organization.personalInfo.changePhoto")}
              disabled={isLoading}
              className="absolute right-0 bottom-0 rounded-full bg-primary p-1.5 text-primary-foreground shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload size={12} />
            </button>
            {/* Disabled while a save is in flight — without this, picking a
                new file mid-submit races the in-flight request's success
                handler, which unconditionally clears selectedFile/previewUrl
                and silently drops the second selection. Found by
                independent review. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-label={t("organization.personalInfo.uploadPhoto")}
              onChange={handleFileChange}
              disabled={isLoading}
              className="hidden"
            />
          </div>
          {selectedFile && (
            <span className="text-xs text-muted-foreground">
              {t("organization.personalInfo.fileSelected", {
                name: selectedFile.name,
              })}
            </span>
          )}
        </div>

        <div>
          <label
            htmlFor="fullName"
            className="mb-1.5 block text-sm font-medium text-muted-foreground"
          >
            {t("organization.personalInfo.fullName")}
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            {...register("fullName", {
              required: t("organization.personalInfo.fullNameRequired"),
            })}
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
            disabled={isLoading}
          />
          {errors.fullName && (
            <p className="mt-1 text-xs text-destructive">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || (!isDirty && !selectedFile)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading
            ? t("organization.personalInfo.saving")
            : t("organization.personalInfo.saveChanges")}
        </button>
      </form>
    </div>
  )
}
