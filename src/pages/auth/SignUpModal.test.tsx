import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import SignUpModal from "./SignUpModal"

// ── i18n ──────────────────────────────────────────────────────────────────────
// mockT is a spy (not just a plain function) so tests can assert a specific
// key was actually looked up -- a plain "does this text appear" assertion
// can't distinguish t(key) from a hardcoded string that happens to match the
// mocked value, which would defeat the point of a regression test for "this
// string must go through i18n." Same pattern used in SignInModal.test.tsx.
const { mockT } = vi.hoisted(() => ({
  mockT: vi.fn((key: string, options?: Record<string, unknown>) => {
    if (key === "auth.verifyOtp.resendCountdown" && options) {
      return `Resend in ${options.seconds}s`
    }
    const map: Record<string, string> = {
      "auth.signUp.title": "Get Started with Us",
      "auth.signUp.subTitle": "Create your account to get started",
      "auth.signUp.organizationName": "Organization Name",
      "auth.signUp.email": "Email",
      "auth.signUp.password": "Password",
      "auth.signUp.btnSignUp": "Sign Up",
      "auth.signUp.btnClear": "Clear",
      "auth.signUp.hintText": "Already Signed up?",
      "auth.signUp.signingUp": "Signing Up...",
      "auth.signIn.btnSignIn": "Sign In",
      "auth.signUp.organizationNameReqText": "Organization name is required",
      "auth.signUp.emailReqText": "Email is required",
      "auth.signUp.emailInvalidText": "Please enter a valid email",
      "auth.signUp.passwordReqText": "Password is required",
      "auth.signUp.passwordMinLengthReqText":
        "Password must be at least 10 characters",
      "auth.genericError": "Something went wrong",
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
  }),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: mockT,
    i18n: { changeLanguage: vi.fn() },
  }),
}))

