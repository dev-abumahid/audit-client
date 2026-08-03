import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import EditTemplatePage from "./EditTemplatePage"

// jsdom has no IntersectionObserver; useSectionScroll only uses it to track
// scroll position, which this test doesn't exercise.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
    useParams: () => ({ id: "template-1" }),
  }
})

function makeTemplateData(overrides = {}) {
  return {
    templateName: "Existing Template",
    templateDisc: "",
    templateLogo: null,
    pages: [
      {
        id: "p1",
        title: "General Information",
        questions: [
          {
            id: "q1",
            question: "Site Conducted",
            isRequired: true,
            answerType: "input",
            value: "text",
          },
        ],
      },
    ],
    ...overrides,
  }
}

const mockUpdateTemplateBasics = vi.fn()
const mockUseGetSingleTemplateQuery = vi.fn()
vi.mock("@/redux/apis/organization/template.api", () => ({
  useGetSingleTemplateQuery: (...args: unknown[]) =>
    mockUseGetSingleTemplateQuery(...args),
  useUpdateTemplateBasicsMutation: () => [
    mockUpdateTemplateBasics,
    { isLoading: false },
  ],
}))

// EditPageSection pulls in dnd-kit and its own mutations — irrelevant to the
// logo-preview object URL lifecycle under test, so it's stubbed to a no-op
// section, matching CreateTemplatePage.test.tsx's treatment of PageSection.
vi.mock("./EditPagesection", () => ({
  default: () => <div data-testid="edit-page-section" />,
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <EditTemplatePage />
    </MemoryRouter>
  )
}

describe("EditTemplatePage", () => {
  beforeEach(() => {
    mockUpdateTemplateBasics.mockReset()
    mockUseGetSingleTemplateQuery.mockReset()
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplateData() },
      isLoading: false,
    })
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
      await user.type(nameInput, " updated")

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
  // elements.
  it("renders a page heading in the normal (non-modal) view", () => {
    renderPage()

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
  })

  it("gives the logo-remove button an accessible name when a template logo is loaded", () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: {
        data: makeTemplateData({ templateLogo: "https://cdn.example/logo.png" }),
      },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByRole("button", {
        name: "organization.templates.create.removeLogo",
      })
    ).toBeInTheDocument()
  })

  // aexa-frontend#336: fallback default content (used when the loaded
  // template has no name, or when adding a new section) was hardcoded
  // English, bypassing i18n entirely under a French UI. i18n isn't
  // initialized in this test environment, so t() echoes the raw key back
  // (see FindingDetails.test.tsx for the same convention) -- these
  // assertions confirm the values now come from t() calls, which the
  // literal English strings never did.
  describe("i18n'd default content (#336)", () => {
    it("falls back to the i18n default template name, not a hardcoded English string, when the loaded template has no name", () => {
      mockUseGetSingleTemplateQuery.mockReturnValue({
        data: { data: makeTemplateData({ templateName: "" }) },
        isLoading: false,
      })

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

  // aexa-frontend#377 -- TemplatesPage.tsx hides the Edit link for the
  // system template, but this route is directly reachable by URL
  // regardless (bookmark, typed URL, restored tab). The edit form itself
  // must refuse to load for it, not just have its entry point hidden
  // elsewhere.
  describe("system template protection (#377)", () => {
    it("blocks the edit form and shows an explanation for the system 'AI-Generated Findings' template", () => {
      mockUseGetSingleTemplateQuery.mockReturnValue({
        data: {
          data: makeTemplateData({
            templateName: "⚙ AI-Generated Findings (system, do not edit)",
          }),
        },
        isLoading: false,
      })

      renderPage()

      expect(
        screen.getByText(
          "organization.templates.edit.systemTemplateBlockedTitle"
        )
      ).toBeInTheDocument()
      // The actual edit form (with its autosaving name field) must not be
      // rendered at all, not just visually de-emphasized.
      expect(screen.queryByDisplayValue(/AI-Generated Findings/)).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", {
          name: "organization.templates.edit.saveChanges",
        })
      ).not.toBeInTheDocument()
    })

    it("renders the edit form as normal for a non-system template", () => {
      renderPage()

      expect(
        screen.queryByText(
          "organization.templates.edit.systemTemplateBlockedTitle"
        )
      ).not.toBeInTheDocument()
      expect(screen.getByDisplayValue("Existing Template")).toBeInTheDocument()
    })
  })
})
