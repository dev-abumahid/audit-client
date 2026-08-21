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
        // Same "deliberately distinct" convention as newPasswordReqText
        // above -- only passes if the logo's alt text actually routes
        // through t() rather than a hardcoded "Logo" literal.
        "auth.resetPassword.logoAlt": "[i18n] Company logo",
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

  // Round 12 audit (aexa-frontend#502): the logo's alt text was a hardcoded
  // "Logo" literal, staying untranslated in French.
  it("routes the logo's alt text through t(), not a hardcoded 'Logo' literal", () => {
    renderAt("/reset-password?token=abc")

    expect(
      screen.getByRole("img", { name: "[i18n] Company logo" })
    ).toBeInTheDocument()
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

  it("toggles the new-password field between hidden and visible text via the show/hide button, independently per field", async () => {
    const user = userEvent.setup()
    renderAt("/reset-password?token=abc123")

    const newPasswordInput = screen.getByLabelText("New Password")
    const confirmPasswordInput = screen.getByLabelText("Confirm Password")
    expect(newPasswordInput).toHaveAttribute("type", "password")
    expect(confirmPasswordInput).toHaveAttribute("type", "password")

    const toggleButtons = screen.getAllByRole("button", { name: "common.showPassword" })
    expect(toggleButtons).toHaveLength(2)

    await user.click(toggleButtons[0])

    expect(newPasswordInput).toHaveAttribute("type", "text")
    // The other field's toggle is untouched -- confirms each PasswordInput
    // manages its own visibility state independently.
    expect(confirmPasswordInput).toHaveAttribute("type", "password")
    expect(
      screen.getByRole("button", { name: "common.hidePassword" })
    ).toBeInTheDocument()
  })

  it("wires the new-password field's error to an aria-describedby id with role=alert, only when an error is present", async () => {
    const user = userEvent.setup()
    renderAt("/reset-password?token=abc123")

    const newPasswordInput = screen.getByLabelText("New Password")
    expect(newPasswordInput).not.toHaveAttribute("aria-describedby")

    await user.type(screen.getByLabelText("Confirm Password"), "x")
    await user.click(screen.getByRole("button", { name: "Reset Password" }))

    const errorMessage = await screen.findByText("[i18n] Password is required")
    expect(errorMessage).toHaveAttribute("id", "newPassword-error")
    expect(errorMessage).toHaveAttribute("role", "alert")
    expect(newPasswordInput).toHaveAttribute(
      "aria-describedby",
      "newPassword-error"
    )
  })

  // Server-side password errors (errorSources) go through a manual
  // setError() call, which react-hook-form's shouldFocusError default does
  // NOT cover -- so this asserts the component explicitly moves focus there
  // itself, rather than leaving a keyboard/screen-reader user to tab-hunt.
  it("moves focus to the new-password field when a server-side password error is mapped via errorSources", async () => {
    const user = userEvent.setup()
    mockResetPasswordTrigger.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: {
            message: "Validation Error",
            errorSources: [
              { path: "newPass", message: "Password must contain at least one number." },
            ],
          },
        }),
    })

    renderAt("/reset-password?token=abc123")

    await user.type(screen.getByLabelText("New Password"), "onlyletters")
    await user.type(screen.getByLabelText("Confirm Password"), "onlyletters")
    await user.click(screen.getByRole("button", { name: "Reset Password" }))

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByLabelText("New Password")
      )
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

  // The backend's real password rule (10+ chars, a letter, a number) is
  // stricter than this form's own minLength check, so a password that
  // passes client-side validation can still be rejected server-side. A Zod
  // failure's top-level message is always the generic "Validation Error";
  // the real reason lives in errorSources, which must be mapped to the
  // field instead of shown as an unhelpful toast (same pattern
  // SignUpModal.test.tsx already covers for the signup form).
  it("surfaces a password-rule violation from errorSources as a field error, not a generic toast", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    // Other tests in this suite call toast.error without resetting it
    // afterward -- clear the shared mock so this test's assertion isn't
    // polluted by calls made earlier in the run (same convention
    // SignUpModal.test.tsx already uses).
    vi.mocked(toast.error).mockClear()
    mockResetPasswordTrigger.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: {
            message: "Validation Error",
            errorSources: [
              { path: "newPass", message: "Password must contain at least one number." },
            ],
          },
        }),
    })

    renderAt("/reset-password?token=abc123")

    await user.type(screen.getByLabelText("New Password"), "onlyletters")
    await user.type(screen.getByLabelText("Confirm Password"), "onlyletters")
    await user.click(screen.getByRole("button", { name: "Reset Password" }))

    expect(
      await screen.findByText("Password must contain at least one number.")
    ).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
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
