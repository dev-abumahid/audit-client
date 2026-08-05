import ForgotPasswordModal from "@/pages/auth/ForgotPasswordModal"
import SignInModal from "@/pages/auth/SignInModal"
import { useAppSelector } from "@/redux/hooks"
import { Menu, X } from "lucide-react"
import React, { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import SignUpModal from "../../pages/auth/SignUpModal"
import { ModeToggle } from "../mode-toggle"
import LanguageSwitcher from "./LanguageSwitcher"
import Logo from "./Logo"

const NAV_LINKS = [
  { key: "howItWorksLink", href: "/#how-it-works" },
  { key: "platformLink", href: "/#features" },
  { key: "faqLink", href: "/#faq" },
]

const NavBar: React.FC = () => {
  const { t } = useTranslation()
  const user = useAppSelector((state) => state.user)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false)
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] =
    useState(false)
  // The page element that started the current auth-modal flow (desktop or
  // mobile Sign in/Sign up button). Only set from the actual page-level
  // trigger clicks below, not from the modals' internal cross-navigation
  // links (Sign in <-> Sign up <-> Forgot password) -- that way closing the
  // whole flow, however many modals it hopped through, returns focus to
  // where the user actually started (aexa-frontend#477).
  const authTriggerRef = useRef<HTMLElement | null>(null)

  const handleSignInClick = () => {
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

  const closeMobileMenu = () => {
    setIsMenuOpen(false)
  }

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border bg-background">
        {/* max-w-7xl, not Tailwind's default `container`: `container` caps
            at 1536px from the 2xl breakpoint up, while every content
            section below uses max-w-7xl (1280px) -- the mismatch left the
            nav's content edge ~128px outboard of every section's edge on
            wide desktop screens. This keeps one width authority page-wide. */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between lg:h-16">
            {/* Logo */}
            <Link
              to="/"
              className="focus-ring flex items-center gap-2.5 rounded-md"
            >
              <Logo className="h-8 w-8 text-primary" />
              <span className="font-heading text-lg font-semibold text-foreground">
                Qiyrix
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden items-center gap-8 lg:flex">
              {/* In-page section links - plain <a>, not react-router's
                  <Link>: these point at in-page anchors on the home page,
                  not app routes (same pattern/reasoning as Footer.tsx). */}
              <div className="flex items-center gap-6">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.key}
                    href={link.href}
                    className="focus-ring text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t(`home.navbar.${link.key}`)}
                  </a>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <ModeToggle />
                <LanguageSwitcher />
                {user?.role ? (
                  <Link
                    to={`/${user?.role.toLocaleLowerCase()}`}
                    className="focus-ring rounded-md border border-primary px-6 py-2.5 text-sm font-medium text-teal-700 transition-colors hover:bg-primary hover:text-primary-foreground dark:text-primary"
                  >
                    {t("home.navbar.dashboard")}
                  </Link>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        authTriggerRef.current = e.currentTarget
                        setIsSignInModalOpen(true)
                      }}
                      className="focus-ring rounded-md border border-primary px-6 py-2.5 text-sm font-medium text-teal-700 transition-colors hover:bg-primary hover:text-primary-foreground dark:text-primary"
                    >
                      {t("home.navbar.login")}
                    </button>

                    <button
                      onClick={(e) => {
                        authTriggerRef.current = e.currentTarget
                        setIsSignUpModalOpen(true)
                      }}
                      className="focus-ring rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md"
                    >
                      {t("home.navbar.signUp")}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="focus-ring relative flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent/10 lg:hidden"
              aria-label={t("home.navbar.toggleMenu")}
              aria-expanded={isMenuOpen}
            >
              <Menu
                size={22}
                className={`absolute transition-all duration-200 ${isMenuOpen ? "scale-75 opacity-0" : "scale-100 opacity-100"}`}
              />
              <X
                size={22}
                className={`absolute transition-all duration-200 ${isMenuOpen ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}
              />
            </button>
          </div>

          {/* Mobile Menu - always rendered so aria-expanded stays wired to
              real content instead of a mount/unmount flash. Verified by
              directly slowing the transition and screenshotting mid-
              animation: the ModeToggle's absolutely-positioned Sun/Moon
              icon escaped the collapsing box's overflow-hidden clip during
              the transition regardless of whether the animation was driven
              by CSS-grid grid-template-rows (0fr<->1fr) or a plain
              max-height change -- overflow-hidden alone isn't a reliable
              clip guarantee for a composited descendant on this browser
              while its ancestor's box is actively animating. `contain:
              paint` is a stronger, explicit directive: it establishes this
              element as its descendants' definite paint containment
              boundary, which held up under the same slowed-transition
              screenshot test where overflow-hidden alone did not. */}
          <div
            className={`overflow-hidden transition-[max-height] duration-300 ease-out lg:hidden ${
              isMenuOpen ? "max-h-[32rem]" : "max-h-0"
            }`}
            style={{
              visibility: isMenuOpen ? "visible" : "hidden",
              contain: "paint",
            }}
          >
            <div>
              <div className="border-t border-border py-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1 border-b border-border pb-3">
                    {NAV_LINKS.map((link) => (
                      <a
                        key={link.key}
                        href={link.href}
                        onClick={closeMobileMenu}
                        className="focus-ring rounded-md px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {t(`home.navbar.${link.key}`)}
                      </a>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <ModeToggle />
                    <LanguageSwitcher />
                  </div>

                  {user?.role ? (
                    <Link
                      to={`/${user?.role.toLocaleLowerCase()}`}
                      onClick={() => {
                        closeMobileMenu()
                      }}
                      className="focus-ring w-full rounded-md border border-primary px-4 py-3 text-left text-teal-700 transition-colors hover:bg-primary hover:text-primary-foreground dark:text-primary"
                    >
                      {t("home.navbar.dashboard")}
                    </Link>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          authTriggerRef.current = e.currentTarget
                          closeMobileMenu()
                          setIsSignInModalOpen(true)
                        }}
                        className="focus-ring w-full rounded-md border border-primary px-4 py-3 text-left text-teal-700 transition-colors hover:bg-primary hover:text-primary-foreground dark:text-primary"
                      >
                        {t("home.navbar.login")}
                      </button>

                      <button
                        onClick={(e) => {
                          authTriggerRef.current = e.currentTarget
                          closeMobileMenu()
                          setIsSignUpModalOpen(true)
                        }}
                        className="focus-ring w-full rounded-md bg-primary px-4 py-3 text-left text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        {t("home.navbar.signUp")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Modals */}
      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSignUpClick={handleSignUpClick}
        onForgotPasswordClick={handleForgotPassword}
        triggerRef={authTriggerRef}
      />

      <SignUpModal
        isOpen={isSignUpModalOpen}
        onClose={() => setIsSignUpModalOpen(false)}
        onLoginClick={handleSignInClick}
        triggerRef={authTriggerRef}
      />

      <ForgotPasswordModal
        isOpen={isForgotPasswordModalOpen}
        onClose={() => setIsForgotPasswordModalOpen(false)}
        onBackToSignIn={handleSignInClick}
        triggerRef={authTriggerRef}
      />
    </>
  )
}

export default NavBar
