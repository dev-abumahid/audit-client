import logo from "@/assets/images/logo.png"
import { Mail, Phone } from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

const Footer: React.FC = () => {
  const { t } = useTranslation()

  // "About Us" and "Feature" used to point at /about and /feature, routes
  // that don't exist in src/routes/MainRoute.tsx (dead links). There's no
  // About page/content anywhere in the app to justify adding a new route for
  // it, so that link is dropped. "Feature" and a new "FAQ" link instead point
  // at the real in-page sections (FeaturesSection#features, FAQSection#faq)
  // added on the home page for this fix.
  const quickLinks = [
    { name: t("home.footer.featuresLink"), href: "/#features" },
    { name: t("home.footer.faqLink"), href: "/#faq" },
  ]

  // No real street address exists anywhere in the codebase/docs to replace
  // the placeholder "124 Neval street, Sydney Australia" with, so it's
  // removed rather than shipping another fake address.
  const contactInfo = [
    { icon: Phone, text: t("home.footer.phone") },
    { icon: Mail, text: t("home.footer.email") },
  ]

  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        {/* Main Footer Content */}
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:mb-12 lg:grid-cols-12 lg:gap-12">
          {/* Logo and Description */}
          <div className="lg:col-span-5">
            <Link to="/">
              <img src={logo} alt="Logo" className="mb-4 h-16 w-16" />
            </Link>
            <p className="mb-6 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("home.footer.description")}
            </p>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-3">
            <h3 className="mb-4 text-lg font-semibold text-foreground sm:mb-5 sm:text-xl">
              {t("home.footer.quickLinksTitle")}
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  {/* Plain <a>, not react-router's <Link>: these point at
                      in-page section ids (#features, #faq) on the home page,
                      not app routes, so a real navigation is needed for the
                      browser's native hash-scroll to fire — a client-side
                      Link push wouldn't scroll. */}
                  <a
                    href={link.href}
                    className="group flex items-center text-sm text-muted-foreground transition-colors hover:text-primary sm:text-base"
                  >
                    <span className="mr-2 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      ›
                    </span>
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="lg:col-span-4">
            <h3 className="mb-4 text-lg font-semibold text-foreground sm:mb-5 sm:text-xl">
              {t("home.footer.contactTitle")}
            </h3>
            <ul className="space-y-4">
              {contactInfo.map((info, index) => (
                <li key={index} className="flex items-start gap-3">
                  <info.icon
                    className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                    strokeWidth={2}
                  />
                  <span className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {info.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-border pt-6 sm:pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            {/* Copyright */}
            <p className="text-center text-sm text-muted-foreground sm:text-left">
              {t("home.footer.copyright", { year: new Date().getFullYear() })}
            </p>

            {/* Legal Links */}
            <div className="flex items-center gap-4 text-sm">
              <Link
                to="/terms"
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                {t("home.footer.terms")}
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link
                to="/privacy"
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                {t("home.footer.privacyPolicy")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
