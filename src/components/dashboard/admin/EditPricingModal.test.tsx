import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import EditPricingModal from "./EditPricingModal"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "admin.settings.pricing.form.planNameLabel": "[i18n] Plan Name",
        "admin.settings.pricing.form.descriptionLabel": "[i18n] Description",
        "admin.settings.pricing.form.priceLabel": "[i18n] Price",
        "admin.settings.pricing.form.billingCycleLabel": "[i18n] Billing Cycle",
        "admin.settings.pricing.form.monthly": "[i18n] Monthly",
        "admin.settings.pricing.form.quarterly": "[i18n] Quarterly",
        "admin.settings.pricing.form.yearly": "[i18n] Yearly",
        "admin.settings.pricing.form.featuresLabel": "[i18n] Plan Features",
        "admin.settings.pricing.form.addFeature": "[i18n] + Add Feature",
        "admin.settings.pricing.form.cancel": "[i18n] Cancel",
        "admin.settings.pricing.editModal.title": "[i18n] Edit Pricing Plan",
        "admin.settings.pricing.editModal.updating": "[i18n] Updating Plan...",
        "admin.settings.pricing.editModal.update": "[i18n] Update Plan",
        "admin.settings.pricing.editModal.nameRequired":
          "[i18n] Plan name is required",
        "admin.settings.pricing.editModal.priceInvalid":
          "[i18n] Plan price must be a non-negative number",
        "admin.settings.pricing.editModal.updateSuccess": options?.name
          ? `[i18n] Pricing plan "${options.name}" updated successfully!`
          : "admin.settings.pricing.editModal.updateSuccess",
        "admin.settings.pricing.form.featurePlaceholder": options?.number
          ? `[i18n] Feature ${options.number}`
          : "admin.settings.pricing.form.featurePlaceholder",
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
  planFeatures: ["Up to 25 users"],
}

describe("EditPricingModal", () => {
  it("renders nothing when closed or no plan is provided", () => {
    const { container } = render(
      <EditPricingModal open={false} setOpen={vi.fn()} plan={plan} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("prefills the form from the plan and shows translated chrome text", () => {
    render(<EditPricingModal open={true} setOpen={vi.fn()} plan={plan} />)

    expect(screen.getByText("[i18n] Edit Pricing Plan")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Professional")).toBeInTheDocument()
    expect(
      screen.getByDisplayValue("Best for growing organizations")
    ).toBeInTheDocument()
    expect(screen.getByText("[i18n] Update Plan")).toBeInTheDocument()
  })

  it("shows the translated validation alert when the plan name is cleared", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<EditPricingModal open={true} setOpen={vi.fn()} plan={plan} />)

    await user.clear(screen.getByDisplayValue("Professional"))
    await user.click(screen.getByText("[i18n] Update Plan"))

    expect(alertSpy).toHaveBeenCalledWith("[i18n] Plan name is required")
    alertSpy.mockRestore()
  })

  it("shows a validation alert when the price is set to a negative number", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<EditPricingModal open={true} setOpen={vi.fn()} plan={plan} />)

    const priceInput = screen.getByDisplayValue("149")
    await user.clear(priceInput)
    await user.type(priceInput, "-50")
    await user.click(screen.getByText("[i18n] Update Plan"))

    expect(alertSpy).toHaveBeenCalledWith(
      "[i18n] Plan price must be a non-negative number"
    )
    alertSpy.mockRestore()
  })

  it("prefills the price field with 0 for a free plan instead of leaving it blank (aexa-frontend#434)", () => {
    const freePlan = { ...plan, planPrice: 0 }
    render(<EditPricingModal open={true} setOpen={vi.fn()} plan={freePlan} />)

    expect(screen.getByDisplayValue("0")).toBeInTheDocument()
  })

  // Round 9 audit (#475): every label was missing htmlFor/id.
  it("associates every field label with its input via htmlFor/id", () => {
    render(<EditPricingModal open={true} setOpen={vi.fn()} plan={plan} />)

    expect(
      screen.getByLabelText("[i18n] Plan Name", { exact: false })
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("[i18n] Description")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("[i18n] Price", { exact: false })
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("[i18n] Billing Cycle")
    ).toBeInTheDocument()
  })

  // Review-loop finding: the dynamic Feature inputs relied on placeholder
  // as their only accessible name; an explicit aria-label is more robust.
  it("gives each dynamic feature input an accessible name via aria-label", () => {
    render(<EditPricingModal open={true} setOpen={vi.fn()} plan={plan} />)
    expect(
      screen.getByRole("textbox", { name: "[i18n] Feature 1" })
    ).toBeInTheDocument()
  })

  // Round 9 audit (#475): icon-only "✕" remove-feature button had no
  // aria-label, same bug class round 8 fixed for GeneralInformation's
  // remove-logo button (#436) but missed here.
  it("gives the remove-feature icon button an accessible name", () => {
    render(<EditPricingModal open={true} setOpen={vi.fn()} plan={plan} />)
    expect(
      screen.getByRole("button", {
        name: /admin\.settings\.pricing\.form\.removeFeature/,
      })
    ).toBeInTheDocument()
  })

  it("closes on Escape key press, handled by the underlying Radix Dialog", async () => {
    const setOpen = vi.fn()
    const user = userEvent.setup()
    render(<EditPricingModal open={true} setOpen={setOpen} plan={plan} />)

    expect(screen.getByText("[i18n] Edit Pricing Plan")).toBeInTheDocument()

    await user.keyboard("{Escape}")

    expect(setOpen).toHaveBeenCalledWith(false)
  })

  // Raw <button>s default to type="submit" per HTML spec, which is a latent
  // bug if this modal ever ends up inside a <form>. Every button here is a
  // raw <button>, so it's safe to sweep all of them.
  it("gives every button an explicit type", () => {
    render(<EditPricingModal open={true} setOpen={vi.fn()} plan={plan} />)

    const buttons = document.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      expect(button.type).toBe("button")
    })
  })
})
