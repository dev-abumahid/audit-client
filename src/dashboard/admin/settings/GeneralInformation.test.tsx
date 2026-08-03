import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import GeneralInformation from "./GeneralInformation"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "admin.settings.general.platformName": "Platform Name",
        "admin.settings.general.contactEmail": "Contact Email",
        "admin.settings.general.noLogoUploaded": "No logo uploaded",
        "admin.settings.general.uploadLogo": "Upload Logo",
        "admin.settings.general.nameRequired": "Platform name is required",
        "admin.settings.general.emailRequired": "Email is required",
        "admin.settings.general.phoneNumber": "Phone Number",
        "admin.settings.general.phoneRequired": "Phone number is required",
        "admin.settings.general.removeLogo": "Remove logo",
        "admin.settings.general.updateSuccess":
          "Not saved — platform settings aren't connected to a backend yet.",
        "admin.settings.general.saveChanges": "Save Changes",
      }
      return map[key] ?? key
    },
  }),
}))

describe("GeneralInformation (aexa-frontend#369, #370, #371)", () => {
  it("does not pre-fill the form with another product's fake branding", () => {
    render(<GeneralInformation />)

    expect(screen.getByLabelText(/Platform Name/)).toHaveValue("")
    expect(screen.queryByDisplayValue("RiskGuard Pro")).not.toBeInTheDocument()
    expect(
      screen.queryByDisplayValue("support@riskguard.com")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByDisplayValue("Dhaka, Bangladesh")
    ).not.toBeInTheDocument()
  })

  it("shows a no-logo placeholder instead of a defunct via.placeholder.com URL", () => {
    render(<GeneralInformation />)

    expect(screen.getByText("No logo uploaded")).toBeInTheDocument()
    expect(document.querySelector('img[src*="via.placeholder.com"]')).toBeNull()
  })

  it("shows a success message that doesn't falsely claim the settings were persisted to a backend", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<GeneralInformation />)

    await user.type(screen.getByLabelText(/Platform Name/), "Qiyrix")
    await user.type(
      screen.getByLabelText(/Contact Email/),
      "hello@qiyrix.example"
    )
    await user.type(screen.getByLabelText(/Phone Number/), "+1 555 000 0000")
    await user.click(screen.getByText("Save Changes"))

    await vi.waitFor(() => expect(alertSpy).toHaveBeenCalled())
    const [message] = alertSpy.mock.calls[0]
    expect(message).not.toMatch(/updated successfully/i)
    expect(message).toMatch(/not saved/i)
    expect(message).toMatch(/backend/i)

    // Let the trailing setIsSubmitting(false) settle before the test ends.
    await vi.waitFor(() =>
      expect(screen.getByText("Save Changes")).toBeInTheDocument()
    )

    alertSpy.mockRestore()
  })

  // Issue #435: Phone Number is marked required in the UI (red asterisk)
  // but handleSubmit never validated it, so the form could be submitted
  // with it blank.
  it("blocks submit and alerts when the required phone number is blank (aexa-frontend#435)", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<GeneralInformation />)

    await user.type(screen.getByLabelText(/Platform Name/), "Qiyrix")
    await user.type(
      screen.getByLabelText(/Contact Email/),
      "hello@qiyrix.example"
    )
    await user.click(screen.getByText("Save Changes"))

    expect(alertSpy).toHaveBeenCalledWith("Phone number is required")

    alertSpy.mockRestore()
  })

  // Issue #436: the icon-only remove-logo button had no accessible name.
  it("gives the remove-logo button an accessible name (aexa-frontend#436)", async () => {
    const user = userEvent.setup()
    render(<GeneralInformation />)

    const file = new File(["logo"], "logo.png", { type: "image/png" })
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    await user.upload(fileInput, file)

    expect(
      await screen.findByRole("button", { name: "Remove logo" })
    ).toBeInTheDocument()
  })
})
