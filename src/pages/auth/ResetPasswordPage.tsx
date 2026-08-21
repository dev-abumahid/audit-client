import Logo from "@/components/shared/Logo"
import PasswordInput from "@/components/shared/PasswordInput"
import { useResetPasswordMutation } from "@/redux/apis/auth.api"
import { CheckCircle2, XCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router"
import { toast } from "sonner"

interface ResetPasswordFormData {
  newPassword: string
  confirmPassword: string
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")
  const [resetPassword, { isSuccess }] = useResetPasswordMutation()
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    watch,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    defaultValues: { newPassword: "", confirmPassword: "" },
  })

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) return
    try {
      const res = await resetPassword({
        token,
        newPass: data.newPassword,
      }).unwrap()
      if (res?.success !== false) {
        toast.success(t("auth.resetPassword.successMessage"))
      }
    } catch (error: unknown) {
      // The backend's real password rule (10+ chars, a letter, a number --
      // account.validation.ts's passwordSchema) is stricter than this
      // form's own minLength check below. A Zod failure's top-level
      // `message` is always the generic "Validation Error"; the actual
      // reason lives in `errorSources`, same shape SignUpModal.tsx already
      // maps into a field-level error instead of an unhelpful toast.
      const apiError = error as {
        data?: {
          message?: string
          errorSources?: Array<{ path?: string; message?: string }>
        }
      }
      const passwordError = apiError?.data?.errorSources?.find(
        (source) => source.path === "newPass" && source.message
      )
      if (passwordError?.message) {
        setError("newPassword", { type: "server", message: passwordError.message })
        // react-hook-form's shouldFocusError default only covers
        // client-triggered validation, not this manual setError() call for
        // a server-side password rule -- without this, a keyboard/screen-
        // reader user has to tab-hunt to find where the error landed.
        setFocus("newPassword")
      } else {
        toast.error(apiError?.data?.message || t("auth.genericError"))
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl md:max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo
            role="img"
            aria-hidden={undefined}
            aria-label={t("auth.resetPassword.logoAlt")}
            className="mb-4 h-14 w-14"
          />
          <h1 className="text-lg font-semibold text-foreground">
            {t("auth.resetPassword.title")}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("auth.resetPassword.subTitle")}
          </p>
        </div>

        {!token ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {t("auth.resetPassword.invalidLink")}
            </p>
            <Link
              to="/"
              className="mt-2 text-sm font-medium text-primary hover:underline"
            >
              {t("auth.resetPassword.btnGoToSignIn")}
            </Link>
          </div>
        ) : isSuccess ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <p className="text-sm text-muted-foreground">
              {t("auth.resetPassword.successMessage")}
            </p>
            <Link
              to="/"
              className="mt-2 flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
            >
              {t("auth.resetPassword.btnGoToSignIn")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="newPassword"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  {t("auth.resetPassword.newPassword")}
                </label>
                <PasswordInput
                  id="newPassword"
                  autoComplete="new-password"
                  {...register("newPassword", {
                    required: t("auth.resetPassword.newPasswordReqText"),
                    // Matches the backend's real rule (account.validation.ts's
                    // passwordSchema: 10+ chars, a letter, a number). The
                    // letter/number half isn't duplicated here -- same
                    // "server round-trip via errorSources" pattern
                    // SignUpModal.tsx already uses -- but the length check
                    // catches the single most common failure instantly
                    // instead of always requiring a round trip.
                    minLength: {
                      value: 10,
                      message: t("auth.resetPassword.newPasswordMinLength"),
                    },
                  })}
                  placeholder="********"
                  disabled={isSubmitting}
                  aria-invalid={errors.newPassword ? true : undefined}
                  aria-describedby={
                    errors.newPassword ? "newPassword-error" : undefined
                  }
                />
                {errors.newPassword && (
                  <p
                    id="newPassword-error"
                    role="alert"
                    className="mt-1 text-xs text-destructive"
                  >
                    {errors.newPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  {t("auth.resetPassword.confirmPassword")}
                </label>
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  {...register("confirmPassword", {
                    required: t("auth.resetPassword.confirmPasswordReqText"),
                    validate: (value) =>
                      value === watch("newPassword") ||
                      t("auth.resetPassword.passwordMismatch"),
                  })}
                  placeholder="********"
                  disabled={isSubmitting}
                  aria-invalid={errors.confirmPassword ? true : undefined}
                  aria-describedby={
                    errors.confirmPassword ? "confirmPassword-error" : undefined
                  }
                />
                {errors.confirmPassword && (
                  <p
                    id="confirmPassword-error"
                    role="alert"
                    className="mt-1 text-xs text-destructive"
                  >
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? t("auth.resetPassword.resetting")
                  : t("auth.resetPassword.btnReset")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
