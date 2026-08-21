import { cn } from "@/lib/utils"
import { Eye, EyeOff } from "lucide-react"
import React, { forwardRef, useState } from "react"
import { useTranslation } from "react-i18next"

// Shared show/hide-password field used by every password <input> in the app
// (SignInModal, SignUpModal, ResetPasswordPage, PasswordChangeForm). Fixes an
// app-wide gap found by the password-implementation audit: none of the 6+
// password inputs had a way to reveal what was typed. Renders the same
// visual style those forms already used inline for a bare
// <input type="password">, plus a toggle button.
//
// The toggle is type="button" so it never submits the surrounding
// react-hook-form <form>, and its aria-label swaps between
// "Show password"/"Hide password" (via i18n) as state changes, so a
// screen-reader user always hears the action the button is about to take,
// not just a static "toggle" label.
type PasswordInputProps = Omit<React.ComponentProps<"input">, "type">

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const { t } = useTranslation()
    const [isVisible, setIsVisible] = useState(false)

    return (
      <div className="relative">
        <input
          ref={ref}
          type={isVisible ? "text" : "password"}
          disabled={disabled}
          className={cn(
            "w-full rounded-lg border border-border bg-input px-3 py-2.5 pr-10 text-sm text-foreground placeholder-muted-foreground transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50",
            className
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setIsVisible((prev) => !prev)}
          disabled={disabled}
          aria-label={
            isVisible ? t("common.hidePassword") : t("common.showPassword")
          }
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export default PasswordInput
