import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PricingPlans from "./PricingPlans"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "admin.settings.pricing.title": "[i18n] Subscription Plans",
        "admin.settings.pricing.subtitle": "[i18n] Manage pricing tiers",
        "admin.settings.pricing.addPlan": "[i18n] Add New Plan",
        "admin.settings.pricing.notConnectedNotice":
          "[i18n] This is sample content — subscription plans aren't connected to a backend yet.",
        "admin.settings.pricing.card.features": "[i18n] Features",
        "admin.settings.pricing.card.edit": "[i18n] Edit",
        "admin.settings.pricing.card.delete": "[i18n] Delete",
        "admin.settings.pricing.plans.starter.name": "[i18n] Starter",
        "admin.settings.pricing.plans.starter.description":
          "[i18n] Perfect for small teams and startups",
        "admin.settings.pricing.plans.professional.name": "[i18n] Professional",
        "admin.settings.pricing.plans.professional.description":
          "[i18n] Best for growing organizations",
        "admin.settings.pricing.plans.enterprise.name": "[i18n] Enterprise",
        "admin.settings.pricing.plans.enterprise.description":
          "[i18n] For large organizations with complex needs",
      }
      const featureLists: Record<string, string[]> = {
        "admin.settings.pricing.plans.starter.features": [
          "[i18n] Up to 5 users",
        ],
        "admin.settings.pricing.plans.professional.features": [
          "[i18n] Up to 25 users",
        ],
        "admin.settings.pricing.plans.enterprise.features": [
          "[i18n] Unlimited users",
        ],
      }
      if (options?.returnObjects && featureLists[key]) {
        return featureLists[key]
      }
      return translations[key] ?? key
    },
  }),
}))

// These modals are covered by their own dedicated test files; stub them here
// so this page test stays focused on the pricing list itself.
vi.mock("@/components/dashboard/admin/AddPricingModal", () => ({
  default: () => <div data-testid="add-pricing-modal" />,
}))
vi.mock("@/components/dashboard/admin/EditPricingModal", () => ({
  default: () => <div data-testid="edit-pricing-modal" />,
}))
vi.mock("@/components/dashboard/admin/DeletePricingModal", () => ({
  default: () => <div data-testid="delete-pricing-modal" />,
}))

describe("PricingPlans", () => {
  // Issue #382: the pricing plans list is undisclosed hardcoded dummy data,
  // unlike the Add/Edit/Delete modals for the same feature which honestly
  // disclose that plan management isn't connected to a backend yet. This
  // banner brings the list itself in line with that convention.
  it("shows a disclosure banner stating the plans aren't backed by a real API", () => {
    render(<PricingPlans />)

    expect(
      screen.getByText(
        "[i18n] This is sample content — subscription plans aren't connected to a backend yet."
      )
    ).toBeInTheDocument()
  })

  it("renders the placeholder plan cards", () => {
    render(<PricingPlans />)

    expect(screen.getByText("[i18n] Starter")).toBeInTheDocument()
    expect(screen.getByText("[i18n] Professional")).toBeInTheDocument()
    expect(screen.getByText("[i18n] Enterprise")).toBeInTheDocument()
  })

  // Issue #437: plan name/description/features were hardcoded English,
  // never routed through t(), so switching locale left pricing content
  // untranslated. Assert the card content comes from translation keys.
  it("routes plan name, description, and features through t() instead of hardcoding English", () => {
    render(<PricingPlans />)

    expect(
      screen.getByText("[i18n] Perfect for small teams and startups")
    ).toBeInTheDocument()
    expect(
      screen.getByText("[i18n] Best for growing organizations")
    ).toBeInTheDocument()
    expect(
      screen.getByText("[i18n] For large organizations with complex needs")
    ).toBeInTheDocument()
    expect(screen.getByText("[i18n] Up to 5 users")).toBeInTheDocument()
    expect(screen.getByText("[i18n] Up to 25 users")).toBeInTheDocument()
    expect(screen.getByText("[i18n] Unlimited users")).toBeInTheDocument()
  })
})
