import heroImg from "@/assets/images/hero-img.png"
import SignUpModal from "@/pages/auth/SignUpModal"
import { ArrowRight, CirclePlay } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

const HeroSection = () => {
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false)
  const { t } = useTranslation()

  const handleGetStartedClick = () => {
    setIsSignUpModalOpen(true)
  }

  const handleCloseSignUpModal = () => {
    setIsSignUpModalOpen(false)
  }

  const handleLoginClick = () => {
    console.log("Login clicked")
  }

  return (
    <>
      {/* Use theme colors instead of hard-coded dark values */}
      <div className="border-b border-border bg-background py-6 md:py-10 lg:py-12">
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

              <button className="flex w-full min-w-50 items-center justify-center rounded-md border border-input bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:w-auto sm:min-w-0 sm:px-5 sm:py-2.5 sm:text-base md:px-6 md:py-3">
                <CirclePlay className="mr-3 h-4 w-4 text-primary sm:h-5 sm:w-5" />
                {t("home.hero.btnDemo")}
              </button>
            </div>

            {/* Hero Image */}
            <div className="mt-8 flex justify-center px-2 md:mt-10 lg:mt-12">
              <img
                src={heroImg}
                alt="hero-img"
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
      />
    </>
  )
}

export default HeroSection
