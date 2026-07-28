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

const mockUpdateTemplateBasics = vi.fn()
vi.mock("@/redux/apis/organization/template.api", () => ({
  useGetSingleTemplateQuery: () => ({
    data: {
      data: {
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
      },
    },
    isLoading: false,
  }),
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
})
