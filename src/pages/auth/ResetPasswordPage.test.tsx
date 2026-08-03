import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import ResetPasswordPage from "./ResetPasswordPage"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "auth.resetPassword.title": "Set a New Password",
        "auth.resetPassword.subTitle": "Enter a new password for your account",
        "auth.resetPassword.newPassword": "New Password",
        // Deliberately distinct from any plausible hardcoded English
        // fallback string, so a test asserting on this exact text can only
        // pass if the component actually calls t() for this message rather
        // than rendering a literal that happens to look similar.
        "auth.resetPassword.newPasswordReqText": "[i18n] Password is required",
        "auth.resetPassword.newPasswordMinLength": "At least 8 characters",
        "auth.resetPassword.confirmPassword": "Confirm Password",
        "auth.resetPassword.confirmPasswordReqText":
          "Please confirm your password",
        "auth.resetPassword.passwordMismatch": "Passwords do not match",
        "auth.resetPassword.btnReset": "Reset Password",
        "auth.resetPassword.resetting": "Resetting...",
        "auth.resetPassword.invalidLink":
          "This reset link is invalid or missing a token.",
        "auth.resetPassword.successMessage":
          "Password reset successfully. You can now sign in.",
        "auth.resetPassword.btnGoToSignIn": "Go to Sign In",
        "auth.genericError": "Something went wrong",
      }
      return map[key] ?? key
    },
  }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

let mockIsSuccess = false
const mockResetPasswordTrigger = vi.fn()
vi.mock("@/redux/apis/auth.api", () => ({
  useResetPasswordMutation: () => [
    mockResetPasswordTrigger,
    { isSuccess: mockIsSuccess },
  ],
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    mockResetPasswordTrigger.mockReset()
    mockIsSuccess = false
  })

  it("shows an invalid-link state when the URL has no token", () => {
    renderAt("/reset-password")

    expect(
      screen.getByText("This reset link is invalid or missing a token.")
    ).toBeInTheDocument()
    expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument()
  })

  it("submits the token and new password when the form is valid", async () => {
    const user = userEvent.setup()
    mockResetPasswordTrigger.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    renderAt("/reset-password?token=abc123")

    await user.type(screen.getByLabelText("New Password"), "newpassword1")
    await user.type(screen.getByLabelText("Confirm Password"), "newpassword1")
    await user.click(screen.getByRole("button", { name: "Reset Password" }))

    await waitFor(() =>
      expect(mockResetPasswordTrigger).toHaveBeenCalledWith({
        token: "abc123",
        newPass: "newpassword1",
      })
    )
  })

  it("rejects mismatched passwords before submitting", async () => {
    const user = userEvent.setup()

    renderAt("/reset-password?token=abc123")

    await user.type(screen.getByLabelText("New Password"), "newpassword1")
    await user.type(screen.getByLabelText("Confirm Password"), "different1")
    await user.click(screen.getByRole("button", { name: "Reset Password" }))

    expect(
      await screen.findByText("Passwords do not match")
    ).toBeInTheDocument()
    expect(mockResetPasswordTrigger).not.toHaveBeenCalled()
  })

  it("routes the required-field message through t(), not a hardcoded English literal", async () => {
    const user = userEvent.setup()

    renderAt("/reset-password?token=abc123")

    await user.type(screen.getByLabelText("Confirm Password"), "x")
    await user.click(screen.getByRole("button", { name: "Reset Password" }))

    // The mocked t() returns a value distinct from any plausible hardcoded
    // fallback (see the mock above) — this only passes if the component
    // genuinely calls t("auth.resetPassword.newPasswordReqText") for the
    // required-field error rather than a literal English string.
    expect(
      await screen.findByText("[i18n] Password is required")
    ).toBeInTheDocument()
    expect(mockResetPasswordTrigger).not.toHaveBeenCalled()
  })

  it("shows the server's error message on a failed reset (e.g. expired token)", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    mockResetPasswordTrigger.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "Link expired, please reset again" } }),
    })

    renderAt("/reset-password?token=expired")

    await user.type(screen.getByLabelText("New Password"), "newpassword1")
    await user.type(screen.getByLabelText("Confirm Password"), "newpassword1")
    await user.click(screen.getByRole("button", { name: "Reset Password" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Link expired, please reset again"
      )
    )
  })

  it("falls back to the generic i18n error when the server response has no message", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    mockResetPasswordTrigger.mockReturnValue({
      unwrap: () => Promise.reject({}),
    })

    renderAt("/reset-password?token=expired")

    await user.type(screen.getByLabelText("New Password"), "newpassword1")
    await user.type(screen.getByLabelText("Confirm Password"), "newpassword1")
    await user.click(screen.getByRole("button", { name: "Reset Password" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Something went wrong")
    )
  })

  it("sets autoComplete=new-password on both password fields", () => {
    renderAt("/reset-password?token=abc123")

    expect(screen.getByLabelText("New Password")).toHaveAttribute(
      "autoComplete",
      "new-password"
    )
    expect(screen.getByLabelText("Confirm Password")).toHaveAttribute(
      "autoComplete",
      "new-password"
    )
  })

  it("shows the success state and a sign-in link once the mutation succeeds", () => {
    mockIsSuccess = true

    renderAt("/reset-password?token=abc123")

    expect(
      screen.getByText("Password reset successfully. You can now sign in.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Go to Sign In" })
    ).toBeInTheDocument()
  })
})
