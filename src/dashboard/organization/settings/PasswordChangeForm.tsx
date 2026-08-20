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
    setError,
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
    } catch (error: unknown) {
      // A Zod validation failure's top-level message is always the generic
      // "Validation Error" -- the backend's real password rule (10+ chars,
      // a letter, a number, account.validation.ts's passwordSchema) only
      // shows up in errorSources. Same pattern SignUpModal.tsx already
      // uses instead of an unhelpful generic toast.
      const apiError = error as {
        status?: number
        data?: {
          message?: string
          errorSources?: Array<{ path?: string; message?: string }>
        }
      }
      const passwordError = apiError?.data?.errorSources?.find(
        (source) => source.path === "newPassword" && source.message,
      )
      if (passwordError?.message) {
        setError("newPassword", { type: "server", message: passwordError.message })
        return
      }
      // A 401 here is ambiguous server-side (account.service.ts throws the
      // same status for "wrong current password" and this component can't
      // tell that apart from a genuinely expired session, since baseApi.ts
      // deliberately excludes /auth/* routes from the app's normal
      // expired-session redirect). Surfacing the backend's own message
      // (e.g. "Incorrect password") is still correct for the common case;
      // only the truly-expired-session case would show a slightly
      // misleading message, which reloading/re-navigating self-corrects.
      toast.error(
        apiError?.data?.message ??
          t("organization.settings.passwordChange.failedMessage"),
      )
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        {t("organization.settings.passwordChange.heading")}
      </h2>
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
            {t("organization.settings.passwordChange.oldPasswordLabel")}
          </label>
          <input
            id="oldPassword"
            type="password"
            autoComplete="current-password"
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
            {t("organization.settings.passwordChange.newPasswordLabel")}
          </label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...register("newPassword", {
              required: t("organization.settings.passwordChange.newPasswordReqText"),
              // Matches the backend's real rule (account.validation.ts's
              // passwordSchema). See onSubmit's catch block for the
              // errorSources fallback that catches the letter/number half.
              minLength: {
                value: 10,
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
            {t("organization.settings.passwordChange.confirmPasswordLabel")}
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
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
          className="focus-ring rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading
            ? t("organization.settings.passwordChange.submittingLabel")
            : t("organization.settings.passwordChange.submitLabel")}
        </button>
      </form>
    </div>
  )
}
