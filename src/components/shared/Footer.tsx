import logo from "@/assets/images/logo.png"
import { Mail, Phone } from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

// Minimal brand marks — lucide-react dropped brand/logo icons a while back
// (see the same note in SocialLoginButtons.tsx), so distinct social icons
// have to be inlined rather than imported.
const FacebookIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M24 12.07C24 5.71 18.63.5 12 .5S0 5.71 0 12.07C0 17.8 4.39 22.54 10.13 23.5v-8.1H7.08v-3.33h3.05V9.41c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.94h-1.51c-1.49 0-1.95.92-1.95 1.87v2.25h3.32l-.53 3.32h-2.79v8.1C19.61 22.54 24 17.8 24 12.07Z" />
  </svg>
)

const TwitterIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M18.9 1.5h3.68l-8.04 9.19L24 22.5h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.5h7.6l5.24 6.93L18.9 1.5Zm-1.29 18.81h2.04L6.49 3.58H4.3l13.31 16.73Z" />
  </svg>
)

const LinkedInIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.15 1.45-2.15 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
  </svg>
)

const InstagramIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
)

const Footer: React.FC = () => {
  const { t } = useTranslation()

  const socialLinks = [
    { Icon: FacebookIcon, href: "#", label: t("home.footer.socialFacebook") },
    { Icon: TwitterIcon, href: "#", label: t("home.footer.socialTwitter") },
    { Icon: LinkedInIcon, href: "#", label: t("home.footer.socialLinkedIn") },
    {
      Icon: InstagramIcon,
      href: "#",
      label: t("home.footer.socialInstagram"),
    },
  ]

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

            {/* Social Links */}
            <div className="flex gap-3 sm:gap-4">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  aria-label={social.label}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-all hover:bg-primary hover:text-primary-foreground sm:h-11 sm:w-11"
                >
                  <social.Icon />
                </a>
              ))}
            </div>
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
