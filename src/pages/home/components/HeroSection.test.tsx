import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import HeroSection from "./HeroSection"

// ── i18n ──────────────────────────────────────────────────────────────────────
const { mockT } = vi.hoisted(() => ({
  mockT: vi.fn((key: string) => {
    if (key === "home.hero.capabilities") {
      return ["Risk register & KRIs", "Compliance obligations"]
    }
    const map: Record<string, string> = {
      "home.hero.eyebrow": "Governance, Risk & Compliance",
      "home.hero.title1": "Manage risk",
      "home.hero.title2": "with confidence",
      "home.hero.subtitle": "A GRC platform for modern teams",
      "home.hero.btnStart": "Get Started",
      "home.hero.btnDemo": "Book a Demo",
      "home.hero.heroCaption": "Executive risk overview inside Qiyrix",
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

// ── sonner ────────────────────────────────────────────────────────────────────
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ── react-router navigate (used by SignInModal) ────────────────────────────────
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return { ...mod, useNavigate: () => vi.fn() }
})

// ── Redux dispatch (used by SignInModal) ────────────────────────────────────────
vi.mock("@/redux/hooks", () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: vi.fn(),
}))

// ── RTK Query auth API ────────────────────────────────────────────────────────
vi.mock("@/redux/apis/auth.api", () => ({
  useSignUpUserMutation: () => [vi.fn(), { isLoading: false }],
  useSignInUserMutation: () => [vi.fn()],
  useVerifyOtpMutation: () => [vi.fn(), { isLoading: false }],
  useResendOtpMutation: () => [vi.fn(), { isLoading: false }],
  useGetSocialProvidersQuery: () => ({ data: undefined, isLoading: false }),
  useForgetPasswordMutation: () => [vi.fn()],
}))

function renderHero() {
  return render(
    <MemoryRouter>
      <HeroSection />
    </MemoryRouter>
  )
}

describe("HeroSection", () => {
  beforeEach(() => {
    mockT.mockClear()
  })

  // Round 12 audit (aexa-frontend#502): the hero image's alt text was a
  // hardcoded, non-descriptive "hero-img" literal. The static <img> was
  // later replaced with a theme-aware HeroProductVisual component wrapped
  // in a role="img" element, so the accessible name is now asserted via
  // aria-label rather than the alt attribute.
  it("routes the hero visual's accessible name through t(), not a hardcoded literal", () => {
    renderHero()

    expect(
      screen.getByRole("img", { name: "home.hero.heroImageAlt" })
    ).toBeInTheDocument()
    expect(screen.queryByAltText("hero-img")).not.toBeInTheDocument()
  })

  it("opens the SignUp modal from the Get Started button", async () => {
    const user = userEvent.setup()
    renderHero()

    expect(screen.queryByText("Get Started with Us")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Get Started/ }))

    expect(screen.getByText("Get Started with Us")).toBeInTheDocument()
  })

  // Regression test for the dead "Sign In" link inside the Sign Up modal
  // opened from the Hero section: handleLoginClick used to be a no-op, so
  // clicking "Sign In" just closed the Sign Up modal with nothing replacing
  // it. Mirrors NavBar's handleSignInClick wiring (NavBar.tsx).
  it("closes the SignUp modal and opens the SignIn modal when Sign In is clicked inside it", async () => {
    const user = userEvent.setup()
    renderHero()

    await user.click(screen.getByRole("button", { name: /Get Started/ }))
    expect(screen.getByText("Get Started with Us")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Sign In" }))

    expect(screen.queryByText("Get Started with Us")).not.toBeInTheDocument()
    expect(screen.getByText("Welcome Back")).toBeInTheDocument()
  })

  // Regression test (review-loop finding, round 1): SignInModal always
  // renders a "Forgot Password?" button regardless of whether
  // onForgotPasswordClick is supplied. Without wiring it, clicking it just
  // silently closes the modal -- the same class of dead-link bug this PR
  // fixes for handleLoginClick. Mirrors NavBar's handleForgotPassword wiring.
  it("closes the SignIn modal and opens the ForgotPassword modal when Forgot Password is clicked inside it", async () => {
    const user = userEvent.setup()
    renderHero()

    await user.click(screen.getByRole("button", { name: /Get Started/ }))
    await user.click(screen.getByRole("button", { name: "Sign In" }))
    expect(screen.getByText("Welcome Back")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Forgot Password?" }))

    expect(screen.queryByText("Welcome Back")).not.toBeInTheDocument()
    expect(screen.getByText("Reset Password")).toBeInTheDocument()
  })

  // Regression test: the "Book a Demo" button had no onClick at all, so it
  // was completely dead. No in-app demo-booking flow exists yet, so it opens
  // a pre-filled mailto as a minimal fallback -- assert that actually fires
  // rather than just checking the button renders.
  it("opens a pre-filled mailto when Book a Demo is clicked", async () => {
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

    renderHero()
    await user.click(screen.getByRole("button", { name: /Book a Demo/ }))

    expect(hrefSetter).toHaveBeenCalledWith(
      expect.stringContaining("mailto:hello@qiyrix.com")
    )
  })

  // Raw <button>s default to type="submit" per HTML spec, which is a latent
  // bug if this section ever ends up inside a <form>. Both buttons rendered
  // by HeroSection itself (before any modal is opened) are raw <button>s.
  it("gives every button an explicit type", () => {
    renderHero()

    const buttons = document.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      expect(button.type).toBe("button")
    })
  })
})
