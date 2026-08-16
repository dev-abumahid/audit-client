import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import NavBar from "./NavBar"

// ── i18n ──────────────────────────────────────────────────────────────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}))

// ── redux ─────────────────────────────────────────────────────────────────────
vi.mock("@/redux/hooks", () => ({
  useAppSelector: () => undefined,
}))

// ── theme provider (ModeToggle's dependency) ────────────────────────────────────
vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}))

// ── Auth modals: stub out — NavBar's own wiring to them isn't the point here ───
vi.mock("@/pages/auth/SignInModal", () => ({
  default: () => null,
}))
vi.mock("../../pages/auth/SignUpModal", () => ({
  default: () => null,
}))
vi.mock("@/pages/auth/ForgotPasswordModal", () => ({
  default: () => null,
}))

function renderNavBar() {
  return render(
    <MemoryRouter>
      <NavBar />
    </MemoryRouter>
  )
}

describe("NavBar", () => {
  // Regression test: ModeToggle (dark/light switch) only rendered in the
  // desktop nav block ("hidden ... lg:flex") and was missing entirely from
  // the mobile hamburger menu, while LanguageSwitcher was present in both.
  it("renders the theme toggle inside the mobile menu alongside the language switcher", async () => {
    const user = userEvent.setup()
    renderNavBar()

    await user.click(screen.getByLabelText("home.navbar.toggleMenu"))

    // ModeToggle renders a visually-hidden label via t("common.toggleTheme"),
    // which the mocked t() returns verbatim as the key. It's now present
    // twice (desktop nav + mobile menu, both mounted in jsdom regardless of
    // the "hidden lg:flex" CSS that only hides the desktop copy visually).
    expect(screen.getAllByText("common.toggleTheme")).toHaveLength(2)
    // LanguageSwitcher's EN/FR buttons are likewise present in both blocks.
    expect(screen.getAllByText("EN")).toHaveLength(2)
    expect(screen.getAllByText("FR")).toHaveLength(2)
  })

  // quality-bar-loop-derived fix: this file's raw <button> elements (desktop
  // and mobile Login/Sign up, and the mobile hamburger toggle) had no
  // explicit type, defaulting to the implicit type="submit" -- harmless
  // only because this markup doesn't currently sit inside a <form>, but a
  // real footgun if it ever does. Scoped to just these five (not a full
  // sweep) since NavBar also mounts ModeToggle, which renders a shadcn
  // <Button> with its own separate, pre-existing type gap outside this
  // fix's scope.
  it("gives the Login/Sign up buttons and the hamburger toggle an explicit type=\"button\"", async () => {
    const user = userEvent.setup()
    renderNavBar()

    const desktopLogin = screen
      .getAllByText("home.navbar.login")
      .map((el) => el.closest("button"))
      .find((btn): btn is HTMLButtonElement => btn !== null)!
    expect(desktopLogin.type).toBe("button")

    const desktopSignUp = screen
      .getAllByText("home.navbar.signUp")
      .map((el) => el.closest("button"))
      .find((btn): btn is HTMLButtonElement => btn !== null)!
    expect(desktopSignUp.type).toBe("button")

    expect(
      (screen.getByLabelText("home.navbar.toggleMenu") as HTMLButtonElement)
        .type
    ).toBe("button")

    await user.click(screen.getByLabelText("home.navbar.toggleMenu"))

    screen
      .getAllByText("home.navbar.login")
      .map((el) => el.closest("button"))
      .filter((btn): btn is HTMLButtonElement => btn !== null)
      .forEach((btn) => expect(btn.type).toBe("button"))
    screen
      .getAllByText("home.navbar.signUp")
      .map((el) => el.closest("button"))
      .filter((btn): btn is HTMLButtonElement => btn !== null)
      .forEach((btn) => expect(btn.type).toBe("button"))
  })

  // aexa-frontend#915: `dark:text-primary` was beating `hover:text-primary-foreground`
  // in the dark-mode cascade, so the Login/Dashboard text became invisible
  // against the `hover:bg-primary` background on hover. `dark:hover:text-white`
  // must be present on every button/link sharing this classname pattern
  // (desktop + mobile Login, and the equivalent Dashboard link) so hover text
  // stays readable in dark mode too.
  it("keeps Login/Dashboard hover text readable in dark mode via dark:hover:text-white", async () => {
    const user = userEvent.setup()
    renderNavBar()

    const desktopLogin = screen
      .getAllByText("home.navbar.login")
      .map((el) => el.closest("button"))
      .find((btn): btn is HTMLButtonElement => btn !== null)!
    expect(desktopLogin.className).toContain("dark:hover:text-white")

    await user.click(screen.getByLabelText("home.navbar.toggleMenu"))

    screen
      .getAllByText("home.navbar.login")
      .map((el) => el.closest("button"))
      .filter((btn): btn is HTMLButtonElement => btn !== null)
      .forEach((btn) =>
        expect(btn.className).toContain("dark:hover:text-white")
      )
  })

  // aexa-frontend#915: replaced the arbitrary-value `max-h-[32rem]` utility
  // with the equivalent scale-based `max-h-128` (128 * 0.25rem = 32rem).
  it("uses the max-h-128 utility (not the arbitrary max-h-[32rem] value) for the open mobile menu", async () => {
    const user = userEvent.setup()
    renderNavBar()

    await user.click(screen.getByLabelText("home.navbar.toggleMenu"))

    const mobileMenu = screen
      .getByLabelText("home.navbar.toggleMenu")
      .closest("div")!.nextElementSibling as HTMLElement
    expect(mobileMenu.className).toContain("max-h-128")
    expect(mobileMenu.className).not.toContain("max-h-[32rem]")
  })
})