// ── sonner ────────────────────────────────────────────────────────────────────
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ── RTK Query auth API ────────────────────────────────────────────────────────
const mockSignUpTrigger = vi.fn()
const mockVerifyOtpTrigger = vi.fn()
const mockResendOtpTrigger = vi.fn()
// let (not const) so the "Signing Up..." loading-label test can flip this
// before rendering without needing a per-test vi.mock override.
let mockSignUpIsLoading = false
vi.mock("@/redux/apis/auth.api", () => ({
  useSignUpUserMutation: () => [
    mockSignUpTrigger,
    {
      get isLoading() {
        return mockSignUpIsLoading
      },
    },
  ],
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

async function signUpAndReachOtpScreen(
  user: ReturnType<typeof userEvent.setup>
) {
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
    mockSignUpIsLoading = false
    mockT.mockClear()
  })

  it("renders as an accessible dialog with a labeled close button", () => {
    renderModal()

    // getByRole("dialog") only succeeds because Radix's DialogContent
    // renders role="dialog" -- the old hand-rolled <div> overlay had no such
    // role, so this query would have failed before the migration
    // (aexa-frontend#442).
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    // aexa-frontend#441: the icon-only close button needs an accessible
    // name, not just a visible X icon.
    expect(
      screen.getByRole("button", { name: "common.close" })
    ).toBeInTheDocument()
  })

  it("closes on Escape key press", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal({ onClose })

    expect(screen.getByRole("dialog")).toBeInTheDocument()

    await user.keyboard("{Escape}")

    expect(onClose).toHaveBeenCalled()
  })

  it("keeps the dialog accessible and the close button labeled on the OTP screen", async () => {
    const user = userEvent.setup()
    renderModal()
    await signUpAndReachOtpScreen(user)

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "common.close" })
    ).toBeInTheDocument()
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

  it("shows the translated loading label while the sign-up request is pending", () => {
    mockSignUpIsLoading = true
    renderModal()

    expect(screen.getByText("Signing Up...")).toBeInTheDocument()
    expect(screen.queryByText("Sign Up")).not.toBeInTheDocument()
    // Not just "this text is present" -- proves the label actually came
    // from t(), not a hardcoded string that happens to match the mock.
    expect(mockT).toHaveBeenCalledWith("auth.signUp.signingUp")
  })

  it("toggles the password field between hidden and visible text via the show/hide button", async () => {
    const user = userEvent.setup()
    renderModal()

    const passwordInput = screen.getByLabelText("Password")
    expect(passwordInput).toHaveAttribute("type", "password")

    const toggleButton = screen.getByRole("button", {
      name: "common.showPassword",
    })
    await user.click(toggleButton)

    expect(passwordInput).toHaveAttribute("type", "text")
    expect(
      screen.getByRole("button", { name: "common.hidePassword" })
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "common.hidePassword" })
    )
    expect(passwordInput).toHaveAttribute("type", "password")
  })

  it("wires the password field's error to an aria-describedby id with role=alert, only when an error is present", async () => {
    const user = userEvent.setup()
    renderModal()

    const passwordInput = screen.getByLabelText("Password")
    expect(passwordInput).not.toHaveAttribute("aria-describedby")

    await user.type(screen.getByLabelText("Organization Name"), "Acme Corp")
    await user.type(screen.getByLabelText("Email"), "admin@acme.com")
    await user.click(screen.getByRole("button", { name: "Sign Up" }))

    const errorMessage = await screen.findByText("Password is required")
    expect(errorMessage).toHaveAttribute("id", "password-error")
    expect(errorMessage).toHaveAttribute("role", "alert")
    expect(passwordInput).toHaveAttribute("aria-describedby", "password-error")
  })

  // Server-side password errors (errorSources) go through a manual
  // setError() call, which react-hook-form's shouldFocusError default does
  // NOT cover -- so this asserts the component explicitly moves focus there
  // itself, rather than leaving a keyboard/screen-reader user to tab-hunt.
  it("moves focus to the password field when a server-side password error is mapped via errorSources", async () => {
    const user = userEvent.setup()

    mockSignUpTrigger.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: {
            message: "Validation Error",
            errorSources: [
              {
                path: "password",
                message: "Password must contain at least one number.",
              },
            ],
          },
        }),
    })

    renderModal()

    await user.type(screen.getByLabelText("Organization Name"), "Acme Corp")
    await user.type(screen.getByLabelText("Email"), "admin@acme.com")
    await user.type(screen.getByLabelText("Password"), "onlyletters")
    await user.click(screen.getByRole("button", { name: "Sign Up" }))

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Password"))
    )
  })

  it("shows a translated message when password is left empty", async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText("Organization Name"), "Acme Corp")
    await user.type(screen.getByLabelText("Email"), "admin@acme.com")
    await user.click(screen.getByRole("button", { name: "Sign Up" }))

    expect(await screen.findByText("Password is required")).toBeInTheDocument()
    expect(mockSignUpTrigger).not.toHaveBeenCalled()
    // Not just "this text is present" -- proves the message actually came
    // from t(), not a hardcoded string that happens to match the mock.
    expect(mockT).toHaveBeenCalledWith("auth.signUp.passwordReqText")
  })

  it("shows a translated message when the email is present but not a valid format", async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText("Organization Name"), "Acme Corp")
    await user.type(screen.getByLabelText("Email"), "not-an-email")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.click(screen.getByRole("button", { name: "Sign Up" }))

    // Regression test for the bug where an invalid-but-non-empty email
    // always rendered the "required" message instead of the actual
    // validation error for whatever rule failed.
    expect(
      await screen.findByText("Please enter a valid email")
    ).toBeInTheDocument()
    expect(screen.queryByText("Email is required")).not.toBeInTheDocument()
    expect(mockSignUpTrigger).not.toHaveBeenCalled()
    expect(mockT).toHaveBeenCalledWith("auth.signUp.emailInvalidText")
  })

  it("shows a translated message when email is left empty", async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText("Organization Name"), "Acme Corp")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.click(screen.getByRole("button", { name: "Sign Up" }))

    expect(await screen.findByText("Email is required")).toBeInTheDocument()
    expect(mockSignUpTrigger).not.toHaveBeenCalled()
    expect(mockT).toHaveBeenCalledWith("auth.signUp.emailReqText")
  })

  it("shows a translated message when password is under 10 characters", async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText("Organization Name"), "Acme Corp")
    await user.type(screen.getByLabelText("Email"), "admin@acme.com")
    // 9 chars -- one short of the backend's 10-character minimum
    // (aexa-frontend#916: frontend previously allowed 8, backend requires 10).
    await user.type(screen.getByLabelText("Password"), "abcdefghi")
    await user.click(screen.getByRole("button", { name: "Sign Up" }))

    expect(
      await screen.findByText("Password must be at least 10 characters")
    ).toBeInTheDocument()
    expect(mockSignUpTrigger).not.toHaveBeenCalled()
    // Not just "this text is present" -- proves the message actually came
    // from t(), not a hardcoded string that happens to match the mock.
    expect(mockT).toHaveBeenCalledWith("auth.signUp.passwordMinLengthReqText")
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

  // type=button sweep finding: several non-submit buttons had no explicit
  // type, defaulting to type="submit" -- most critically the "Sign In"
  // link (auth.signIn.btnSignIn), which sits INSIDE this component's own
  // <form onSubmit={handleSubmit(onSubmit)}>. Without an explicit type,
  // clicking it would submit the signup form itself (if the fields
  // happened to pass validation) before onLoginClick() ever navigated
  // away -- a real, live bug, not just style inconsistency. Covers all
  // three mutually-exclusive screens (signup form, OTP entry, verified)
  // so a sweep of only the default render can't silently skip a button
  // that only mounts after a state transition.
  it("gives every non-submit button an explicit type across all three screens, so none default to implicit submit", async () => {
    const user = userEvent.setup()
    const { unmount } = renderModal()

    const sweep = (realSubmitLabels: string[]) => {
      const buttons = document.querySelectorAll("button")
      expect(buttons.length).toBeGreaterThan(0)
      buttons.forEach((button) => {
        const isRealSubmit = realSubmitLabels.some((label) =>
          button.textContent?.includes(label)
        )
        expect(button.type).toBe(isRealSubmit ? "submit" : "button")
      })
    }

    sweep(["Sign Up"]) // signup-form screen: close, Sign In link, Clear, Sign Up submit

    await signUpAndReachOtpScreen(user)
    sweep(["Verify Email"]) // OTP screen: close, Resend Code, Verify Email submit

    mockVerifyOtpTrigger.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })
    await user.type(screen.getByLabelText("Verification Code"), "A1b2C3")
    await user.click(screen.getByRole("button", { name: "Verify Email" }))
    await screen.findByText("Email Verified")

    sweep([]) // verified screen: close, Sign In (no real form left to submit)

    unmount()
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
    expect(screen.queryByLabelText("Verification Code")).not.toBeInTheDocument()
  })

  it("shows the server's error message when the OTP is wrong or expired", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    renderModal()
    await signUpAndReachOtpScreen(user)

    mockVerifyOtpTrigger.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: { message: "OTP Expired, Please try again!!" },
        }),
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

  it("sets autoComplete on the email and password fields so password managers can fill them", () => {
    renderModal()

    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autoComplete",
      "email"
    )
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autoComplete",
      "new-password"
    )
  })

  it("shows the generic i18n error when registration fails without a server message", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")

    mockSignUpTrigger.mockReturnValue({
      unwrap: () => Promise.reject({}),
    })

    renderModal()

    await user.type(screen.getByLabelText("Organization Name"), "Acme Corp")
    await user.type(screen.getByLabelText("Email"), "admin@acme.com")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.click(screen.getByRole("button", { name: "Sign Up" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Something went wrong")
    )
    expect(mockT).toHaveBeenCalledWith("auth.genericError")
  })

  // aexa-frontend#916: backend field validation errors (errorSources) were
  // previously discarded in favor of a generic toast, so the user never saw
  // which field(s) actually failed or why.
  it("maps backend errorSources onto their fields instead of showing a generic toast", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    // Other tests in this suite call toast.error without resetting it
    // afterward -- clear the shared mock so this test's assertion isn't
    // polluted by calls made earlier in the run.
    vi.mocked(toast.error).mockClear()

    mockSignUpTrigger.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: {
            message: "Validation Error",
            errorSources: [
              {
                path: "password",
                message: "Password must be at least 10 characters.",
              },
              {
                path: "password",
                message: "Password must contain at least one letter.",
              },
            ],
          },
        }),
    })

    renderModal()

    await user.type(screen.getByLabelText("Organization Name"), "Acme Corp")
    await user.type(screen.getByLabelText("Email"), "admin@acme.com")
    await user.type(screen.getByLabelText("Password"), "1234567890")
    await user.click(screen.getByRole("button", { name: "Sign Up" }))

    // Last errorSources entry for a field wins (react-hook-form's setError
    // overwrites, it doesn't accumulate) -- assert on that actual behavior.
    expect(
      await screen.findByText("Password must contain at least one letter.")
    ).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("toasts the actual unrecognized errorSources message instead of vanishing", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    vi.mocked(toast.error).mockClear()

    mockSignUpTrigger.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: {
            message: "Something is wrong upstream",
            // "confirmPassword" isn't a field this form renders -- setError
            // would silently register an error with nowhere to display it,
            // so this must surface via toast instead of vanishing. The
            // specific errorSources message is toasted (more actionable
            // than the generic top-level "Something is wrong upstream").
            errorSources: [
              { path: "confirmPassword", message: "Passwords must match." },
            ],
          },
        }),
    })

    renderModal()

    await user.type(screen.getByLabelText("Organization Name"), "Acme Corp")
    await user.type(screen.getByLabelText("Email"), "admin@acme.com")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.click(screen.getByRole("button", { name: "Sign Up" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Passwords must match.")
    )
  })

  it("still toasts an unrecognized errorSources entry even when another entry maps to a real field", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    vi.mocked(toast.error).mockClear()

    mockSignUpTrigger.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: {
            message: "Validation Error",
            errorSources: [
              {
                path: "password",
                message: "Password must be at least 10 characters.",
              },
              // Unrecognized path -- must not be silently dropped just
              // because the password entry above already rendered a field
              // error (the mappedAny-only check from the previous fix round
              // would have swallowed this one).
              { path: "confirmPassword", message: "Passwords must match." },
            ],
          },
        }),
    })

    renderModal()

    await user.type(screen.getByLabelText("Organization Name"), "Acme Corp")
    await user.type(screen.getByLabelText("Email"), "admin@acme.com")
    await user.type(screen.getByLabelText("Password"), "1234567890")
    await user.click(screen.getByRole("button", { name: "Sign Up" }))

    expect(
      await screen.findByText("Password must be at least 10 characters.")
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Passwords must match.")
    )
  })

  it("falls back to the generic toast when the server error has no errorSources", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")

    mockSignUpTrigger.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: { message: "Organization already exists" },
        }),
    })

    renderModal()

    await user.type(screen.getByLabelText("Organization Name"), "Acme Corp")
    await user.type(screen.getByLabelText("Email"), "admin@acme.com")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.click(screen.getByRole("button", { name: "Sign Up" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Organization already exists")
    )
  })

  it("disables Resend Code and counts down after a successful resend, re-enabling once it reaches zero", async () => {
    // Reach the OTP screen with real timers first -- userEvent/waitFor's
    // internal polling doesn't mix well with fake timers, so only the
    // cooldown countdown itself runs under them.
    const user = userEvent.setup()
    renderModal()
    await signUpAndReachOtpScreen(user)

    mockResendOtpTrigger.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    vi.useFakeTimers()

    const resendButton = screen.getByRole("button", { name: "Resend Code" })
    // fireEvent instead of userEvent here -- userEvent's internal delay
    // scheduling doesn't play well with fake timers, hanging the test.
    fireEvent.click(resendButton)
    expect(mockResendOtpTrigger).toHaveBeenCalled()
    // Flush the resolved mutation promise (and its follow-on state update)
    // so the countdown lands before we assert on it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    // Button is now disabled and shows a live countdown instead of being
    // immediately clickable again (aexa-frontend#444).
    expect(
      screen.getByRole("button", { name: "Resend in 30s" })
    ).toBeDisabled()

    for (let i = 0; i < 30; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })
    }

    expect(
      screen.getByRole("button", { name: "Resend Code" })
    ).not.toBeDisabled()

    vi.useRealTimers()
  })
})
