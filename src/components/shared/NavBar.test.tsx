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
})
