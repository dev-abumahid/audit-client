import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import PasswordInput from "@/components/shared/PasswordInput"
import {
  useResendOtpMutation,
  useSignUpUserMutation,
  useVerifyOtpMutation,
} from "@/redux/apis/auth.api"
import type { SignUpPayload } from "@/redux/apis/auth.api"
import { X } from "lucide-react"
import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import SocialLoginButtons from "./SocialLoginButtons"

type SignUpFormData = SignUpPayload

// Client-side rate limit for "Resend Code" -- purely a UX guard against
// accidental double-clicks/spam, not a substitute for server-side throttling
// (aexa-frontend#444).
const RESEND_OTP_COOLDOWN_SECONDS = 30

interface OtpFormData {
  otp: string
}

interface SignUpModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginClick: () => void
  // See the matching comment in SignInModal.tsx -- restores focus to the
  // element that opened this modal on close (aexa-frontend#477).
  triggerRef?: React.RefObject<HTMLElement | null>
}

const SignUpModal: React.FC<SignUpModalProps> = ({
  isOpen,
  onClose,
  onLoginClick,
  triggerRef,
}) => {
  const { t } = useTranslation()
  const [createNewOrganization, { isLoading }] = useSignUpUserMutation()
  const [verifyOtp, { isLoading: isVerifying }] = useVerifyOtpMutation()
  const [resendOtp, { isLoading: isResending }] = useResendOtpMutation()
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [resendCooldown])

  const {
    register: formRegister,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<SignUpFormData>({
    defaultValues: {
      organizationName: "",
      email: "",
      password: "",
    },
  })

  const {
    register: registerOtp,
    handleSubmit: handleOtpSubmit,
    reset: resetOtpForm,
    formState: { errors: otpErrors },
  } = useForm<OtpFormData>({ defaultValues: { otp: "" } })

  const onSubmitOtp = async (data: OtpFormData) => {
    if (!pendingEmail) return
    try {
      await verifyOtp({ email: pendingEmail, otp: data.otp }).unwrap()
      toast.success(t("auth.verifyOtp.successMessage"))
      setIsVerified(true)
    } catch (error: unknown) {
      const msg = (error as { data?: { message?: string } })?.data?.message
      toast.error(msg ?? t("auth.genericError"))
    }
  }

  const handleResendOtp = async () => {
    if (!pendingEmail || resendCooldown > 0) return
    try {
      await resendOtp({ email: pendingEmail }).unwrap()
      toast.success(t("auth.verifyOtp.resendSuccess"))
      resetOtpForm()
      setResendCooldown(RESEND_OTP_COOLDOWN_SECONDS)
    } catch (error: unknown) {
      const msg = (error as { data?: { message?: string } })?.data?.message
      toast.error(msg ?? t("auth.genericError"))
    }
  }

  const onSubmit = async (data: SignUpFormData) => {
    const payload = {
      organizationName: data.organizationName,
      email: data.email,
      password: data.password,
    }
    try {
      // manageResponse always sets `success: true` for this endpoint, and
      // .unwrap() throws (caught below) on any non-2xx response -- so a
      // resolved `res` here is always a success. The previous `else` branch
      // read `res.error.message`, a key ApiResponse's envelope never has;
      // it was unreachable dead code, not a real fallback. Found while
      // typing this endpoint (issue #108).
      const res = await createNewOrganization(payload).unwrap()
      toast.success(res.message)
      setPendingEmail(data.email)
      reset()
    } catch (error: unknown) {
      const apiError = error as {
        data?: {
          message?: string
          errorSources?: Array<{ path?: string; message?: string }>
        }
      }
      const errorSources = apiError?.data?.errorSources ?? []
      const knownFields: Array<keyof SignUpFormData> = [
        "organizationName",
        "email",
        "password",
      ]

      // Only entries whose `path` is a field this form actually renders can
      // be surfaced via setError -- anything else (an unrecognized path, or
      // a source missing path/message) would silently vanish with no
      // visible error at all, which is worse than the generic toast this
      // fix replaces. Unmapped entries are collected and toasted too, so a
      // mix of one known-field error and one unrecognized one doesn't lose
      // the unrecognized one just because the known one already rendered.
      let mappedAny = false
      let passwordFieldErrored = false
      const unmapped: string[] = []
      errorSources.forEach(({ path, message }) => {
        if (!path || !message) return
        if ((knownFields as string[]).includes(path)) {
          setError(path as keyof SignUpFormData, {
            type: "server",
            message,
          })
          mappedAny = true
          if (path === "password") passwordFieldErrored = true
        } else {
          unmapped.push(message)
        }
      })

      // react-hook-form's shouldFocusError default only covers
      // client-triggered validation, not a manual setError() call like the
      // one above for a server-side password rule -- without this, a
      // keyboard/screen-reader user has to tab-hunt to find the field the
      // error actually landed on.
      if (passwordFieldErrored) {
        setFocus("password")
      }

      if (unmapped.length > 0) {
        toast.error(unmapped.join(" "))
      } else if (!mappedAny) {
        toast.error(apiError?.data?.message ?? t("auth.genericError"))
      }
    }
  }

  const handleClearForm = () => {
    reset()
  }

  const handleClose = () => {
    setPendingEmail(null)
    setIsVerified(false)
    setResendCooldown(0)
    resetOtpForm()
    onClose()
  }

  const closeButton = (
    <button
      type="button"
      onClick={handleClose}
      aria-label={t("common.close")}
      className="absolute top-3 right-3 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      disabled={!pendingEmail && isLoading}
    >
      <X size={18} />
    </button>
  )

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          // See the matching comment in SignInModal.tsx.
          if (triggerRef?.current && document.contains(triggerRef.current)) {
            event.preventDefault()
            triggerRef.current.focus()
          }
        }}
        className="w-full max-w-sm gap-0 overflow-hidden rounded-xl border border-border bg-card p-0 text-card-foreground shadow-2xl ring-0 md:max-w-md"
      >
        {/* Verify-email confirmation screen */}
        {pendingEmail ? (
          <>
            {closeButton}
            <div className="px-6 py-10 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <svg
                  className="h-6 w-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <DialogTitle className="mb-2 text-lg font-semibold text-foreground">
                {isVerified
                  ? t("auth.verifyOtp.verifiedTitle")
                  : t("auth.verifyOtp.title")}
              </DialogTitle>

              {isVerified ? (
                <>
                  <DialogDescription className="mb-6 text-sm text-muted-foreground">
                    {t("auth.verifyOtp.verifiedSubTitle")}
                  </DialogDescription>
                  <button
                    type="button"
                    onClick={() => {
                      handleClose()
                      onLoginClick()
                    }}
                    className="flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
                  >
                    {t("auth.signIn.btnSignIn")}
                  </button>
                </>
              ) : (
                <>
                  <DialogDescription className="mb-1 text-sm text-muted-foreground">
                    {t("auth.verifyOtp.subTitle")}
                  </DialogDescription>
                  <p className="mb-6 text-sm font-medium text-foreground">
                    {pendingEmail}
                  </p>

                  <form
                    onSubmit={handleOtpSubmit(onSubmitOtp)}
                    className="text-left"
                  >
                    <label
                      htmlFor="otp"
                      className="mb-1.5 block text-xs font-medium text-muted-foreground"
                    >
                      {t("auth.verifyOtp.codeLabel")}
                    </label>
                    <input
                      id="otp"
                      type="text"
                      autoComplete="one-time-code"
                      maxLength={6}
                      {...registerOtp("otp", {
                        required: t("auth.verifyOtp.codeReqText"),
                        minLength: {
                          value: 6,
                          message: t("auth.verifyOtp.codeLength"),
                        },
                        // No maxLength validator here: the native maxLength={6}
                        // attribute above already prevents typing a 7th
                        // character, so an RHF maxLength rule could never fire.
                      })}
                      placeholder="A1b2C3"
                      className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-center text-sm tracking-widest text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                      disabled={isVerifying}
                    />
                    {otpErrors.otp && (
                      <p className="mt-1 text-xs text-destructive">
                        {otpErrors.otp.message}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isVerifying}
                      className="mt-4 flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isVerifying
                        ? t("auth.verifyOtp.verifying")
                        : t("auth.verifyOtp.btnVerify")}
                    </button>
                  </form>

                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    {t("auth.verifyOtp.noCodeText")}{" "}
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isResending || resendCooldown > 0}
                      className="font-medium text-primary hover:underline disabled:opacity-50"
                    >
                      {isResending
                        ? t("auth.verifyOtp.resending")
                        : resendCooldown > 0
                          ? t("auth.verifyOtp.resendCountdown", {
                              seconds: resendCooldown,
                            })
                          : t("auth.verifyOtp.btnResend")}
                    </button>
                  </p>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {closeButton}

            {/* Modal Header */}
            <div className="px-6 pt-6 pb-1">
              <DialogTitle className="mb-1 text-center text-lg font-bold text-foreground">
                {t("auth.signUp.title")}
              </DialogTitle>
              <DialogDescription className="mb-4 text-center text-xs text-muted-foreground">
                {t("auth.signUp.subTitle")}
              </DialogDescription>
            </div>

            {/* Form */}
            {/* noValidate: the email input is type="email", and without this the
            browser's own constraint validation intercepts the submit event
            for any format it considers invalid before handleSubmit ever
            runs -- silently short-circuiting the react-hook-form `pattern`
            rule below (and its message) for every value a real user would
            actually trigger it with. Found while fixing the wrong-error-text
            bug on this field: the fix was a no-op without this. */}
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="px-6 pb-6"
            >
              <div className="space-y-3">
                {/* Organization Name */}
                <div>
                  <label
                    htmlFor="org_name"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    {t("auth.signUp.organizationName")}
                  </label>
                  <input
                    id="org_name"
                    type="text"
                    autoComplete="organization"
                    {...formRegister("organizationName", {
                      required: t("auth.signUp.organizationNameReqText"),
                    })}
                    placeholder={t("auth.signUp.organizationNamePlaceholder")}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                    disabled={isLoading}
                  />
                  {errors.organizationName && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.organizationName.message}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    {t("auth.signUp.email")}
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...formRegister("email", {
                      required: t("auth.signUp.emailReqText"),
                      pattern: {
                        value: /^\S+@\S+$/i,
                        message: t("auth.signUp.emailInvalidText"),
                      },
                    })}
                    placeholder="example@email.com"
                    className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                    disabled={isLoading}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    {t("auth.signUp.password")}
                  </label>
                  <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    {...formRegister("password", {
                      required: t("auth.signUp.passwordReqText"),
                      minLength: {
                        value: 10,
                        message: t("auth.signUp.passwordMinLengthReqText"),
                      },
                    })}
                    placeholder="********"
                    disabled={isLoading}
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                  />
                  {errors.password && (
                    <p
                      id="password-error"
                      role="alert"
                      className="mt-1 text-xs text-destructive"
                    >
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleClearForm}
                    disabled={isLoading}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("auth.signUp.btnClear")}
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex flex-1 items-center justify-center rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        {t("auth.signUp.signingUp")}
                      </>
                    ) : (
                      t("auth.signUp.btnSignUp")
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <SocialLoginButtons />
              </div>

              {/* Sign In Link */}
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-center text-xs text-muted-foreground">
                  {t("auth.signUp.hintText")}{" "}
                  {/* Round: type=button sweep finding -- this button sits
                      inside <form onSubmit={handleSubmit(onSubmit)}> above
                      (see the closing </form> further down) and had no
                      explicit type, so it defaulted to type="submit" -- a
                      real, live bug: clicking "Sign In" here could trigger
                      the signup form's own submit handler (if the fields
                      happened to pass validation) before onLoginClick()
                      ever navigated away, not just style inconsistency.
                      SignInModal.tsx's equivalent "Sign Up" link already
                      gets this right. */}
                  <button
                    type="button"
                    onClick={() => {
                      handleClose()
                      onLoginClick()
                    }}
                    className="font-medium text-primary hover:underline focus:outline-none"
                    disabled={isLoading}
                  >
                    {t("auth.signIn.btnSignIn")}
                  </button>
                </p>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default SignUpModal
