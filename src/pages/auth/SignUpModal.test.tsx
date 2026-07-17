import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import SignUpModal from "./SignUpModal"

// ── i18n ──────────────────────────────────────────────────────────────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "auth.signUp.title": "Get Started with Us",
        "auth.signUp.subTitle": "Create your account to get started",
        "auth.signUp.organizationName": "Organization Name",
        "auth.signUp.email": "Email",
        "auth.signUp.password": "Password",
        "auth.signUp.btnSignUp": "Sign Up",
        "auth.signUp.btnClear": "Clear",
        "auth.signUp.hintText": "Already Signed up?",
        "auth.signIn.btnSignIn": "Sign In",
        "auth.signUp.organizationNameReqText": "Organization name is required",
        "auth.signUp.emailReqText": "Email is required",
        "auth.signUp.passwordReqText": "Password is required",
        "auth.verifyOtp.title": "Check your email",
        "auth.verifyOtp.subTitle": "We sent a verification code to",
        "auth.verifyOtp.codeLabel": "Verification Code",
        "auth.verifyOtp.codeReqText": "Verification code is required",
        "auth.verifyOtp.codeLength": "Enter the 6-character code",
        "auth.verifyOtp.btnVerify": "Verify Email",
        "auth.verifyOtp.verifying": "Verifying...",
        "auth.verifyOtp.noCodeText": "Didn't get a code?",
        "auth.verifyOtp.btnResend": "Resend Code",
        "auth.verifyOtp.resending": "Resending...",
        "auth.verifyOtp.resendSuccess": "A new code has been sent to your email",
        "auth.verifyOtp.verifiedTitle": "Email Verified",
        "auth.verifyOtp.verifiedSubTitle":
          "Your account is ready. You can now sign in.",
      }
      return map[key] ?? key
    },
    i18n: { changeLanguage: vi.fn() },
  }),
}))

// ── sonner ────────────────────────────────────────────────────────────────────
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ── RTK Query auth API ────────────────────────────────────────────────────────
const mockSignUpTrigger = vi.fn()
const mockVerifyOtpTrigger = vi.fn()
const mockResendOtpTrigger = vi.fn()
vi.mock("@/redux/apis/auth.api", () => ({
  useSignUpUserMutation: () => [mockSignUpTrigger, { isLoading: false }],
  useVerifyOtpMutation: () => [mockVerifyOtpTrigger, { isLoading: false }],
  useResendOtpMutation: () => [mockResendOtpTrigger, { isLoading: false }],
  // No providers configured — SocialLoginButtons renders nothing, same as
  // this test suite's assumptions before SocialLoginButtons existed.
  useGetSocialProvidersQuery: () => ({ data: undefined, isLoading: false }),
}))

// ─────────────────────────────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onLoginClick: vi.fn(),
}

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <SignUpModal {...defaultProps} {...props} />
    </MemoryRouter>
  )
}

async function signUpAndReachOtpScreen(user: ReturnType<typeof userEvent.setup>) {
  mockSignUpTrigger.mockReturnValue({
    unwrap: () =>
      Promise.resolve({
        success: true,
        message: "Account created",
      }),
  })

  await user.type(screen.getByLabelText("Organization Name"), "Acme Corp")
  await user.type(screen.getByLabelText("Email"), "admin@acme.com")
  await user.type(screen.getByLabelText("Password"), "password123")
  await user.click(screen.getByRole("button", { name: "Sign Up" }))

  await waitFor(() =>
    expect(screen.getByLabelText("Verification Code")).toBeInTheDocument()
  )
}

describe("SignUpModal", () => {
  beforeEach(() => {
    mockSignUpTrigger.mockReset()
    mockVerifyOtpTrigger.mockReset()
    mockResendOtpTrigger.mockReset()
  })

  it("renders the sign-up form", () => {
    renderModal()
    expect(screen.getByLabelText("Organization Name")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeInTheDocument()
  })

  it("calls useSignUpUserMutation trigger on submit with correct args", async () => {
    const user = userEvent.setup()

    mockSignUpTrigger.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: "Account created",
        }),
    })

    renderModal()

    await user.type(screen.getByLabelText("Organization Name"), "Acme Corp")
    await user.type(screen.getByLabelText("Email"), "admin@acme.com")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.click(screen.getByRole("button", { name: "Sign Up" }))

    await waitFor(() =>
      expect(mockSignUpTrigger).toHaveBeenCalledWith({
        organizationName: "Acme Corp",
        email: "admin@acme.com",
        password: "password123",
      })
    )
  })

  it("shows email confirmation screen on success", async () => {
    const user = userEvent.setup()

    mockSignUpTrigger.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: "Account created",
        }),
    })

    renderModal()

    await user.type(screen.getByLabelText("Organization Name"), "Acme Corp")
    await user.type(screen.getByLabelText("Email"), "admin@acme.com")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.click(screen.getByRole("button", { name: "Sign Up" }))

    await waitFor(() =>
      expect(screen.getByText("Check your email")).toBeInTheDocument()
    )
    expect(screen.getByText("admin@acme.com")).toBeInTheDocument()
  })

  it("submits the entered OTP with the pending email and shows the verified state on success", async () => {
    const user = userEvent.setup()
    renderModal()
    await signUpAndReachOtpScreen(user)

    mockVerifyOtpTrigger.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    await user.type(screen.getByLabelText("Verification Code"), "A1b2C3")
    await user.click(screen.getByRole("button", { name: "Verify Email" }))

    await waitFor(() =>
      expect(mockVerifyOtpTrigger).toHaveBeenCalledWith({
        email: "admin@acme.com",
        otp: "A1b2C3",
      })
    )
    expect(await screen.findByText("Email Verified")).toBeInTheDocument()
    expect(
      screen.queryByLabelText("Verification Code")
    ).not.toBeInTheDocument()
  })

  it("shows the server's error message when the OTP is wrong or expired", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    renderModal()
    await signUpAndReachOtpScreen(user)

    mockVerifyOtpTrigger.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "OTP Expired, Please try again!!" } }),
    })

    await user.type(screen.getByLabelText("Verification Code"), "X9y8Z7")
    await user.click(screen.getByRole("button", { name: "Verify Email" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "OTP Expired, Please try again!!"
      )
    )
    // Stays on the entry screen so the user can retry, doesn't silently
    // advance to the verified state on a failure.
    expect(screen.getByLabelText("Verification Code")).toBeInTheDocument()
  })

  it("does not submit when the code field is empty", async () => {
    const user = userEvent.setup()
    renderModal()
    await signUpAndReachOtpScreen(user)

    await user.click(screen.getByRole("button", { name: "Verify Email" }))

    expect(
      screen.getByText("Verification code is required")
    ).toBeInTheDocument()
    expect(mockVerifyOtpTrigger).not.toHaveBeenCalled()
  })

  it("resends the code to the pending email and clears the input", async () => {
    const user = userEvent.setup()
    renderModal()
    await signUpAndReachOtpScreen(user)

    mockResendOtpTrigger.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    const codeInput = screen.getByLabelText(
      "Verification Code"
    ) as HTMLInputElement
    await user.type(codeInput, "A1b2C3")
    await user.click(screen.getByRole("button", { name: "Resend Code" }))

    await waitFor(() =>
      expect(mockResendOtpTrigger).toHaveBeenCalledWith({
        email: "admin@acme.com",
      })
    )
    await waitFor(() => expect(codeInput.value).toBe(""))
  })
})
