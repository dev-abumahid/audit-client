import logo from "@/assets/images/logo.png"
import { Cable, Mail, MapPin, Phone } from "lucide-react"
import React from "react"
import { Link } from "react-router"

const Footer: React.FC = () => {
  const socialLinks = [
    { icon: Cable, href: "#", label: "Facebook" },
    { icon: Cable, href: "#", label: "Twitter" },
    { icon: Cable, href: "#", label: "LinkedIn" },
    { icon: Cable, href: "#", label: "Instagram" },
  ]

  const quickLinks = [
    { name: "About Us", href: "about" },
    { name: "Feature", href: "feature" },
    // { name: "Contact", href: "#contact" },
  ]

  const contactInfo = [
    { icon: MapPin, text: "124 Neval street, Sydney Australia" },
    { icon: Phone, text: "+44 2 3456 7890" },
    { icon: Mail, text: "info@company name.com" },
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
              The complete platform for digitizing workplace inspections and
              operations. Simple, fast, and reliable.
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
                  <social.icon className="h-5 w-5" strokeWidth={2} />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-3">
            <h3 className="mb-4 text-lg font-semibold text-foreground sm:mb-5 sm:text-xl">
              Quick Links
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <Link
                    to={link.href}
                    className="group flex items-center text-sm text-muted-foreground transition-colors hover:text-primary sm:text-base"
                  >
                    <span className="mr-2 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      ›
                    </span>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="lg:col-span-4">
            <h3 className="mb-4 text-lg font-semibold text-foreground sm:mb-5 sm:text-xl">
              Contact
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
              © 2025 YourCompanyName — All rights reserved.
            </p>

            {/* Legal Links */}
            <div className="flex items-center gap-4 text-sm">
              <Link
                to="/terms"
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                Terms
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link
                to="/privacy"
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
