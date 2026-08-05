import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import ExternalLoginPage from "./ExternalLoginPage"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

const mockRequestCode = vi.fn()
const mockVerifyCode = vi.fn()
vi.mock("@/redux/apis/externalAuth.api", () => ({
  useRequestExternalCodeMutation: () => [
    mockRequestCode,
    { isLoading: false },
  ],
  useVerifyExternalCodeMutation: () => [mockVerifyCode, { isLoading: false }],
}))

const mockDispatch = vi.fn()
vi.mock("@/redux/hooks", () => ({
  useAppDispatch: () => mockDispatch,
}))

const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return { ...mod, useNavigate: () => mockNavigate }
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/external-login/:organizationId"
          element={<ExternalLoginPage />}
        />
      </Routes>
    </MemoryRouter>
  )
}

describe("ExternalLoginPage", () => {
  beforeEach(() => {
    mockRequestCode.mockReset()
    mockVerifyCode.mockReset()
    mockDispatch.mockReset()
    mockNavigate.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
  })

  // Round 12 audit (aexa-frontend#502): the logo's alt text was a hardcoded
  // "Logo" literal, staying untranslated in French.
  it("routes the logo's alt text through t(), not a hardcoded 'Logo' literal", () => {
    renderAt("/external-login/org-1")

    expect(
      screen.getByRole("img", { name: "externalAuth.login.logoAlt" })
    ).toBeInTheDocument()
  })

  it("shows an invalid-link state when the route has no organizationId", () => {
    render(
      <MemoryRouter initialEntries={["/external-login/"]}>
        <Routes>
          <Route path="/external-login/" element={<ExternalLoginPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(
      screen.getByText("externalAuth.login.invalidLink")
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  })

  it("requests a code with the route's organizationId and the typed email", async () => {
    const user = userEvent.setup()
    mockRequestCode.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    renderAt("/external-login/org-42")

    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "reviewer@partnerfirm.com"
    )
    await user.click(
      screen.getByRole("button", { name: "externalAuth.login.btnSendCode" })
    )

    await waitFor(() =>
      expect(mockRequestCode).toHaveBeenCalledWith({
        organizationId: "org-42",
        email: "reviewer@partnerfirm.com",
      })
    )
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("shows a generic error toast when requesting a code fails, without branching on the reason", async () => {
    const user = userEvent.setup()
    mockRequestCode.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Too many attempts" } }),
    })

    renderAt("/external-login/org-42")

    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "reviewer@partnerfirm.com"
    )
    await user.click(
      screen.getByRole("button", { name: "externalAuth.login.btnSendCode" })
    )

    // Generic message, not the server's own -- request-code always
    // resolves 200 by design (anti-enumeration), so the only realistic
    // failure is rate-limiting, and this UI doesn't try to distinguish it.
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "externalAuth.login.requestFailed"
      )
    )
  })

  it("advances to the code step after a code is requested, and verifies with the pending email", async () => {
    const user = userEvent.setup()
    mockRequestCode.mockReturnValue({ unwrap: () => Promise.resolve({}) })
    mockVerifyCode.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: {
            accessToken: "tok",
            externalOrgMemberId: "ext-1",
            email: "reviewer@partnerfirm.com",
            fullName: "Reviewer One",
          },
        }),
    })

    renderAt("/external-login/org-42")

    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "reviewer@partnerfirm.com"
    )
    await user.click(
      screen.getByRole("button", { name: "externalAuth.login.btnSendCode" })
    )

    expect(await screen.findByText("reviewer@partnerfirm.com")).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText("123456"), "123456")
    await user.click(
      screen.getByRole("button", { name: "externalAuth.login.btnVerify" })
    )

    await waitFor(() =>
      expect(mockVerifyCode).toHaveBeenCalledWith({
        organizationId: "org-42",
        email: "reviewer@partnerfirm.com",
        code: "123456",
      })
    )
    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            externalOrgMemberId: "ext-1",
            organizationId: "org-42",
            email: "reviewer@partnerfirm.com",
            fullName: "Reviewer One",
          },
        })
      )
    )
    expect(mockNavigate).toHaveBeenCalledWith("/external")
  })

  it("shows a generic invalid-code error on verify failure, regardless of the real reason (wrong code vs lockout)", async () => {
    const user = userEvent.setup()
    mockRequestCode.mockReturnValue({ unwrap: () => Promise.resolve({}) })
    mockVerifyCode.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "anything" } }),
    })

    renderAt("/external-login/org-42")
    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "reviewer@partnerfirm.com"
    )
    await user.click(
      screen.getByRole("button", { name: "externalAuth.login.btnSendCode" })
    )
    await screen.findByText("reviewer@partnerfirm.com")

    await user.type(screen.getByPlaceholderText("123456"), "000000")
    await user.click(
      screen.getByRole("button", { name: "externalAuth.login.btnVerify" })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "externalAuth.login.verifyFailed"
      )
    )
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  // Round 9 audit (#477): this form was missed when SignInModal/SignUpModal
  // got noValidate+autoComplete in the round-8 fix (#448). Without
  // noValidate, the browser's own constraint validation (native tooltip, in
  // the browser/OS locale) intercepts the submit before RHF's translated
  // `pattern` error ever shows.
  it("disables native browser validation and marks the email field as an email autofill target", () => {
    renderAt("/external-login/org-42")

    const emailInput = screen.getByPlaceholderText("you@example.com")
    const form = emailInput.closest("form")

    expect(form).toHaveAttribute("novalidate")
    expect(emailInput).toHaveAttribute("autocomplete", "email")
  })

  it("resends a code to the same pending email", async () => {
    const user = userEvent.setup()
    mockRequestCode.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    renderAt("/external-login/org-42")
    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "reviewer@partnerfirm.com"
    )
    await user.click(
      screen.getByRole("button", { name: "externalAuth.login.btnSendCode" })
    )
    await screen.findByText("reviewer@partnerfirm.com")
    mockRequestCode.mockClear()

    await user.click(
      screen.getByRole("button", { name: "externalAuth.login.btnResend" })
    )

    await waitFor(() =>
      expect(mockRequestCode).toHaveBeenCalledWith({
        organizationId: "org-42",
        email: "reviewer@partnerfirm.com",
      })
    )
  })
})
