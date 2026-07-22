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

const mockChangePasswordTrigger = vi.fn()
vi.mock("@/redux/apis/auth.api", () => ({
  useChangePasswordMutation: () => [
    mockChangePasswordTrigger,
    { isLoading: false },
  ],
}))

describe("PasswordChangeForm", () => {
  beforeEach(() => {
    mockChangePasswordTrigger.mockReset()
    mockT.mockClear()
  })

  it("renders all three fields", () => {
    render(<PasswordChangeForm />)
    expect(screen.getByLabelText("Current Password")).toBeInTheDocument()
    expect(screen.getByLabelText("New Password")).toBeInTheDocument()
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument()
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
