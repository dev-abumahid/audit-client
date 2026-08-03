import { render, screen } from "@testing-library/react"
import TestimonialsSection from "./TestimonialsSection"

// The test environment does not initialize i18n, so t() echoes the raw key.
// Asserting on the full key strings guards against copy-pasted keys from
// another section (regression: this subtitle used to reuse
// "home.featureSection.description" -- copy-pasted from FeaturesSection.tsx
// -- so the testimonials heading showed feature-section copy instead of its
// own. Same technique as HeroFeatures.test.tsx.
describe("TestimonialsSection", () => {
  it("renders its own subtitle key, not the Features section's description key", () => {
    render(<TestimonialsSection />)

    expect(
      screen.getByText("home.testimonials.description")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("home.featureSection.description")
    ).not.toBeInTheDocument()
  })

  it("renders the section headers and all three reviews' keys", () => {
    render(<TestimonialsSection />)

    expect(screen.getByText("home.testimonials.title1")).toBeInTheDocument()
    expect(screen.getByText("home.testimonials.title2")).toBeInTheDocument()
    for (let i = 0; i < 3; i++) {
      expect(
        screen.getByText(`home.testimonials.reviews.${i}.quote`, {
          exact: false,
        })
      ).toBeInTheDocument()
      expect(
        screen.getByText(`home.testimonials.reviews.${i}.name`)
      ).toBeInTheDocument()
      expect(
        screen.getByText(`home.testimonials.reviews.${i}.position`)
      ).toBeInTheDocument()
    }
  })

  // Regression test: the section header used <h1>, so the landing page had
  // 5 <h1> elements skipping <h2> entirely. Only HeroSection's main title
  // should be an <h1>; every other section header is an <h2>.
  it("uses an h2 for the section header, not an h1", () => {
    render(<TestimonialsSection />)
    expect(
      screen.getByRole("heading", { level: 2, name: /home\.testimonials/ })
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  // Round 9 audit (#476): the author name was an <h4> straight under the
  // section's <h2>, skipping <h3> entirely -- the only landing-page section
  // that did this (every other section goes h2 -> h3). It's now an <h3>.
  it("uses h3 for each testimonial author name, not h4, so the section follows h2 -> h3", () => {
    render(<TestimonialsSection />)

    expect(screen.queryByRole("heading", { level: 4 })).not.toBeInTheDocument()

    const h3s = screen.getAllByRole("heading", { level: 3 })
    expect(h3s).toHaveLength(3)
    for (let i = 0; i < 3; i++) {
      expect(
        screen.getByRole("heading", {
          level: 3,
          name: `home.testimonials.reviews.${i}.name`,
        })
      ).toBeInTheDocument()
    }
  })
})
