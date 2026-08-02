import { render, screen } from "@testing-library/react"
import SocialLoginButtons from "./SocialLoginButtons"

const mockUseGetSocialProvidersQuery = vi.fn()
vi.mock("@/redux/apis/auth.api", () => ({
  useGetSocialProvidersQuery: () => mockUseGetSocialProvidersQuery(),
}))

// ── i18n ──────────────────────────────────────────────────────────────────────
const { mockT } = vi.hoisted(() => ({
  mockT: vi.fn((key: string) => {
    const map: Record<string, string> = {
      "auth.signUp.orContinueWith": "or continue with",
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

describe("SocialLoginButtons", () => {
  beforeEach(() => {
    mockUseGetSocialProvidersQuery.mockReset()
  })

  it("renders nothing while loading", () => {
    mockUseGetSocialProvidersQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })
    const { container } = render(<SocialLoginButtons />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing on a query error (data stays undefined)", () => {
    mockUseGetSocialProvidersQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })
    const { container } = render(<SocialLoginButtons />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when no provider is configured", () => {
    mockUseGetSocialProvidersQuery.mockReturnValue({
      data: {
        data: { google: false, facebook: false, twitter: false, github: false },
      },
      isLoading: false,
    })
    const { container } = render(<SocialLoginButtons />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders only the buttons for configured providers", () => {
    mockUseGetSocialProvidersQuery.mockReturnValue({
      data: {
        data: { google: true, facebook: false, twitter: false, github: true },
      },
      isLoading: false,
    })
    render(<SocialLoginButtons />)

    expect(screen.getByRole("link", { name: /google/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /github/i })).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /facebook/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /twitter/i })
    ).not.toBeInTheDocument()
  })

  it("points each button at the correct social redirect URL", () => {
    mockUseGetSocialProvidersQuery.mockReturnValue({
      data: { data: { google: true, facebook: true, twitter: false, github: false } },
      isLoading: false,
    })
    render(<SocialLoginButtons />)

    const google = screen.getByRole("link", { name: /google/i })
    const facebook = screen.getByRole("link", { name: /facebook/i })
    expect(google.getAttribute("href")).toMatch(/\/auth\/social\/google$/)
    expect(facebook.getAttribute("href")).toMatch(/\/auth\/social\/facebook$/)
  })

  // Regression test: the "or continue with" divider text was a hardcoded
  // English string with no t() call.
  it("renders the divider text through i18n", () => {
    mockUseGetSocialProvidersQuery.mockReturnValue({
      data: { data: { google: true, facebook: false, twitter: false, github: false } },
      isLoading: false,
    })
    render(<SocialLoginButtons />)

    expect(screen.getByText("or continue with")).toBeInTheDocument()
    expect(mockT).toHaveBeenCalledWith("auth.signUp.orContinueWith")
  })
})
