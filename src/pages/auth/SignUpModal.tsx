import { useSignUpUserMutation } from "@/redux/apis/auth.api"
import { X } from "lucide-react"
import React from "react"
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
    const res = await createNewOrganization(payload).unwrap()
    if (res?.success) {
      toast.success(res?.message)
      onClose()
      onLoginClick()
    } else {
      toast.error(res?.error?.message)
    }
  }

  const handleClearForm = () => {
    reset()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal Content - Using your theme variables */}
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl md:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
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
                  onClose()
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
