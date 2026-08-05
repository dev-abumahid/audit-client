import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import DeletePricingModal from "./DeletePricingModal"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "admin.settings.pricing.form.cancel": "[i18n] Cancel",
        "admin.settings.pricing.deleteModal.title":
          "[i18n] Delete Pricing Plan",
        "admin.settings.pricing.deleteModal.warningText":
          "[i18n] This action cannot be undone.",
        "admin.settings.pricing.deleteModal.deleting": "[i18n] Deleting...",
        "admin.settings.pricing.deleteModal.confirmDelete":
          "[i18n] Yes, Delete Plan",
        "admin.settings.pricing.deleteModal.confirmText": options?.name
          ? `[i18n] Are you sure you want to delete the plan "${options.name}"?`
          : "admin.settings.pricing.deleteModal.confirmText",
      }
      return translations[key] ?? key
    },
  }),
}))

const plan = { _id: "plan1", planName: "Professional" }

describe("DeletePricingModal", () => {
  it("renders nothing when closed or no plan is provided", () => {
    const { container } = render(
      <DeletePricingModal open={false} setOpen={vi.fn()} plan={plan} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the translated confirmation text with the plan name interpolated", () => {
    render(<DeletePricingModal open={true} setOpen={vi.fn()} plan={plan} />)

    expect(
      screen.getByText("[i18n] Delete Pricing Plan")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        '[i18n] Are you sure you want to delete the plan "Professional"?'
      )
    ).toBeInTheDocument()
    expect(screen.getByText("[i18n] Yes, Delete Plan")).toBeInTheDocument()
  })

  it("pairs the icon circle's light background with a dark mode variant", () => {
    render(<DeletePricingModal open={true} setOpen={vi.fn()} plan={plan} />)

    // Trash2 Lucide icon, not the 🗑 emoji glyph.
    const icon = document.querySelector("svg.text-red-600")
    expect(icon).toBeInTheDocument()
    expect(icon?.parentElement).toHaveClass("bg-red-100", "dark:bg-red-900/30")
    expect(icon).toHaveClass("text-red-600", "dark:text-red-400")
  })

  it("closes on Escape key press, handled by the underlying Radix Dialog", async () => {
    const setOpen = vi.fn()
    const user = userEvent.setup()
    render(<DeletePricingModal open={true} setOpen={setOpen} plan={plan} />)

    expect(screen.getByText("[i18n] Delete Pricing Plan")).toBeInTheDocument()

    await user.keyboard("{Escape}")

    expect(setOpen).toHaveBeenCalledWith(false)
  })
})
