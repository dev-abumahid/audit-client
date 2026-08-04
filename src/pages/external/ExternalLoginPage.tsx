import logo from "@/assets/images/logo.png"
import {
  useRequestExternalCodeMutation,
  useVerifyExternalCodeMutation,
} from "@/redux/apis/externalAuth.api"
import { useAppDispatch } from "@/redux/hooks"
import { setExternalUser } from "@/redux/slices/externalUser.slice"
import { XCircle } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"

interface EmailFormValues {
  email: string
}

interface CodeFormValues {
  code: string
}

// Full page, not a modal -- reached via a link an admin sends out of band
// (there's no in-app "External sign in" entry point to open a modal from),
// same convention as ResetPasswordPage.tsx.
export default function ExternalLoginPage() {
  const { organizationId } = useParams<{ organizationId: string }>()
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const [requestCode, { isLoading: isRequesting }] =
    useRequestExternalCodeMutation()
  const [verifyCode, { isLoading: isVerifying }] =
    useVerifyExternalCodeMutation()

  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const emailForm = useForm<EmailFormValues>({ defaultValues: { email: "" } })
  const codeForm = useForm<CodeFormValues>({ defaultValues: { code: "" } })

  const onSubmitEmail = async (data: EmailFormValues) => {
    if (!organizationId) return
    try {
      await requestCode({ organizationId, email: data.email }).unwrap()
      // Always resolves regardless of whether the email is real/active
      // (anti-enumeration) -- there is no success/failure branch to show.
      setPendingEmail(data.email)
      toast.success(t("externalAuth.login.codeSentToast"))
    } catch {
      // request-code has no documented failure path besides rate limiting
      // (429) -- a generic message covers both that and anything unexpected.
      toast.error(t("externalAuth.login.requestFailed"))
    }
  }

  const onSubmitCode = async (data: CodeFormValues) => {
    if (!organizationId || !pendingEmail) return
    try {
      const res = await verifyCode({
        organizationId,
        email: pendingEmail,
        code: data.code,
      }).unwrap()
      dispatch(
        setExternalUser({
          externalOrgMemberId: res.data.externalOrgMemberId,
          organizationId,
          email: res.data.email,
          fullName: res.data.fullName,
        })
      )
      navigate("/external")
    } catch {
      // Every failure mode (wrong code, expired, locked out, unknown member)
      // is a generic 401 by design -- see externalAuth.api.ts's own comment.
      // Deliberately not distinguishing lockout from a plain wrong code here.
      toast.error(t("externalAuth.login.verifyFailed"))
    }
  }

  const handleResend = async () => {
    if (!organizationId || !pendingEmail) return
    try {
      await requestCode({ organizationId, email: pendingEmail }).unwrap()
      toast.success(t("externalAuth.login.codeSentToast"))
      codeForm.reset()
    } catch {
      toast.error(t("externalAuth.login.requestFailed"))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl md:max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={logo}
            alt={t("externalAuth.login.logoAlt")}
            className="mb-4 h-14 w-14"
          />
          <h1 className="text-lg font-semibold text-foreground">
            {t("externalAuth.login.title")}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("externalAuth.login.subTitle")}
          </p>
        </div>

        {!organizationId ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {t("externalAuth.login.invalidLink")}
            </p>
            <Link
              to="/"
              className="mt-2 text-sm font-medium text-primary hover:underline"
            >
              {t("externalAuth.login.btnGoHome")}
            </Link>
          </div>
        ) : !pendingEmail ? (
          // noValidate: the email input is type="email", and without this the
          // browser's own constraint validation intercepts the submit event
          // for any format it considers invalid before handleSubmit ever
          // runs -- silently short-circuiting the react-hook-form `pattern`
          // rule below (and its message), letting the browser's native/OS
          // locale error tooltip leak in over the app's i18n error message.
          // Same fix as SignInModal/SignUpModal's equivalent fields
          // (aexa-frontend#448).
          <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} noValidate>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  {t("externalAuth.login.emailLabel")}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...emailForm.register("email", {
                    required: t("externalAuth.login.emailRequired"),
                    pattern: {
                      value: /^\S+@\S+\.\S+$/,
                      message: t("externalAuth.login.emailInvalid"),
                    },
                  })}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                  disabled={isRequesting}
                />
                {emailForm.formState.errors.email && (
                  <p className="mt-1 text-xs text-destructive">
                    {emailForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isRequesting}
                className="flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRequesting
                  ? t("externalAuth.login.sending")
                  : t("externalAuth.login.btnSendCode")}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={codeForm.handleSubmit(onSubmitCode)}>
            <p className="mb-1 text-center text-sm text-muted-foreground">
              {t("externalAuth.login.codeSubTitle")}
            </p>
            <p className="mb-6 text-center text-sm font-medium text-foreground">
              {pendingEmail}
            </p>

            <label
              htmlFor="code"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              {t("externalAuth.login.codeLabel")}
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              {...codeForm.register("code", {
                required: t("externalAuth.login.codeRequired"),
                pattern: {
                  value: /^\d{6}$/,
                  message: t("externalAuth.login.codeLength"),
                },
              })}
              placeholder="123456"
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-center text-sm tracking-widest text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
              disabled={isVerifying}
            />
            {codeForm.formState.errors.code && (
              <p className="mt-1 text-xs text-destructive">
                {codeForm.formState.errors.code.message}
              </p>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="mt-4 flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isVerifying
                ? t("externalAuth.login.verifying")
                : t("externalAuth.login.btnVerify")}
            </button>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              {t("externalAuth.login.noCodeText")}{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={isRequesting}
                className="font-medium text-primary hover:underline disabled:opacity-50"
              >
                {isRequesting
                  ? t("externalAuth.login.resending")
                  : t("externalAuth.login.btnResend")}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
