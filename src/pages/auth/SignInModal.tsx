import { X } from "lucide-react"
import React from "react"
import { useForm } from "react-hook-form"

interface SignInFormData {
  email: string
  password: string
}

interface SignInModalProps {
  isOpen: boolean
  onClose: () => void
  onSignUpClick: () => void
  onForgotPasswordClick?: () => void
}

const SignInModal: React.FC<SignInModalProps> = ({
  isOpen,
  onClose,
  onSignUpClick,
  onForgotPasswordClick,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (data: SignInFormData) => {
    const payload = {
      email: data.email,
      password: data.password,
    }
    console.log(payload)
    //login logic here
  }

  const handleForgotPassword = () => {
    onClose()
    onForgotPasswordClick?.()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal Content */}
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl md:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          disabled={isSubmitting}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-1 text-center">
          <div className="mb-2">
            <h1 className="text-xl font-bold">
              <span className="text-primary">L</span>
              <span className="text-foreground">ogo</span>
            </h1>
          </div>

          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Welcome Back 👋
          </h2>
          <p className="mb-6 text-xs text-muted-foreground">
            Sign in to your account
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6">
          <div className="space-y-4">
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Email / Phone Number
              </label>
              <input
                id="email"
                type="text"
                {...register("email", {
                  required: "Email or phone number is required",
                })}
                placeholder="Enter email or phone number"
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                {...register("password", {
                  required: "Password is required",
                })}
                placeholder="Enter password"
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-muted-foreground transition-colors hover:text-primary hover:underline"
                disabled={isSubmitting}
              >
                Forgot Password?
              </button>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </button>

            {/* Sign Up Link */}
            <div className="border-t border-border pt-4">
              <p className="text-center text-xs text-muted-foreground">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onSignUpClick()
                  }}
                  className="font-medium text-primary hover:underline focus:outline-none"
                  disabled={isSubmitting}
                >
                  Sign Up
                </button>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SignInModal
