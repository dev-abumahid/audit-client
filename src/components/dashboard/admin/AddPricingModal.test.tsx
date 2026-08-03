import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import AddPricingModal from "./AddPricingModal"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "admin.settings.pricing.form.planNameLabel": "[i18n] Plan Name",
        "admin.settings.pricing.form.descriptionLabel": "[i18n] Description",
        "admin.settings.pricing.form.priceLabel": "[i18n] Price",
        "admin.settings.pricing.form.billingCycleLabel":
          "[i18n] Billing Cycle",
        "admin.settings.pricing.form.monthly": "[i18n] Monthly",
        "admin.settings.pricing.form.quarterly": "[i18n] Quarterly",
        "admin.settings.pricing.form.yearly": "[i18n] Yearly",
        "admin.settings.pricing.form.featuresLabel": "[i18n] Plan Features",
        "admin.settings.pricing.form.addFeature": "[i18n] + Add Feature",
        "admin.settings.pricing.form.cancel": "[i18n] Cancel",
        "admin.settings.pricing.addModal.title": "[i18n] Add New Pricing Plan",
        "admin.settings.pricing.addModal.planNamePlaceholder":
          "[i18n] e.g. Professional",
        "admin.settings.pricing.addModal.descriptionPlaceholder":
          "[i18n] Brief description of the plan",
        "admin.settings.pricing.addModal.pricePlaceholder": "[i18n] 149",
        "admin.settings.pricing.addModal.creating": "[i18n] Creating Plan...",
        "admin.settings.pricing.addModal.create": "[i18n] Create Plan",
        "admin.settings.pricing.addModal.nameRequired":
          "[i18n] Plan name is required",
        "admin.settings.pricing.addModal.priceRequired":
          "[i18n] Plan price is required",
        "admin.settings.pricing.addModal.priceInvalid":
          "[i18n] Plan price must be a non-negative number",
        "admin.settings.pricing.addModal.createSuccess": options?.name
          ? `[i18n] Pricing plan "${options.name}" created successfully!`
          : "admin.settings.pricing.addModal.createSuccess",
        "admin.settings.pricing.form.featurePlaceholder": options?.number
          ? `[i18n] Feature ${options.number}`
          : "admin.settings.pricing.form.featurePlaceholder",
      }
      return translations[key] ?? key
    },
  }),
}))

describe("AddPricingModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <AddPricingModal open={false} setOpen={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the translated title and form chrome when open", () => {
    render(<AddPricingModal open={true} setOpen={vi.fn()} />)

    expect(
      screen.getByText("[i18n] Add New Pricing Plan")
    ).toBeInTheDocument()
    expect(screen.getByText("[i18n] Plan Name")).toBeInTheDocument()
    expect(screen.getByText("[i18n] Plan Features")).toBeInTheDocument()
    expect(screen.getByText("[i18n] Cancel")).toBeInTheDocument()
    expect(screen.getByText("[i18n] Create Plan")).toBeInTheDocument()
  })

  it("shows the translated validation alert when the plan name is empty", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<AddPricingModal open={true} setOpen={vi.fn()} />)

    await user.click(screen.getByText("[i18n] Create Plan"))

    expect(alertSpy).toHaveBeenCalledWith("[i18n] Plan name is required")
    alertSpy.mockRestore()
  })

  it("rejects a negative price instead of only checking truthiness", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<AddPricingModal open={true} setOpen={vi.fn()} />)

    await user.type(
      screen.getByPlaceholderText("[i18n] e.g. Professional"),
      "Starter"
    )
    await user.type(screen.getByPlaceholderText("[i18n] 149"), "-50")
    await user.click(screen.getByText("[i18n] Create Plan"))

    expect(alertSpy).toHaveBeenCalledWith(
      "[i18n] Plan price must be a non-negative number"
    )
    alertSpy.mockRestore()
  })

  it("renders the price input with a non-negative min attribute", () => {
    render(<AddPricingModal open={true} setOpen={vi.fn()} />)
    expect(screen.getByPlaceholderText("[i18n] 149")).toHaveAttribute(
      "min",
      "0"
    )
  })

  it("closes on Escape key press, handled by the underlying Radix Dialog", async () => {
    const setOpen = vi.fn()
    const user = userEvent.setup()
    render(<AddPricingModal open={true} setOpen={setOpen} />)

    expect(
      screen.getByText("[i18n] Add New Pricing Plan")
    ).toBeInTheDocument()

    await user.keyboard("{Escape}")

    expect(setOpen).toHaveBeenCalledWith(false)
  })
})
