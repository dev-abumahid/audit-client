import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import SignInModal from "./SignInModal"

// ── i18n ──────────────────────────────────────────────────────────────────────
// mockT is a spy (not just a plain function) so tests can assert a specific
// key was actually looked up -- a plain "does this text appear" assertion
// can't distinguish t(key) from a hardcoded string that happens to match the
// mocked value, which would defeat the point of a regression test for "this
// string must go through i18n."
const { mockT } = vi.hoisted(() => ({
  mockT: vi.fn((key: string) => {
    const map: Record<string, string> = {
      "auth.signIn.title": "Welcome Back",
      "auth.signIn.subTitle": "Sign in to your account",
      "auth.signUp.email": "Email",
      "auth.signUp.password": "Password",
      "auth.signIn.btnForgotPassword": "Forgot Password?",
      "auth.signIn.btnSignIn": "Sign In",
      "auth.signIn.hintText": "Don't have an account?",
      "auth.signIn.signingIn": "Signing In...",
      "auth.signUp.btnSignUp": "Sign Up",
      "auth.signUp.emailReqText": "Email is required",
      "auth.signUp.emailInvalidText": "Please enter a valid email",
      "auth.signUp.passwordReqText": "Password is required",
      "auth.genericError": "Something went wrong",
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

// ── react-router navigate ─────────────────────────────────────────────────────
const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return { ...mod, useNavigate: () => mockNavigate }
})

// ── Redux dispatch ─────────────────────────────────────────────────────────────
const mockDispatch = vi.fn()
vi.mock("@/redux/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn(),
}))

// ── RTK Query auth API ────────────────────────────────────────────────────────
const mockSignInTrigger = vi.fn()
vi.mock("@/redux/apis/auth.api", () => ({
  useSignInUserMutation: () => [mockSignInTrigger],
  // No providers configured — SocialLoginButtons renders nothing, same as
  // this test suite's assumptions before SocialLoginButtons existed.
  useGetSocialProvidersQuery: () => ({ data: undefined, isLoading: false }),
}))

// ─────────────────────────────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSignUpClick: vi.fn(),
  onForgotPasswordClick: vi.fn(),
}

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <SignInModal {...defaultProps} {...props} />
    </MemoryRouter>
  )
}

