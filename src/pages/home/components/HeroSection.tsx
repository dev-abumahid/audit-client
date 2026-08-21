import ForgotPasswordModal from "@/pages/auth/ForgotPasswordModal"
import SignInModal from "@/pages/auth/SignInModal"
import SignUpModal from "@/pages/auth/SignUpModal"
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll"
import { ArrowRight, CirclePlay } from "lucide-react"
import type { MouseEvent } from "react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import HeroProductVisual from "./HeroProductVisual"

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
  // one exists. Landing overhaul PR10 fix: the button's own label already
  // reads "Contact Sales" (a prior copy pass corrected it from "Book a
  // Demo"), but this handler's mailto subject/body still said "Demo
  // Request"/"book a demo" -- corrected to match, same wording
  // FinalCTASection's own Contact Sales button now uses.
  const handleBookDemoClick = () => {
    window.location.href =
      "mailto:hello@qiyrix.com?subject=Sales%20Inquiry&body=Hi%20Qiyrix%20team%2C%20I%27d%20like%20to%20talk%20to%20sales."
  }

  const capabilities = t("home.hero.capabilities", {
    returnObjects: true,
  }) as string[]

  const [copyRef, copyVisible] = useRevealOnScroll<HTMLDivElement>()
  const [visualRef, visualVisible] = useRevealOnScroll<HTMLDivElement>()

  return (
    <>
      <div className="relative overflow-hidden bg-background py-12 sm:py-16 lg:py-20">
        {/* Major/minor gridlines, not a uniform dot lattice: a plain
            isotropic grid + soft color glow behind a floating card is the
            single most reused hero treatment in current dev-tool/AI SaaS
            marketing. Major lines every 5 minor cells echo the risk
            matrix's own 5x5 likelihood/impact axes instead of borrowing a
            generic graph-paper backdrop. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground) / 0.06) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.06) 1px, transparent 1px), linear-gradient(hsl(var(--foreground) / 0.14) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.14) 1px, transparent 1px)",
            backgroundSize: "24px 24px, 24px 24px, 120px 120px, 120px 120px",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
          }}
        />

        {/* max-w-7xl, not `container` -- see NavBar.tsx for why */}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            {/* Copy column */}
            <div
              ref={copyRef}
              className={`text-left transition-all duration-700 ease-out motion-reduce:transition-none ${
                copyVisible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-teal-700 uppercase dark:text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {t("home.hero.eyebrow")}
              </span>

              <h1 className="mt-5 font-heading text-3xl leading-[1.1] font-bold text-balance text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
                {t("home.hero.title1")}
                {/* Unconditional break (not just mobile): text-balance
                    doesn't know the italic span should stay a single visual
                    unit, so at common laptop widths (1280-1536px) it was
                    slicing the phrase mid-clause, orphaning "your" alone. */}
                <br />
                <span className="text-primary italic">
                  {t("home.hero.title2")}
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
                {t("home.hero.subtitle")}
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:gap-5">
                <button
                  type="button"
                  onClick={handleGetStartedClick}
                  className="focus-ring flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md sm:text-base"
                >
                  {t("home.hero.btnStart")}
                  <ArrowRight className="ml-3 h-4 w-4 sm:h-5 sm:w-5" />
                </button>

                <button
                  type="button"
                  onClick={handleBookDemoClick}
                  className="focus-ring flex items-center justify-center rounded-md border border-input bg-card px-6 py-3 text-sm font-medium text-foreground transition-all hover:-translate-y-0.5 hover:bg-accent/10 sm:text-base"
                >
                  <CirclePlay className="mr-3 h-4 w-4 text-primary sm:h-5 sm:w-5" />
                  {t("home.hero.btnDemo")}
                </button>
              </div>

              {/* Capability chips - real product surfaces, not fabricated
                  certifications. Explicit 2x2 grid, not natural inline
                  wrap: at both 375px and 1280px a 4-item wrap left the last
                  chip stranded alone (3+1) instead of landing evenly. */}
              <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-8">
                {capabilities.map((capability) => (
                  <li
                    key={capability}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                  >
                    <span className="h-1 w-1 rounded-full bg-primary" />
                    {capability}
                  </li>
                ))}
              </ul>
            </div>

            {/* Visual column */}
            <div
              ref={visualRef}
              className={`relative transition-all delay-150 duration-700 ease-out motion-reduce:transition-none ${
                visualVisible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              {/* Muted, not the standard bright accent-colored halo behind
                  a floating UI card -- that pairing (grid + colored blur
                  glow) is the generic dev-tool-SaaS hero signature. */}
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-foreground/[0.03] blur-2xl" />
              <div role="img" aria-label={t("home.hero.heroImageAlt")}>
                <HeroProductVisual visible={visualVisible} />
              </div>
              <p className="mt-3 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("home.hero.heroCaption")}
              </p>
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
