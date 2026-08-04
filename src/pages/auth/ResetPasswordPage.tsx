/* eslint-disable @typescript-eslint/no-explicit-any */
import logo from "@/assets/images/logo.png"
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
    } catch (error: any) {
      toast.error(error?.data?.message || t("auth.genericError"))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl md:max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={logo}
            alt={t("auth.resetPassword.logoAlt")}
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
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  {...register("newPassword", {
                    required: t("auth.resetPassword.newPasswordReqText"),
                    minLength: {
                      value: 8,
                      message: t("auth.resetPassword.newPasswordMinLength"),
                    },
                  })}
                  placeholder="********"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                  disabled={isSubmitting}
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
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  {t("auth.resetPassword.confirmPassword")}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  {...register("confirmPassword", {
                    required: t("auth.resetPassword.confirmPasswordReqText"),
                    validate: (value) =>
                      value === watch("newPassword") ||
                      t("auth.resetPassword.passwordMismatch"),
                  })}
                  placeholder="********"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                  disabled={isSubmitting}
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-destructive">
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