describe("SignInModal", () => {
  beforeEach(() => {
    mockSignInTrigger.mockReset()
    mockNavigate.mockReset()
    mockDispatch.mockReset()
    mockT.mockClear()
  })

  it("renders the sign-in form", () => {
    renderModal()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument()
  })

  it("shows translated required-field messages when submitted empty", async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole("button", { name: "Sign In" }))

    expect(await screen.findByText("Email is required")).toBeInTheDocument()
    expect(screen.getByText("Password is required")).toBeInTheDocument()
    expect(mockSignInTrigger).not.toHaveBeenCalled()
    // Not just "this text is present" -- proves the messages actually came
    // from t(), not hardcoded strings that happen to match the mock.
    expect(mockT).toHaveBeenCalledWith("auth.signUp.emailReqText")
    expect(mockT).toHaveBeenCalledWith("auth.signUp.passwordReqText")
  })

  it("calls useSignInUserMutation trigger on submit with correct args", async () => {
    const user = userEvent.setup()

    // unwrap() resolves to a success response
    mockSignInTrigger.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: "Signed in",
          data: { role: "ORGANIZATION" },
        }),
    })

    renderModal()

    await user.type(screen.getByLabelText("Email"), "test@example.com")
    await user.type(screen.getByLabelText("Password"), "secret123")
    await user.click(screen.getByRole("button", { name: "Sign In" }))

    await waitFor(() =>
      expect(mockSignInTrigger).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "secret123",
      })
    )
  })

  it("resets the RTK Query cache before loading the new user in on successful sign-in", async () => {
    const user = userEvent.setup()

    mockSignInTrigger.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: "Signed in",
          data: { role: "ORGANIZATION" },
        }),
    })

    renderModal()

    await user.type(screen.getByLabelText("Email"), "test@example.com")
    await user.type(screen.getByLabelText("Password"), "secret123")
    await user.click(screen.getByRole("button", { name: "Sign In" }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())

    // Regression check for aexa-frontend#249 -- without this, a quick
    // account switch in the same tab could serve the previous user's
    // cached RTK Query data (e.g. cross-tenant org data) to the new user.
    const resetApiStateCallIndex = mockDispatch.mock.calls.findIndex(
      (call) => call[0]?.type === "baseApi/resetApiState"
    )
    const setUserCallIndex = mockDispatch.mock.calls.findIndex(
      (call) => call[0]?.type === "user/setUser"
    )
    expect(resetApiStateCallIndex).toBeGreaterThanOrEqual(0)
    expect(setUserCallIndex).toBeGreaterThanOrEqual(0)
    // The test name promises resetApiState fires *before* the new user is
    // loaded in -- assert the ordering itself, not just that both dispatches
    // happened, so a future refactor that swaps the order fails this test.
    expect(resetApiStateCallIndex).toBeLessThan(setUserCallIndex)
  })

  it("shows the translated loading label while the sign-in request is pending", async () => {
    const user = userEvent.setup()

    // Deliberately never resolves within this test -- only need to observe
    // the button's text while isSubmitting is true, not the eventual result.
    mockSignInTrigger.mockReturnValue({
      unwrap: () => new Promise(() => {}),
    })

    renderModal()

    await user.type(screen.getByLabelText("Email"), "test@example.com")
    await user.type(screen.getByLabelText("Password"), "secret123")
    await user.click(screen.getByRole("button", { name: "Sign In" }))

    expect(await screen.findByText("Signing In...")).toBeInTheDocument()
    // Not just "this text is present" -- proves the label actually came
    // from t(), not a hardcoded string that happens to match the mock.
    expect(mockT).toHaveBeenCalledWith("auth.signIn.signingIn")
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

  it("shows error toast when mutation rejects", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")

    mockSignInTrigger.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "Invalid credentials" } }),
    })

    renderModal()

    await user.type(screen.getByLabelText("Email"), "bad@example.com")
    await user.type(screen.getByLabelText("Password"), "wrongpass")
    await user.click(screen.getByRole("button", { name: "Sign In" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Invalid credentials")
    )
  })

  it("falls back to the generic i18n error when a network error has no message", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")

    // Simulates a network failure: `error.data` is undefined, so there is
    // no server-supplied message at all (aexa-frontend#447).
    mockSignInTrigger.mockReturnValue({
      unwrap: () => Promise.reject({}),
    })

    renderModal()

    await user.type(screen.getByLabelText("Email"), "test@example.com")
    await user.type(screen.getByLabelText("Password"), "secret123")
    await user.click(screen.getByRole("button", { name: "Sign In" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Something went wrong")
    )
    expect(mockT).toHaveBeenCalledWith("auth.genericError")
  })

  it("sets autoComplete on the email and password fields so password managers can fill them", () => {
    renderModal()

    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autoComplete",
      "email"
    )
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autoComplete",
      "current-password"
    )
  })

  it("uses a real email input with format validation, not a bare text field", async () => {
    const user = userEvent.setup()
    renderModal()

    const emailInput = screen.getByLabelText("Email")
    expect(emailInput).toHaveAttribute("type", "email")

    await user.type(emailInput, "not-an-email")
    await user.type(screen.getByLabelText("Password"), "secret123")
    await user.click(screen.getByRole("button", { name: "Sign In" }))

    expect(
      await screen.findByText("Please enter a valid email")
    ).toBeInTheDocument()
    expect(mockSignInTrigger).not.toHaveBeenCalled()
    expect(mockT).toHaveBeenCalledWith("auth.signUp.emailInvalidText")
  })
})
