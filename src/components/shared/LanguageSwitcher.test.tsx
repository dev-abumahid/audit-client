import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import LanguageSwitcher from "./LanguageSwitcher"

const mockChangeLanguage = vi.fn()
let mockLanguage = "en"
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      get language() {
        return mockLanguage
      },
      changeLanguage: mockChangeLanguage,
    },
  }),
}))

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    mockChangeLanguage.mockReset()
    mockLanguage = "en"
  })

  it("renders a button for each supported language", () => {
    render(<LanguageSwitcher />)

    expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "FR" })).toBeInTheDocument()
  })

  it("switches the language when a language button is clicked", async () => {
    const user = userEvent.setup()
    render(<LanguageSwitcher />)

    await user.click(screen.getByRole("button", { name: "FR" }))

    expect(mockChangeLanguage).toHaveBeenCalledWith("fr")
  })

  // Raw <button>s default to type="submit" per HTML spec, which is a latent
  // bug if this switcher ever ends up inside a <form> (it's rendered inside
  // the sidebar, alongside other form-bearing controls elsewhere in the
  // app). Both language buttons here are raw <button>s.
  it("gives every button an explicit type", () => {
    render(<LanguageSwitcher />)

    const buttons = document.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      expect(button.type).toBe("button")
    })
  })
})
