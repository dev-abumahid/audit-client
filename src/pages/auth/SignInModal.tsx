/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { useSignInUserMutation } from "@/redux/apis/auth.api"
import type { SignInPayload } from "@/redux/apis/auth.api"
import { baseApi } from "@/redux/baseApi"
import { useAppDispatch } from "@/redux/hooks"
import { setUser } from "@/redux/slices/user.slice"
import { X } from "lucide-react"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import SocialLoginButtons from "./SocialLoginButtons"

type SignInFormData = SignInPayload

interface SignInModalProps {
  isOpen: boolean
  onClose: () => void
  onSignUpClick: () => void
  onForgotPasswordClick?: () => void
  // The element that opened this modal (or, further back, the element that
  // started the sign-in/sign-up/forgot-password flow this modal is part
  // of). These modals are opened from plain onClick handlers rather than a
  // DialogPrimitive.Trigger, so Radix's own previously-focused-element
  // bookkeeping doesn't reliably land back on it -- restore explicitly via
  // onCloseAutoFocus below instead (aexa-frontend#477).
  triggerRef?: React.RefObject<HTMLElement | null>
}

const SignInModal: React.FC<SignInModalProps> = ({
  isOpen,
  onClose,
  onSignUpClick,
  onForgotPasswordClick,
  triggerRef,
}) => {
  const [signInUser] = useSignInUserMutation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()
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
    try {
      const payload = {
        email: data.email,
        password: data.password,
      }
      const res = await signInUser(payload).unwrap()
      if (res?.success) {
        // Clear any RTK Query cache left over from a previous account in
        // this tab before loading the new one in -- otherwise a quick
        // account switch within RTK Query's default 60s cache retention can
        // serve the previous user's cached data (aexa-frontend#249).
        dispatch(baseApi.util.resetApiState())
        dispatch(setUser(res?.data))
        toast.success(res?.message)
        navigate("/" + res?.data?.role?.toLowerCase())
      }
    } catch (error: any) {
      toast.error(error?.data?.message ?? t("auth.genericError"))
    }
  }

  const handleForgotPassword = () => {
    onClose()
    onForgotPasswordClick?.()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          // Only override Radix's default restoration when the trigger is
          // still attached to the document -- e.g. the mobile-menu variant
          // of this button unmounts itself on click, and calling .focus()
          // on a detached node is a silent no-op that would otherwise
          // suppress Radix's own (better-than-nothing) fallback behavior.
          if (triggerRef?.current && document.contains(triggerRef.current)) {
            event.preventDefault()
            triggerRef.current.focus()
          }
        }}
        className="w-full max-w-sm gap-0 overflow-hidden rounded-xl border border-border bg-card p-0 text-card-foreground shadow-2xl ring-0 md:max-w-md"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label={t("common.close")}
          className="absolute top-3 right-3 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          disabled={isSubmitting}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-1 text-center">
          <DialogTitle className="mb-1 text-lg font-semibold text-foreground">
            {t("auth.signIn.title")}
          </DialogTitle>
          <DialogDescription className="mb-6 text-xs text-muted-foreground">
            {t("auth.signIn.subTitle")}
          </DialogDescription>
        </div>

        {/* Form */}
        {/* noValidate: the email input is type="email", and without this the
            browser's own constraint validation intercepts the submit event
            for any format it considers invalid before handleSubmit ever
            runs -- silently short-circuiting the react-hook-form `pattern`
            rule below (and its message). Same fix as SignUpModal's
            equivalent field (aexa-frontend#448). */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="px-6 pb-6"
        >
          <div className="space-y-4">
            {/* Email Input */}
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
                {...register("email", {
                  required: t("auth.signUp.emailReqText"),
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: t("auth.signUp.emailInvalidText"),
                  },
                })}
                placeholder="example@email.com"
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
                {t("auth.signUp.password")}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password", {
                  required: t("auth.signUp.passwordReqText"),
                })}
                placeholder="********"
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">
                  {t("auth.signUp.passwordReqText")}
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
                {t("auth.signIn.btnForgotPassword")}
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
                  {t("auth.signIn.signingIn")}
                </>
              ) : (
                t("auth.signIn.btnSignIn")
              )}
            </button>

            <SocialLoginButtons />

            {/* Sign Up Link */}
            <div className="border-t border-border pt-4">
              <p className="text-center text-xs text-muted-foreground">
                {t("auth.signIn.hintText")}{" "}
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onSignUpClick()
                  }}
                  className="font-medium text-primary hover:underline focus:outline-none"
                  disabled={isSubmitting}
                >
                  {t("auth.signUp.btnSignUp")}
                </button>
              </p>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default SignInModal
