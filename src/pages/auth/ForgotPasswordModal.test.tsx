import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ForgotPasswordModal from "./ForgotPasswordModal"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "auth.forgotPassword.title": "Reset Your Password",
        "auth.forgotPassword.subTitle":
          "Enter your email and we will send you a reset link",
        "auth.forgotPassword.email": "Email",
        "auth.forgotPassword.emailReqText": "Email is required",
        "auth.forgotPassword.btnSend": "Send Reset Link",
        "auth.forgotPassword.sending": "Sending...",
        "auth.forgotPassword.successMessage":
          "If that email is registered, a reset link has been sent.",
        "auth.forgotPassword.backToSignIn": "Back to Sign In",
      }
      return map[key] ?? key
    },
  }),
}))

const mockForgetPasswordTrigger = vi.fn()
vi.mock("@/redux/apis/auth.api", () => ({
  useForgetPasswordMutation: () => [mockForgetPasswordTrigger],
}))

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onBackToSignIn: vi.fn(),
}

describe("ForgotPasswordModal", () => {
  beforeEach(() => {
    mockForgetPasswordTrigger.mockReset()
  })

  it("does not render when isOpen is false", () => {
    render(<ForgotPasswordModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText("Reset Your Password")).not.toBeInTheDocument()
  })

  it("renders as an accessible dialog with a labeled close button", () => {
    render(<ForgotPasswordModal {...defaultProps} />)

    // getByRole("dialog") only succeeds because Radix's DialogContent
    // renders role="dialog" -- the old hand-rolled <div> overlay had no such
    // role, so this query would have failed before the migration
    // (aexa-frontend#442).
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "common.close" })
    ).toBeInTheDocument()
  })

  it("closes on Escape key press", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ForgotPasswordModal {...defaultProps} onClose={onClose} />)

    expect(screen.getByRole("dialog")).toBeInTheDocument()

    await user.keyboard("{Escape}")

    expect(onClose).toHaveBeenCalled()
  })

  // type=button sweep finding: the close button had no explicit type,
  // defaulting to type="submit" -- inconsistent with every other non-
  // submit button in this file (form's own back-link, success-state
  // back-link), which already declared type="button" correctly. Covers
  // both mutually-exclusive states (form vs. success) so a sweep of only
  // the default render can't silently skip the success-state button.
  it("gives every non-submit button an explicit type in both the form and success states", async () => {
    const user = userEvent.setup()
    mockForgetPasswordTrigger.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })
    const { unmount } = render(<ForgotPasswordModal {...defaultProps} />)

    const sweep = () => {
      const buttons = document.querySelectorAll("button")
      expect(buttons.length).toBeGreaterThan(0)
      buttons.forEach((button) => {
        const isRealSubmit = button.textContent === "Send Reset Link"
        expect(button.type).toBe(isRealSubmit ? "submit" : "button")
      })
    }

    sweep() // form state: close, back-to-sign-in link, submit
    unmount()

    render(<ForgotPasswordModal {...defaultProps} />)
    await user.type(screen.getByLabelText("Email"), "person@test.com")
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }))
    await screen.findByText(
      "If that email is registered, a reset link has been sent."
    )

    sweep() // success state: close, back-to-sign-in link
  })

  it("submits the entered email and shows the success state", async () => {
    const user = userEvent.setup()
    mockForgetPasswordTrigger.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<ForgotPasswordModal {...defaultProps} />)

    await user.type(screen.getByLabelText("Email"), "person@test.com")
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }))

    await waitFor(() =>
      expect(mockForgetPasswordTrigger).toHaveBeenCalledWith({
        email: "person@test.com",
      })
    )
    expect(
      await screen.findByText(
        "If that email is registered, a reset link has been sent."
      )
    ).toBeInTheDocument()
  })

  it("shows the same success state on failure too, to avoid leaking whether an email is registered", async () => {
    const user = userEvent.setup()
    mockForgetPasswordTrigger.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Account not found" } }),
    })

    render(<ForgotPasswordModal {...defaultProps} />)

    await user.type(screen.getByLabelText("Email"), "nobody@test.com")
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }))

    expect(
      await screen.findByText(
        "If that email is registered, a reset link has been sent."
      )
    ).toBeInTheDocument()
    expect(screen.queryByText("Account not found")).not.toBeInTheDocument()
  })

  it("does not submit when the email field is empty", async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordModal {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: "Send Reset Link" }))

    expect(screen.getByText("Email is required")).toBeInTheDocument()
    expect(mockForgetPasswordTrigger).not.toHaveBeenCalled()
  })

  it("calls onBackToSignIn when the back link is clicked", async () => {
    const user = userEvent.setup()
    const onBackToSignIn = vi.fn()
    const onClose = vi.fn()

    render(
      <ForgotPasswordModal
        {...defaultProps}
        onClose={onClose}
        onBackToSignIn={onBackToSignIn}
      />
    )

    await user.click(screen.getByRole("button", { name: "Back to Sign In" }))

    expect(onClose).toHaveBeenCalled()
    expect(onBackToSignIn).toHaveBeenCalled()
  })

  it("sets autoComplete=email on the email field so password managers can fill it", () => {
    render(<ForgotPasswordModal {...defaultProps} />)

    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autoComplete",
      "email"
    )
  })
})
