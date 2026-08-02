import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import PricingCard from "./PricingCard"

// mockT distinguishes t(key) lookups from hardcoded text that happens to
// match — see RiskBadge.test.tsx for the same pattern.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "admin.settings.pricing.card.features": "[i18n] Features",
        "admin.settings.pricing.card.edit": "[i18n] Edit",
        "admin.settings.pricing.card.delete": "[i18n] Delete",
        "admin.settings.pricing.card.periodMonthly": "[i18n] mo",
        "admin.settings.pricing.card.periodYearly": "[i18n] yr",
        "admin.settings.pricing.card.periodWeekly": "[i18n] wk",
        "admin.settings.pricing.card.periodQuarterly": "[i18n] qr",
      }
      return translations[key] ?? key
    },
  }),
}))

const plan = {
  _id: "plan1",
  planName: "Professional",
  planDescription: "Best for growing organizations",
  planPrice: 149,
  planType: "monthly",
  planFeatures: ["Up to 25 users", "Priority support"],
}

describe("PricingCard", () => {
  it("renders the plan details and translated chrome text", () => {
    render(<PricingCard plan={plan} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText("Professional")).toBeInTheDocument()
    expect(
      screen.getByText("Best for growing organizations")
    ).toBeInTheDocument()
    expect(screen.getByText("$149")).toBeInTheDocument()
    expect(screen.getByText("[i18n] Features")).toBeInTheDocument()
    expect(screen.getByText("Up to 25 users")).toBeInTheDocument()
    expect(screen.getByText("[i18n] Edit")).toBeInTheDocument()
    expect(screen.getByText("[i18n] Delete")).toBeInTheDocument()
  })

  // Issue #383: getPeriod() used to hardcode "mo"/"yr"/"wk"/"qr" with no
  // t() call, so the billing period never translated. Each variant now goes
  // through i18n.
  it.each([
    ["monthly", "[i18n] mo"],
    ["yearly", "[i18n] yr"],
    ["weekly", "[i18n] wk"],
    ["quarterly", "[i18n] qr"],
  ])(
    "renders the translated billing period for planType %s",
    (planType, expectedPeriod) => {
      render(
        <PricingCard
          plan={{ ...plan, planType }}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      )
      expect(screen.getByText(`/${expectedPeriod}`)).toBeInTheDocument()
    }
  )

  it("calls onEdit and onDelete when the corresponding buttons are clicked", async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<PricingCard plan={plan} onEdit={onEdit} onDelete={onDelete} />)

    await user.click(screen.getByText("[i18n] Edit"))
    expect(onEdit).toHaveBeenCalledTimes(1)

    await user.click(screen.getByText("[i18n] Delete"))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
