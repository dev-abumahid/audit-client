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

  describe("logo preview object URL lifecycle", () => {
    // Regression test for #259: URL.createObjectURL(logoFile) was called
    // inline during render, minting a new (never-revoked) blob URL on every
    // re-render instead of once per selected file.
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      let counter = 0
      createObjectURLSpy = vi
        .spyOn(URL, "createObjectURL")
        .mockImplementation(() => `blob:mock-${++counter}`)
      revokeObjectURLSpy = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => {})
    })

    afterEach(() => {
      createObjectURLSpy.mockRestore()
      revokeObjectURLSpy.mockRestore()
    })

    it("creates the object URL once per selected file, not once per re-render", async () => {
      const user = userEvent.setup()
      const file = new File(["fake-image-bytes"], "logo.png", {
        type: "image/png",
      })

      renderPage()
      await user.upload(screen.getByLabelText(/organization\.templates\.create\.upload/i), file)

      await waitFor(() => expect(createObjectURLSpy).toHaveBeenCalledTimes(1))
      expect(createObjectURLSpy).toHaveBeenCalledWith(file)

      // Trigger unrelated re-renders (typing elsewhere in the form) — the
      // object URL must not be re-minted on each keystroke.
      const nameInput = screen.getByPlaceholderText(
        /organization\.templates\.create\.namePlaceholder/i
      )
      await user.type(nameInput, "My Template")

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    })

    it("revokes the previous object URL when the file is replaced", async () => {
      const user = userEvent.setup()
      const file1 = new File(["a"], "logo1.png", { type: "image/png" })
      const file2 = new File(["b"], "logo2.png", { type: "image/png" })

      const { container } = renderPage()
      await user.upload(screen.getByLabelText(/organization\.templates\.create\.upload/i), file1)
      await waitFor(() => expect(createObjectURLSpy).toHaveBeenCalledTimes(1))
      const firstUrl = createObjectURLSpy.mock.results[0].value

      // Remove the current logo (the small round X button overlaid on the
      // preview, identified by its position class rather than an accessible
      // name — it has none), which re-exposes the upload input, then pick a
      // second file.
      const removeButton = container.querySelector(
        "button.absolute.-top-2"
      ) as HTMLElement
      await user.click(removeButton)
      const uploadInput = screen.getByLabelText(
        /organization\.templates\.create\.upload/i
      )
      await user.upload(uploadInput, file2)

      await waitFor(() => expect(createObjectURLSpy).toHaveBeenCalledTimes(2))
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(firstUrl)
    })

    it("revokes the object URL on unmount", async () => {
      const user = userEvent.setup()
      const file = new File(["fake-image-bytes"], "logo.png", {
        type: "image/png",
      })

      const { unmount } = renderPage()
      await user.upload(screen.getByLabelText(/organization\.templates\.create\.upload/i), file)
      await waitFor(() => expect(createObjectURLSpy).toHaveBeenCalledTimes(1))
      const url = createObjectURLSpy.mock.results[0].value

      unmount()

      expect(revokeObjectURLSpy).toHaveBeenCalledWith(url)
    })
  })

  // aexa-frontend#468: the normal (non-modal) view rendered zero heading
  // elements -- the only h3 was inside the conditionally-rendered "Add New"
  // modal.
  it("renders a page heading in the normal (non-modal) view", () => {
    renderPage()

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
  })

  it("gives the logo-remove button an accessible name", async () => {
    const user = userEvent.setup()
    const file = new File(["fake-image-bytes"], "logo.png", {
      type: "image/png",
    })

    renderPage()
    await user.upload(
      screen.getByLabelText(/organization\.templates\.create\.upload/i),
      file
    )

    expect(
      await screen.findByRole("button", {
        name: "organization.templates.create.removeLogo",
      })
    ).toBeInTheDocument()
  })

  it("submits the template and navigates away on success", async () => {
    mockCreateNewTemplate.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "Template created" }),
    })

    renderPage()
    await userEvent.click(screen.getByRole("button", { name: /organization\.templates\.create\.saveTemplate/i }))

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
    await userEvent.click(screen.getByRole("button", { name: /organization\.templates\.create\.saveTemplate/i }))

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
    await userEvent.click(screen.getByRole("button", { name: /organization\.templates\.create\.saveTemplate/i }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Server unavailable")
    )
    expect(mockNavigate).not.toHaveBeenCalled()
    // The page (and its filled-in form values) should still be here, not
    // replaced/unmounted by a failed submit.
    expect(
      screen.getByRole("button", { name: /organization\.templates\.create\.saveTemplate/i })
    ).toBeInTheDocument()
  })

  // aexa-frontend#336: a brand-new template's default content (name, first
  // section title, first question text, and "New Section N" when adding
  // another) was hardcoded English, bypassing i18n entirely under a French
  // UI. i18n isn't initialized in this test environment, so t() echoes the
  // raw key back (see FindingDetails.test.tsx for the same convention) --
  // these assertions confirm the values now come from t() calls at all,
  // which the literal English strings never did.
  describe("i18n'd default content (#336)", () => {
    it("seeds the template name field from the i18n default, not a hardcoded English string", () => {
      renderPage()

      expect(
        screen.getByPlaceholderText(
          /organization\.templates\.create\.namePlaceholder/i
        )
      ).toHaveValue("organization.templates.create.defaultTemplateName")
    })

    it("labels a newly added section with the interpolated i18n key, not a hardcoded 'New Section N' string", async () => {
      renderPage()

      await userEvent.click(
        screen.getByRole("button", {
          name: /organization\.templates\.create\.addNewSection/i,
        })
      )

      expect(
        screen.getByText("organization.templates.create.newSectionTitle")
      ).toBeInTheDocument()
      expect(screen.queryByText(/New Section/)).not.toBeInTheDocument()
    })
  })
})
