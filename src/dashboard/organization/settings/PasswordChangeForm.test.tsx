import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import PasswordChangeForm from "./PasswordChangeForm"

// ── i18n ──────────────────────────────────────────────────────────────────────
// mockT is a spy (not just a plain function) so tests can assert a specific
// key was actually looked up -- a plain "does this text appear" assertion
// can't distinguish t(key) from a hardcoded string that happens to match the
// mocked value, which would defeat the point of a regression test for "this
// string must go through i18n." Same pattern used in SignUpModal.test.tsx.
const { mockT } = vi.hoisted(() => ({
  mockT: vi.fn((key: string) => {
    const map: Record<string, string> = {
      "organization.settings.passwordChange.heading": "Change Password",
      "organization.settings.passwordChange.oldPasswordLabel":
        "Current Password",
      "organization.settings.passwordChange.newPasswordLabel": "New Password",
      "organization.settings.passwordChange.confirmPasswordLabel":
        "Confirm New Password",
      "organization.settings.passwordChange.submitLabel": "Change Password",
      "organization.settings.passwordChange.submittingLabel": "Changing...",
      "organization.settings.passwordChange.oldPasswordReqText":
        "Current password is required",
      "organization.settings.passwordChange.newPasswordReqText":
        "New password is required",
      "organization.settings.passwordChange.confirmPasswordReqText":
        "Please confirm your new password",
      "auth.resetPassword.newPasswordMinLength": "At least 8 characters",
      "auth.resetPassword.passwordMismatch": "Passwords do not match",
    }
    return map[key] ?? key
  }),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockT, i18n: { changeLanguage: vi.fn() } }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { mockChangePasswordTrigger, mockMutationState } = vi.hoisted(() => ({
  mockChangePasswordTrigger: vi.fn(),
  mockMutationState: { isLoading: false },
}))
vi.mock("@/redux/apis/auth.api", () => ({
  useChangePasswordMutation: () => [
    mockChangePasswordTrigger,
    mockMutationState,
  ],
}))

describe("PasswordChangeForm", () => {
  beforeEach(() => {
    mockChangePasswordTrigger.mockReset()
    mockT.mockClear()
    mockMutationState.isLoading = false
  })

  it("renders all three fields", () => {
    render(<PasswordChangeForm />)
    expect(screen.getByLabelText("Current Password")).toBeInTheDocument()
    expect(screen.getByLabelText("New Password")).toBeInTheDocument()
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument()
  })

  // aexa-frontend#464 -- none of the three password fields had an
  // autoComplete attribute (WCAG 1.3.5 Identify Input Purpose), which also
  // stops browser password managers from correctly offering to fill/save.
  it("marks each password field with the correct autoComplete value", () => {
    render(<PasswordChangeForm />)
    expect(screen.getByLabelText("Current Password")).toHaveAttribute(
      "autoComplete",
      "current-password"
    )
    expect(screen.getByLabelText("New Password")).toHaveAttribute(
      "autoComplete",
      "new-password"
    )
    expect(screen.getByLabelText("Confirm New Password")).toHaveAttribute(
      "autoComplete",
      "new-password"
    )
  })

  // Regression: the heading, the three field labels, and the two button
  // states were hardcoded English strings never passed through t(), even
  // though this component already used useTranslation for toast messages.
  // Asserting on mockT calls (not just visible text) proves these strings
  // now actually route through i18n, same pattern as the other tests below.
  it("renders the heading, field labels, and submit button text via t()", () => {
    render(<PasswordChangeForm />)

    // aexa-frontend#464 -- this used to be an <h3>, skipping straight from
    // OrgSettingPage's <h1> with no <h2> in between (it's the second section
    // rendered in the Profile tab, right after Personal Information).
    expect(
      screen.getByText("Change Password", { selector: "h2" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Change Password" })
    ).toBeInTheDocument()
    expect(mockT).toHaveBeenCalledWith(
      "organization.settings.passwordChange.heading"
    )
    expect(mockT).toHaveBeenCalledWith(
      "organization.settings.passwordChange.oldPasswordLabel"
    )
    expect(mockT).toHaveBeenCalledWith(
      "organization.settings.passwordChange.newPasswordLabel"
    )
    expect(mockT).toHaveBeenCalledWith(
      "organization.settings.passwordChange.confirmPasswordLabel"
    )
    expect(mockT).toHaveBeenCalledWith(
      "organization.settings.passwordChange.submitLabel"
    )
  })

  it("shows the translated submitting state on the button while the request is in flight", () => {
    mockMutationState.isLoading = true

    render(<PasswordChangeForm />)

    expect(
      screen.getByRole("button", { name: "Changing..." })
    ).toBeInTheDocument()
    expect(mockT).toHaveBeenCalledWith(
      "organization.settings.passwordChange.submittingLabel"
    )
  })

  it("submits oldPassword/newPassword (not confirmPassword) on valid input", async () => {
    const user = userEvent.setup()
    mockChangePasswordTrigger.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<PasswordChangeForm />)
    await user.type(screen.getByLabelText("Current Password"), "old-pass")
    await user.type(screen.getByLabelText("New Password"), "new-password-1")
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "new-password-1"
    )
    await user.click(screen.getByRole("button", { name: "Change Password" }))

    await waitFor(() =>
      expect(mockChangePasswordTrigger).toHaveBeenCalledWith({
        oldPassword: "old-pass",
        newPassword: "new-password-1",
      })
    )
  })

  it("shows a validation error and does not submit when confirmation doesn't match", async () => {
    const user = userEvent.setup()

    render(<PasswordChangeForm />)
    await user.type(screen.getByLabelText("Current Password"), "old-pass")
    await user.type(screen.getByLabelText("New Password"), "new-password-1")
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "totally-different"
    )
    await user.click(screen.getByRole("button", { name: "Change Password" }))

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument()
    expect(mockChangePasswordTrigger).not.toHaveBeenCalled()
    expect(mockT).toHaveBeenCalledWith("auth.resetPassword.passwordMismatch")
  })

  it("shows translated required-field messages when all three fields are left empty", async () => {
    const user = userEvent.setup()
    render(<PasswordChangeForm />)

    await user.click(screen.getByRole("button", { name: "Change Password" }))

    expect(
      await screen.findByText("Current password is required")
    ).toBeInTheDocument()
    expect(
      screen.getByText("New password is required")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Please confirm your new password")
    ).toBeInTheDocument()
    expect(mockChangePasswordTrigger).not.toHaveBeenCalled()
    // Not just "this text is present" -- proves the messages actually came
    // from t(), not hardcoded strings that happen to match the mock.
    expect(mockT).toHaveBeenCalledWith(
      "organization.settings.passwordChange.oldPasswordReqText"
    )
    expect(mockT).toHaveBeenCalledWith(
      "organization.settings.passwordChange.newPasswordReqText"
    )
    expect(mockT).toHaveBeenCalledWith(
      "organization.settings.passwordChange.confirmPasswordReqText"
    )
  })

  it("shows the translated min-length message for a short new password", async () => {
    const user = userEvent.setup()
    render(<PasswordChangeForm />)

    await user.type(screen.getByLabelText("Current Password"), "old-pass")
    await user.type(screen.getByLabelText("New Password"), "short")
    await user.click(screen.getByRole("button", { name: "Change Password" }))

    expect(
      await screen.findByText("At least 8 characters")
    ).toBeInTheDocument()
    expect(mockChangePasswordTrigger).not.toHaveBeenCalled()
    expect(mockT).toHaveBeenCalledWith("auth.resetPassword.newPasswordMinLength")
  })

  it("surfaces the backend error message on rejection (e.g. incorrect password)", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    mockChangePasswordTrigger.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Incorrect password" } }),
    })

    render(<PasswordChangeForm />)
    await user.type(screen.getByLabelText("Current Password"), "wrong-pass")
    await user.type(screen.getByLabelText("New Password"), "new-password-1")
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "new-password-1"
    )
    await user.click(screen.getByRole("button", { name: "Change Password" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Incorrect password")
    )
  })

  it("surfaces the backend's same-password error verbatim (404 from change_password_into_db)", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    mockChangePasswordTrigger.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: {
            message:
              "Old and new password are same, Please provide different password",
          },
        }),
    })

    render(<PasswordChangeForm />)
    await user.type(screen.getByLabelText("Current Password"), "same-pass")
    await user.type(screen.getByLabelText("New Password"), "same-pass")
    await user.type(screen.getByLabelText("Confirm New Password"), "same-pass")
    await user.click(screen.getByRole("button", { name: "Change Password" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Old and new password are same, Please provide different password"
      )
    )
  })
})
