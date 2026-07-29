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
})
