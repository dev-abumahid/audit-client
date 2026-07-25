/* eslint-disable @typescript-eslint/no-explicit-any */
import { useChangePasswordMutation } from "@/redux/apis/auth.api"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

interface PasswordChangeFormData {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

export default function PasswordChangeForm() {
  const { t } = useTranslation()
  const [changePassword, { isLoading }] = useChangePasswordMutation()
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PasswordChangeFormData>({
    defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
  })

  const onSubmit = async (data: PasswordChangeFormData) => {
    try {
      await changePassword({
        oldPassword: data.oldPassword,
        newPassword: data.newPassword,
      }).unwrap()
      toast.success(t("organization.settings.passwordChange.successMessage"))
      reset()
    } catch (error: any) {
      // Surfaces the backend's specific messages as-is (e.g. "Incorrect
      // password", "Old and new password are same, Please provide
      // different password") rather than a generic failure string.
      toast.error(
        error?.data?.message ??
          t("organization.settings.passwordChange.failedMessage"),
      )
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Change Password
      </h3>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="max-w-sm space-y-4"
        aria-label={t("organization.settings.passwordChange.formAriaLabel")}
      >
        <div>
          <label
            htmlFor="oldPassword"
            className="mb-1.5 block text-sm font-medium text-muted-foreground"
          >
            Current Password
          </label>
          <input
            id="oldPassword"
            type="password"
            {...register("oldPassword", {
              required: t("organization.settings.passwordChange.oldPasswordReqText"),
            })}
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
            disabled={isLoading}
          />
          {errors.oldPassword && (
            <p className="mt-1 text-xs text-destructive">
              {errors.oldPassword.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="newPassword"
            className="mb-1.5 block text-sm font-medium text-muted-foreground"
          >
            New Password
          </label>
          <input
            id="newPassword"
            type="password"
            {...register("newPassword", {
              required: t("organization.settings.passwordChange.newPasswordReqText"),
              minLength: {
                value: 8,
                message: t("auth.resetPassword.newPasswordMinLength"),
              },
            })}
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
            disabled={isLoading}
          />
          {errors.newPassword && (
            <p className="mt-1 text-xs text-destructive">
              {errors.newPassword.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-sm font-medium text-muted-foreground"
          >
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            {...register("confirmPassword", {
              required: t(
                "organization.settings.passwordChange.confirmPasswordReqText",
              ),
              validate: (value) =>
                value === watch("newPassword") ||
                t("auth.resetPassword.passwordMismatch"),
            })}
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
            disabled={isLoading}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Changing..." : "Change Password"}
        </button>
      </form>
    </div>
  )
}
