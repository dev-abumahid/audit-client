import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import Footer from "./Footer"

// ── i18n ──────────────────────────────────────────────────────────────────────
// mockT is a spy so tests can assert a specific key was looked up, not just
// that some text happens to appear -- distinguishes t(key) from a hardcoded
// string that coincidentally matches. Same pattern as SignUpModal.test.tsx.
const { mockT } = vi.hoisted(() => ({
  mockT: vi.fn((key: string, opts?: { year?: number }) => {
    const map: Record<string, string> = {
      "home.footer.description": "The complete platform description",
      "home.footer.quickLinksTitle": "Quick Links",
      "home.footer.featuresLink": "Features",
      "home.footer.faqLink": "FAQ",
      "home.footer.contactTitle": "Contact",
      "home.footer.phone": "+44 2 3456 7890",
      "home.footer.email": "hello@qiyrix.com",
      "home.footer.terms": "Terms",
      "home.footer.privacyPolicy": "Privacy Policy",
      "home.footer.socialFacebook": "Facebook",
      "home.footer.socialTwitter": "Twitter",
      "home.footer.socialLinkedIn": "LinkedIn",
      "home.footer.socialInstagram": "Instagram",
    }
    if (key === "home.footer.copyright") {
      return `© ${opts?.year} Qiyrix — All rights reserved.`
    }
    return map[key] ?? key
  }),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: mockT,
    i18n: { changeLanguage: vi.fn() },
  }),
}))

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>
  )
}

describe("Footer", () => {
  beforeEach(() => {
    mockT.mockClear()
  })

  // Regression test: copyright used to be a hardcoded "© 2025
  // YourCompanyName — All rights reserved." Now it's the real product name
  // and a dynamically computed year.
  it("renders the real product name and the current year in the copyright line", () => {
    renderFooter()

    const currentYear = new Date().getFullYear()
    expect(
      screen.getByText(`© ${currentYear} Qiyrix — All rights reserved.`)
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/YourCompanyName/)
    ).not.toBeInTheDocument()
  })

  // Regression test: contact email was the malformed literal
  // "info@company name.com" (with a raw space). No street address exists
  // anywhere real to replace the fake Sydney address with, so it's dropped
  // rather than shipping another placeholder.
  it("shows a well-formed contact email and drops the fake address", () => {
    renderFooter()

    expect(screen.getByText("hello@qiyrix.com")).toBeInTheDocument()
    expect(screen.queryByText(/company name\.com/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Neval street/)).not.toBeInTheDocument()
  })

  // Regression test: "About Us" (-> /about) and "Feature" (-> /feature)
  // pointed at routes that don't exist in MainRoute.tsx. They're repointed
  // to real in-page anchors (added to FeaturesSection/FAQSection) instead.
  it("points quick links at real in-page sections instead of nonexistent routes", () => {
    renderFooter()

    const featuresLink = screen.getByRole("link", { name: /Features/ })
    const faqLink = screen.getByRole("link", { name: /FAQ/ })
    expect(featuresLink.getAttribute("href")).toBe("/#features")
    expect(faqLink.getAttribute("href")).toBe("/#faq")
    expect(screen.queryByText("About Us")).not.toBeInTheDocument()
  })

  // Regression test: all 4 social links used the same Cable icon (visually
  // identical) with href="#". Icons must now be visually distinct per
  // platform even though there's no real profile URL to link to yet.
  it("renders four visually distinct social icons with accessible labels", () => {
    renderFooter()

    const facebook = screen.getByLabelText("Facebook")
    const twitter = screen.getByLabelText("Twitter")
    const linkedin = screen.getByLabelText("LinkedIn")
    const instagram = screen.getByLabelText("Instagram")

    const svgs = [facebook, twitter, linkedin, instagram].map(
      (el) => el.querySelector("svg")?.innerHTML
    )
    // Each icon's inner markup must differ from every other -- proves they
    // aren't all the same Cable icon anymore.
    expect(new Set(svgs).size).toBe(4)
  })

  it("wires every piece of static text through i18n", () => {
    renderFooter()

    expect(mockT).toHaveBeenCalledWith("home.footer.description")
    expect(mockT).toHaveBeenCalledWith("home.footer.quickLinksTitle")
    expect(mockT).toHaveBeenCalledWith("home.footer.contactTitle")
    expect(mockT).toHaveBeenCalledWith("home.footer.terms")
    expect(mockT).toHaveBeenCalledWith("home.footer.privacyPolicy")
    expect(mockT).toHaveBeenCalledWith(
      "home.footer.copyright",
      expect.objectContaining({ year: expect.any(Number) })
    )
  })
})
