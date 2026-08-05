import { Mail, Phone } from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import Logo from "./Logo"

const Footer: React.FC = () => {
  const { t } = useTranslation()

  // "About Us" and "Feature" used to point at /about and /feature, routes
  // that don't exist in src/routes/MainRoute.tsx (dead links). There's no
  // About page/content anywhere in the app to justify adding a new route for
  // it, so that link is dropped. "Feature" and a new "FAQ" link instead point
  // at the real in-page sections (FeaturesSection#features, FAQSection#faq)
  // added on the home page for this fix. Terms/Privacy folded in here too
  // (real routes, previously only in the bottom legal row) so this column
  // isn't visibly sparser than its neighbors.
  const quickLinks = [
    { name: t("home.footer.featuresLink"), href: "/#features", internal: false },
    { name: t("home.footer.faqLink"), href: "/#faq", internal: false },
    { name: t("home.footer.terms"), href: "/terms", internal: true },
    { name: t("home.footer.privacyPolicy"), href: "/privacy", internal: true },
  ]

  // No real street address exists anywhere in the codebase/docs to replace
  // the placeholder "124 Neval street, Sydney Australia" with, so it's
  // removed rather than shipping another fake address.
  const contactInfo = [
    { icon: Phone, text: t("home.footer.phone") },
    { icon: Mail, text: t("home.footer.email") },
  ]

  return (
    <footer className="border-t border-border bg-muted/40">
      {/* max-w-7xl, not `container` -- see NavBar.tsx for why */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        {/* Main Footer Content */}
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:mb-12 lg:grid-cols-12 lg:gap-12">
          {/* Logo and Description */}
          <div className="lg:col-span-5">
            <Link
              to="/"
              className="focus-ring mb-4 inline-flex items-center gap-2.5 rounded-md"
            >
              <Logo className="h-8 w-8" />
              <span className="font-heading text-lg font-semibold text-foreground">
                Qiyrix
              </span>
            </Link>
            <p className="mb-6 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("home.footer.description")}
            </p>
          </div>

          {/* Quick Links - wider span than Contact: 4 items vs 2, so width
              tracks content density instead of the reverse */}
          <div className="lg:col-span-4">
            <h3 className="mb-4 text-lg font-semibold text-foreground sm:mb-5 sm:text-xl">
              {t("home.footer.quickLinksTitle")}
            </h3>
            {/* Monospace index prefixes, not a generic "›" bullet: the same
                ledger motif the authority band uses for its 01-04 card
                indices, carried down so the footer reads as part of the
                same visual system rather than a stock template block. */}
            <ul className="space-y-3">
              {quickLinks.map((link, index) => {
                const number = String(index + 1).padStart(2, "0")
                const linkClassName =
                  "focus-ring group flex items-center gap-2.5 text-sm text-muted-foreground transition-colors hover:text-primary sm:text-base"
                const content = (
                  <>
                    <span className="font-mono-data text-xs text-muted-foreground group-hover:text-primary">
                      {number}
                    </span>
                    {link.name}
                  </>
                )
                return (
                  <li key={index}>
                    {link.internal ? (
                      <Link to={link.href} className={linkClassName}>
                        {content}
                      </Link>
                    ) : (
                      // Plain <a>, not react-router's <Link>: these point at
                      // in-page section ids (#features, #faq) on the home
                      // page, not app routes, so a real navigation is
                      // needed for the browser's native hash-scroll to fire
                      // — a client-side Link push wouldn't scroll.
                      <a href={link.href} className={linkClassName}>
                        {content}
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="lg:col-span-3">
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
          <p className="font-mono-data text-sm text-muted-foreground">
            {t("home.footer.copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
