import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import CreateTemplatePage from "./CreateTemplatePage"

// jsdom has no IntersectionObserver; useSectionScroll only uses it to track
// scroll position, which this test doesn't exercise.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockCreateNewTemplate = vi.fn()
vi.mock("@/redux/apis/organization/template.api", () => ({
  useCreateNewTemplateMutation: () => [
    mockCreateNewTemplate,
    { isLoading: false },
  ],
}))

// PageSection pulls in dnd-kit and its own mutations — irrelevant to the
// submit-failure handling under test, so it's stubbed to a no-op section.
vi.mock("./PageSection", () => ({
  default: () => <div data-testid="page-section" />,
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <CreateTemplatePage />
    </MemoryRouter>
  )
}

describe("CreateTemplatePage", () => {
  beforeEach(() => {
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockNavigate.mockReset()
    mockCreateNewTemplate.mockReset()
  })

  it("submits the template and navigates away on success", async () => {
    mockCreateNewTemplate.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "Template created" }),
    })

    renderPage()
    await userEvent.click(screen.getByRole("button", { name: /save template/i }))

    await waitFor(() => expect(mockCreateNewTemplate).toHaveBeenCalled())
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith("Template created")
    )
    expect(mockNavigate).toHaveBeenCalledWith("/organization/audit/templates")
  })

  it("shows an error toast when the create response indicates failure, and does not navigate away", async () => {
    mockCreateNewTemplate.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: false, message: "Template name taken" }),
    })

    renderPage()
    await userEvent.click(screen.getByRole("button", { name: /save template/i }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Template name taken")
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("shows an error toast and does not navigate away when the create request rejects (unhandled rejection)", async () => {
    mockCreateNewTemplate.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "Server unavailable" } }),
    })

    renderPage()
    await userEvent.click(screen.getByRole("button", { name: /save template/i }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Server unavailable")
    )
    expect(mockNavigate).not.toHaveBeenCalled()
    // The page (and its filled-in form values) should still be here, not
    // replaced/unmounted by a failed submit.
    expect(
      screen.getByRole("button", { name: /save template/i })
    ).toBeInTheDocument()
  })
})
