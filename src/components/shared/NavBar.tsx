import logo from "@/assets/images/logo.png"
import SignInModal from "@/pages/auth/SignInModal"
import { Menu, X } from "lucide-react"
import React, { useState } from "react"
import { Link } from "react-router"
import SignUpModal from "../../pages/auth/SignUpModal"
import LanguageSwitcher from "./LanguageSwitcher"

const NavBar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false)

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
  }

  const handleDashboard = () => {
    // handle navigate logic here
    // const role = data?.data?.account?.role
    // if (role === "ORGANIZATION") {
    //   navigate("/dashboard")
    // } else if (role === "USER") {
    //   navigate("/user-dashboard")
    // } else if (role === "ADMIN") {
    //   navigate("/admin-dashboard")
    // }
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
              <LanguageSwitcher />

              <button
                onClick={handleDashboard}
                className="rounded-md border border-primary px-6 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                Dashboard
              </button>

              <button
                onClick={() => setIsSignInModalOpen(true)}
                className="rounded-md border border-primary px-6 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                Login
              </button>

              <button
                onClick={() => setIsSignUpModalOpen(true)}
                className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Sign Up for Free
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-foreground lg:hidden"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="border-t border-border py-4 lg:hidden">
              <div className="flex flex-col gap-3">
                <LanguageSwitcher />

                <button
                  onClick={() => {
                    handleDashboard()
                    closeMobileMenu()
                  }}
                  className="w-full rounded-md border border-primary px-4 py-3 text-left text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  Dashboard
                </button>

                <button
                  onClick={() => {
                    closeMobileMenu()
                    setIsSignInModalOpen(true)
                  }}
                  className="w-full rounded-md border border-primary px-4 py-3 text-left text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  Login
                </button>

                <button
                  onClick={() => {
                    closeMobileMenu()
                    setIsSignUpModalOpen(true)
                  }}
                  className="w-full rounded-md bg-primary px-4 py-3 text-left text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Sign Up for Free
                </button>
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
    </>
  )
}

export default NavBar
