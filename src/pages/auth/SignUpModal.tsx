import { useSignUpUserMutation } from "@/redux/apis/auth.api"
import { X } from "lucide-react"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

interface SignUpFormData {
  organizationName: string
  email: string
  password: string
}

interface SignUpModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginClick: () => void
}

const SignUpModal: React.FC<SignUpModalProps> = ({
  isOpen,
  onClose,
  onLoginClick,
}) => {
  const { t } = useTranslation()
  const [createNewOrganization, { isLoading }] = useSignUpUserMutation()
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const {
    register: formRegister,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SignUpFormData>({
    defaultValues: {
      organizationName: "",
      email: "",
      password: "",
    },
  })

  const onSubmit = async (data: SignUpFormData) => {
    const payload = {
      organizationName: data.organizationName,
      email: data.email,
      password: data.password,
    }
    try {
      const res = await createNewOrganization(payload).unwrap()
      if (res?.success) {
        toast.success(res?.message)
        setPendingEmail(data.email)
        reset()
      } else {
        toast.error(res?.error?.message)
      }
    } catch (error: unknown) {
      const msg = (error as { data?: { message?: string } })?.data?.message
      toast.error(msg ?? "Registration failed")
    }
  }

  const handleClearForm = () => {
    reset()
  }

  const handleClose = () => {
    setPendingEmail(null)
    onClose()
  }

  if (!isOpen) return null

  // Verify-email confirmation screen
  if (pendingEmail) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={handleClose}
      >
        <div
          className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl md:max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
          <div className="px-6 py-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Check your email</h2>
            <p className="mb-1 text-sm text-muted-foreground">
              We sent a verification code to
            </p>
            <p className="mb-6 text-sm font-medium text-foreground">{pendingEmail}</p>
            <p className="text-xs text-muted-foreground">
              Enter the code in the email to activate your account, then{" "}
              <button
                onClick={() => { handleClose(); onLoginClick() }}
                className="font-medium text-primary hover:underline"
              >
                sign in
              </button>
              .
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl md:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          disabled={isLoading}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-1">
          <h2 className="mb-1 text-center text-lg font-bold text-foreground">
            {t("auth.signUp.title")}
          </h2>
          <p className="mb-4 text-center text-xs text-muted-foreground">
            {t("auth.signUp.subTitle")}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6">
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
                {...formRegister("organizationName", {
                  required: "Organization name is required",
                })}
                placeholder="Example Organization"
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                disabled={isLoading}
              />
              {errors.organizationName && (
                <p className="mt-1 text-xs text-destructive">
                  {t("auth.signUp.organizationNameReqText")}
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
                {...formRegister("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: "Please enter a valid email",
                  },
                })}
                placeholder="example@email.com"
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                disabled={isLoading}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-destructive">
                  {t("auth.signUp.emailReqText")}
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
              <input
                id="password"
                type="password"
                {...formRegister("password", {
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                })}
                placeholder="********"
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                disabled={isLoading}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">
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
                    Signing Up...
                  </>
                ) : (
                  t("auth.signUp.btnSignUp")
                )}
              </button>
            </div>
          </div>

          {/* Sign In Link */}
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-center text-xs text-muted-foreground">
              {t("auth.signUp.hintText")}{" "}
              <button
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
      </div>
    </div>
  )
}

export default SignUpModal
