import heroImg from "@/assets/images/hero-img.png"
import ForgotPasswordModal from "@/pages/auth/ForgotPasswordModal"
import SignInModal from "@/pages/auth/SignInModal"
import SignUpModal from "@/pages/auth/SignUpModal"
import { ArrowRight, CirclePlay } from "lucide-react"
import type { MouseEvent } from "react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

const HeroSection = () => {
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false)
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] =
    useState(false)
  const { t } = useTranslation()
  // The element that started the current auth-modal flow (the "Get
  // Started" button). Only set from the actual page-level trigger click
  // below, not from the modals' internal cross-navigation links, so
  // closing the whole flow returns focus to where the user actually
  // started (aexa-frontend#477).
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

  // No in-app demo scheduling flow exists yet (checked src/routes and codebase
  // for "demo"/"calendly"/booking routes - none found), so this opens a
  // pre-filled mailto to the team as a minimal, honest fallback rather than
  // leaving the button dead. Replace with a real scheduling link/route when
  // one exists.
  const handleBookDemoClick = () => {
    window.location.href =
      "mailto:hello@qiyrix.com?subject=Demo%20Request&body=Hi%20Qiyrix%20team%2C%20I%27d%20like%20to%20book%20a%20demo."
  }

  return (
    <>
      {/* Use theme colors instead of hard-coded dark values */}
      <div className="bg-background py-6 md:py-10 lg:py-12">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl text-center">
            {/* Heading - Use foreground + primary color from theme */}
            <h1 className="text-xl leading-tight font-bold text-foreground sm:text-2xl md:text-3xl md:leading-snug lg:text-4xl lg:leading-normal xl:text-5xl">
              {t("home.hero.title1")}
              <br />
              <span className="block text-primary sm:inline">
                {t("home.hero.title2")}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mx-auto mt-4 max-w-4xl text-sm leading-relaxed text-muted-foreground sm:text-base md:mt-6 md:text-lg md:leading-loose lg:text-xl">
              {t("home.hero.subtitle")}
            </p>

            {/* Buttons */}
            <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5 md:mt-8 lg:mt-10">
              <button
                onClick={handleGetStartedClick}
                className="flex w-full min-w-50 items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto sm:min-w-0 sm:px-5 sm:py-2.5 sm:text-base md:px-6 md:py-3"
              >
                {t("home.hero.btnStart")}
                <ArrowRight className="ml-3 h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              <button
                onClick={handleBookDemoClick}
                className="flex w-full min-w-50 items-center justify-center rounded-md border border-input bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:w-auto sm:min-w-0 sm:px-5 sm:py-2.5 sm:text-base md:px-6 md:py-3"
              >
                <CirclePlay className="mr-3 h-4 w-4 text-primary sm:h-5 sm:w-5" />
                {t("home.hero.btnDemo")}
              </button>
            </div>

            {/* Hero Image */}
            <div className="mt-8 flex justify-center px-2 md:mt-10 lg:mt-12">
              <img
                src={heroImg}
                alt={t("home.hero.heroImageAlt")}
                className="h-auto w-full max-w-4xl rounded-lg lg:max-w-5xl xl:max-w-6xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SignUp Modal */}
      <SignUpModal
        isOpen={isSignUpModalOpen}
        onClose={handleCloseSignUpModal}
        onLoginClick={handleLoginClick}
        triggerRef={authTriggerRef}
      />

      {/* Sign In Modal */}
      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSignUpClick={handleSignUpClick}
        onForgotPasswordClick={handleForgotPassword}
        triggerRef={authTriggerRef}
      />

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordModalOpen}
        onClose={() => setIsForgotPasswordModalOpen(false)}
        onBackToSignIn={handleLoginClick}
        triggerRef={authTriggerRef}
      />
    </>
  )
}

export default HeroSection
