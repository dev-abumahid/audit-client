import logo from "@/assets/images/logo.png"
import ForgotPasswordModal from "@/pages/auth/ForgotPasswordModal"
import SignInModal from "@/pages/auth/SignInModal"
import { useAppSelector } from "@/redux/hooks"
import { Menu, X } from "lucide-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import SignUpModal from "../../pages/auth/SignUpModal"
import { ModeToggle } from "../mode-toggle"
import LanguageSwitcher from "./LanguageSwitcher"

const NavBar: React.FC = () => {
  const { t } = useTranslation()
  const user = useAppSelector((state) => state.user)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false)
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] =
    useState(false)

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
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between lg:h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <img
                src={logo}
                alt="Logo"
                className="h-16 w-16 object-contain transition-transform hover:scale-105"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden items-center gap-4 lg:flex">
              <ModeToggle />
              <LanguageSwitcher />
              {user?.role ? (
                <Link
                  to={`/${user?.role.toLocaleLowerCase()}`}
                  className="rounded-md border border-primary px-6 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {t("home.navbar.dashboard")}
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => setIsSignInModalOpen(true)}
                    className="rounded-md border border-primary px-6 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    {t("home.navbar.login")}
                  </button>

                  <button
                    onClick={() => setIsSignUpModalOpen(true)}
                    className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    {t("home.navbar.signUp")}
                  </button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-foreground lg:hidden"
              aria-label={t("home.navbar.toggleMenu")}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="border-t border-border py-4 lg:hidden">
              <div className="flex flex-col gap-3">
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
                    className="w-full rounded-md border border-primary px-4 py-3 text-left text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    {t("home.navbar.dashboard")}
                  </Link>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        closeMobileMenu()
                        setIsSignInModalOpen(true)
                      }}
                      className="w-full rounded-md border border-primary px-4 py-3 text-left text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      {t("home.navbar.login")}
                    </button>

                    <button
                      onClick={() => {
                        closeMobileMenu()
                        setIsSignUpModalOpen(true)
                      }}
                      className="w-full rounded-md bg-primary px-4 py-3 text-left text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      {t("home.navbar.signUp")}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Modals */}
      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSignUpClick={handleSignUpClick}
        onForgotPasswordClick={handleForgotPassword}
      />

      <SignUpModal
        isOpen={isSignUpModalOpen}
        onClose={() => setIsSignUpModalOpen(false)}
        onLoginClick={handleSignInClick}
      />

      <ForgotPasswordModal
        isOpen={isForgotPasswordModalOpen}
        onClose={() => setIsForgotPasswordModalOpen(false)}
        onBackToSignIn={handleSignInClick}
      />
    </>
  )
}

export default NavBar
