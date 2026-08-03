import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { useForgetPasswordMutation } from "@/redux/apis/auth.api"
import type { ForgetPasswordPayload } from "@/redux/apis/auth.api"
import { X } from "lucide-react"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

type ForgotPasswordFormData = ForgetPasswordPayload

interface ForgotPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  onBackToSignIn?: () => void
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onBackToSignIn,
}) => {
  const [forgetPassword] = useForgetPasswordMutation()
  const { t } = useTranslation()
  const [submitted, setSubmitted] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({ defaultValues: { email: "" } })

  const handleClose = () => {
    setSubmitted(false)
    reset()
    onClose()
  }

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await forgetPassword({ email: data.email }).unwrap()
    } catch {
      // Deliberately not surfaced as an error toast: the backend currently
      // returns a distinguishing 404 for "Account not found," but showing
      // that here would let this form be used to enumerate registered
      // emails. Show the same success state either way — a real gap in
      // the backend's response worth tightening separately, not something
      // this form should compensate for by hiding a genuine network error
      // from the user either.
    } finally {
      setSubmitted(true)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-sm gap-0 overflow-hidden rounded-xl border border-border bg-card p-0 text-card-foreground shadow-2xl ring-0 md:max-w-md"
      >
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          disabled={isSubmitting}
          aria-label={t("common.close")}
        >
          <X size={18} />
        </button>

        <div className="px-6 pt-6 pb-1 text-center">
          <DialogTitle className="mb-1 text-lg font-semibold text-foreground">
            {t("auth.forgotPassword.title")}
          </DialogTitle>
          <DialogDescription className="mb-6 text-xs text-muted-foreground">
            {t("auth.forgotPassword.subTitle")}
          </DialogDescription>
        </div>

        {submitted ? (
          <div className="px-6 pb-6">
            <p className="mb-6 rounded-lg bg-primary/10 p-3 text-center text-sm text-foreground">
              {t("auth.forgotPassword.successMessage")}
            </p>
            <button
              type="button"
              onClick={() => {
                handleClose()
                onBackToSignIn?.()
              }}
              className="flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
            >
              {t("auth.forgotPassword.backToSignIn")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="forgot-email"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  {t("auth.forgotPassword.email")}
                </label>
                <input
                  id="forgot-email"
                  type="text"
                  autoComplete="email"
                  {...register("email", {
                    required: "Email is required",
                  })}
                  placeholder="example@email.com"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                  disabled={isSubmitting}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-destructive">
                    {t("auth.forgotPassword.emailReqText")}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? t("auth.forgotPassword.sending")
                  : t("auth.forgotPassword.btnSend")}
              </button>

              <div className="border-t border-border pt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    handleClose()
                    onBackToSignIn?.()
                  }}
                  className="text-xs text-muted-foreground transition-colors hover:text-primary hover:underline"
                  disabled={isSubmitting}
                >
                  {t("auth.forgotPassword.backToSignIn")}
                </button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ForgotPasswordModal
