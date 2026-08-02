import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PricingPlans from "./PricingPlans"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "admin.settings.pricing.title": "[i18n] Subscription Plans",
        "admin.settings.pricing.subtitle": "[i18n] Manage pricing tiers",
        "admin.settings.pricing.addPlan": "[i18n] Add New Plan",
        "admin.settings.pricing.notConnectedNotice":
          "[i18n] This is sample content — subscription plans aren't connected to a backend yet.",
        "admin.settings.pricing.card.features": "[i18n] Features",
        "admin.settings.pricing.card.edit": "[i18n] Edit",
        "admin.settings.pricing.card.delete": "[i18n] Delete",
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

    expect(screen.getByText("Starter")).toBeInTheDocument()
    expect(screen.getByText("Professional")).toBeInTheDocument()
    expect(screen.getByText("Enterprise")).toBeInTheDocument()
  })
})
