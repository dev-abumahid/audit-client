import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import FinalCTASection from "./FinalCTASection"

// Same mocking convention as HeroSection.test.tsx, which duplicates the
// same SignUpModal/SignInModal/ForgotPasswordModal flow this section also
// mounts -- these modals hit real RTK Query hooks and useNavigate, neither
// of which have a Provider in this render tree.
const { mockT } = vi.hoisted(() => ({
  mockT: vi.fn((key: string) => {
    const map: Record<string, string> = {
      "home.finalCta.title": "See it running on your own data.",
      "home.finalCta.description":
        "Get started free, or talk to sales about rolling it out across your organization.",
      "home.finalCta.btnStart": "Get Started",
      "home.finalCta.btnContactSales": "Contact Sales",
      "auth.signUp.title": "Get Started with Us",
      "auth.signUp.subTitle": "Create your account to get started",
      "auth.signUp.organizationName": "Organization Name",
      "auth.signUp.email": "Email",
      "auth.signUp.password": "Password",
      "auth.signUp.btnSignUp": "Sign Up",
      "auth.signUp.btnClear": "Clear",
      "auth.signUp.hintText": "Already Signed up?",
      "auth.signIn.btnSignIn": "Sign In",
      "auth.signIn.title": "Welcome Back",
      "auth.signIn.subTitle": "Sign in to your account",
      "auth.signIn.btnForgotPassword": "Forgot Password?",
      "auth.signIn.hintText": "Don't have an account?",
      "auth.signUp.btnSignUpShort": "Sign Up",
      "auth.forgotPassword.title": "Reset Password",
      "auth.forgotPassword.subTitle": "Enter your email to reset your password",
      "auth.forgotPassword.email": "Email",
      "auth.forgotPassword.btnSend": "Send Reset Link",
      "auth.forgotPassword.backToSignIn": "Back to Sign In",
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

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return { ...mod, useNavigate: () => vi.fn() }
})

vi.mock("@/redux/hooks", () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: vi.fn(),
}))

vi.mock("@/redux/apis/auth.api", () => ({
  useSignUpUserMutation: () => [vi.fn(), { isLoading: false }],
  useSignInUserMutation: () => [vi.fn()],
  useVerifyOtpMutation: () => [vi.fn(), { isLoading: false }],
  useResendOtpMutation: () => [vi.fn(), { isLoading: false }],
  useGetSocialProvidersQuery: () => ({ data: undefined, isLoading: false }),
  useForgetPasswordMutation: () => [vi.fn()],
}))

function renderSection() {
  return render(
    <MemoryRouter>
      <FinalCTASection />
    </MemoryRouter>
  )
}

describe("FinalCTASection", () => {
  beforeEach(() => {
    mockT.mockClear()
  })

  it("renders the section header copy", () => {
    renderSection()
    expect(
      screen.getByText("See it running on your own data.")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Get started free, or talk to sales about rolling it out across your organization."
      )
    ).toBeInTheDocument()
  })

  it("opens the sign-up modal when Get Started is clicked", async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(screen.getByRole("button", { name: "Get Started" }))
    // Asserts the actual sign-up modal's own title text, not just "some
    // dialog opened" -- distinguishes the correct modal from the sign-in
    // or forgot-password modal accidentally opening instead.
    expect(await screen.findByText("Get Started with Us")).toBeInTheDocument()
  })

  // Regression coverage for the same class of bug HeroSection.test.tsx
  // already guards: Contact Sales must open a mailto, not be a dead button.
  it("opens a pre-filled mailto when Contact Sales is clicked, using Contact Sales wording", async () => {
    const user = userEvent.setup()
    const hrefSetter = vi.fn()
    Object.defineProperty(window, "location", {
      value: {
        get href() {
          return ""
        },
        set href(value: string) {
          hrefSetter(value)
        },
      },
      writable: true,
    })

    renderSection()
    await user.click(screen.getByRole("button", { name: "Contact Sales" }))

    const calledWith = hrefSetter.mock.calls[0][0] as string
    expect(calledWith).toContain("mailto:hello@qiyrix.com")
    // Review discipline from this whole initiative: a button's visible
    // label and its actual behavior must agree -- the label says "Contact
    // Sales," so the mailto content shouldn't still say "Demo Request"
    // (the stale mismatch this same PR fixed on HeroSection's own handler).
    expect(calledWith).toContain("Sales%20Inquiry")
    expect(calledWith).not.toContain("Demo%20Request")
  })

  it("gives every button an explicit type", () => {
    const { container } = renderSection()
    const buttons = container.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      expect(button).toHaveAttribute("type")
    })
  })
})
