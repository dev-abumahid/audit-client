import ForgotPasswordModal from "@/pages/auth/ForgotPasswordModal"
import SignInModal from "@/pages/auth/SignInModal"
import SignUpModal from "@/pages/auth/SignUpModal"
import { ArrowRight, Mail } from "lucide-react"
import type { MouseEvent } from "react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

// Landing overhaul PR10: the final CTA slot the plan called for. Same
// Get Started / Contact Sales pattern HeroSection already establishes
// (same modal flow, same focus-return-to-trigger discipline per
// aexa-frontend#477) -- duplicated rather than lifted into shared state,
// matching this codebase's existing per-section modal-ownership
// convention (no shared auth-modal context exists to reuse instead).
//
// Quiet motion only, per the v3 motion plan: no entrance reveal, just
// hover/focus transitions on the buttons themselves.
//
// Review finding on PR #1022: the buttons' copy originally reused
// home.hero.btnStart/btnDemo directly -- if Hero's copy is retuned
// independently later, this section's button text would silently change
// too. Own dedicated home.finalCta.btnStart/btnContactSales keys instead,
// even though their initial values are identical to Hero's.
const FinalCTASection = () => {
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false)
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] =
    useState(false)
  const { t } = useTranslation()
  const authTriggerRef = useRef<HTMLElement | null>(null)

  const handleGetStartedClick = (e: MouseEvent<HTMLButtonElement>) => {
    authTriggerRef.current = e.currentTarget
    setIsSignUpModalOpen(true)
  }

  const handleCloseSignUpModal = () => {
    setIsSignUpModalOpen(false)
  }

  const handleLoginClick = () => {
    setIsSignUpModalOpen(false)
    setIsSignInModalOpen(true)
  }

  const handleSignUpClick = () => {
    setIsSignInModalOpen(false)
    setIsSignUpModalOpen(true)
  }

  const handleForgotPassword = () => {
    setIsSignInModalOpen(false)
    setIsForgotPasswordModalOpen(true)
  }

  // Same no-scheduling-flow-exists reasoning as HeroSection's own
  // handler -- but that handler's mailto subject/body still said "Demo
  // Request"/"book a demo" while its visible label already reads "Contact
  // Sales" (aexa-frontend's own prior copy fix changed the label, not the
  // mailto content). Corrected here to match, and note left on
  // HeroSection's own handler pointing here.
  const handleContactSalesClick = () => {
    window.location.href =
      "mailto:hello@qiyrix.com?subject=Sales%20Inquiry&body=Hi%20Qiyrix%20team%2C%20I%27d%20like%20to%20talk%20to%20sales."
  }

  return (
    <section className="border-t border-border bg-muted px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-2xl font-semibold text-balance text-foreground sm:text-3xl md:text-4xl">
          {t("home.finalCta.title")}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t("home.finalCta.description")}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
          <button
            type="button"
            onClick={handleGetStartedClick}
            className="focus-ring group flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md motion-reduce:transition-none sm:text-base"
          >
            {t("home.finalCta.btnStart")}
            <ArrowRight className="ml-3 h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-1 motion-reduce:transition-none sm:h-5 sm:w-5" />
          </button>

          <button
            type="button"
            onClick={handleContactSalesClick}
            className="focus-ring flex items-center justify-center rounded-md border border-input bg-card px-6 py-3 text-sm font-medium text-foreground transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-accent/10 motion-reduce:transition-none sm:text-base"
          >
            <Mail className="mr-3 h-4 w-4 text-primary sm:h-5 sm:w-5" />
            {t("home.finalCta.btnContactSales")}
          </button>
        </div>
      </div>

      <SignUpModal
        isOpen={isSignUpModalOpen}
        onClose={handleCloseSignUpModal}
        onLoginClick={handleLoginClick}
        triggerRef={authTriggerRef}
      />
      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSignUpClick={handleSignUpClick}
        onForgotPasswordClick={handleForgotPassword}
        triggerRef={authTriggerRef}
      />
      <ForgotPasswordModal
        isOpen={isForgotPasswordModalOpen}
        onClose={() => setIsForgotPasswordModalOpen(false)}
        onBackToSignIn={handleLoginClick}
        triggerRef={authTriggerRef}
      />
    </section>
  )
}

export default FinalCTASection
