import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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
  useGetTemplateCategoriesQuery: () => ({ data: { data: [] } }),
}))

// EditPageSection pulls in dnd-kit and its own mutations — irrelevant to the
// logo-preview object URL lifecycle under test, so it's stubbed to a no-op
// section, matching CreateTemplatePage.test.tsx's treatment of PageSection.
// Still exposes its onOpenAddModal trigger as a plain button so the
// aexa-frontend#485 regression test below can reach the "Add New" modal
// (owned by this page, not EditPageSection) without pulling in dnd-kit.
vi.mock("./EditPagesection", () => ({
  default: ({
    pageIndex,
    onOpenAddModal,
  }: {
    pageIndex: number
    onOpenAddModal: (pageIndex: number) => void
  }) => (
    <div data-testid="edit-page-section">
      <button type="button" onClick={() => onOpenAddModal(pageIndex)}>
        open add modal
      </button>
    </div>
  ),
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
      await user.upload(
        screen.getByLabelText(/organization\.templates\.create\.upload/i),
        file
      )

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
      await user.upload(
        screen.getByLabelText(/organization\.templates\.create\.upload/i),
        file1
      )
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
      await user.upload(
        screen.getByLabelText(/organization\.templates\.create\.upload/i),
        file
      )
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
        data: makeTemplateData({
          templateLogo: "https://cdn.example/logo.png",
        }),
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
      expect(
        screen.queryByDisplayValue(/AI-Generated Findings/)
      ).not.toBeInTheDocument()
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

  // Positive baseline for the #485 regression test below: proves
  // mockUpdateTemplateBasics is genuinely wired to this page's save path
  // (via useAutoSave -> handleSave -> updateTemplateBasics), so the
  // "Cancel does NOT call it" assertion below is actually testing
  // something -- without this, that assertion would pass vacuously even
  // if Save were completely disconnected from updateTemplateBasics.
  it("calls updateTemplateBasics once a form change triggers auto-save", async () => {
    mockUpdateTemplateBasics.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })
    renderPage()

    const nameInput = screen.getByDisplayValue("Existing Template")
    fireEvent.change(nameInput, {
      target: { value: "Existing Template (edited)" },
    })

    await waitFor(() => expect(mockUpdateTemplateBasics).toHaveBeenCalled(), {
      timeout: 3000,
    })
  }, 6000)

  // quality-bar-loop round 4 (industry-standards): category/tag support.
  it("loads the existing category into the field and includes edits in the save payload", async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: { data: makeTemplateData({ category: "Safety" }) },
      isLoading: false,
    })
    mockUpdateTemplateBasics.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    renderPage()

    const categoryInput = await screen.findByDisplayValue("Safety")
    fireEvent.change(categoryInput, { target: { value: "Quality" } })

    await waitFor(() => expect(mockUpdateTemplateBasics).toHaveBeenCalled(), {
      timeout: 3000,
    })
    const call = mockUpdateTemplateBasics.mock.calls[0][0] as {
      data: FormData
    }
    const payload = JSON.parse(call.data.get("data") as string)
    expect(payload.category).toBe("Quality")
  }, 6000)

  // Found by PR #675's review while auditing isSystemTemplate.ts's other
  // consumer -- this catch block read `error?.message`, but RTK Query's
  // fetchBaseQuery rejection nests the server message under `data`, not
  // `message` directly (same bug class fixed on TemplatesPage.tsx).
  it("shows the server's error message when auto-save fails", async () => {
    mockUpdateTemplateBasics.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Name already taken" } }),
    })
    renderPage()

    const nameInput = screen.getByDisplayValue("Existing Template")
    fireEvent.change(nameInput, {
      target: { value: "Existing Template (edited)" },
    })

    const { toast } = await import("sonner")
    await waitFor(
      () => expect(toast.error).toHaveBeenCalledWith("Name already taken"),
      { timeout: 3000 }
    )
  }, 6000)

  // Round 14 (#516) -- the templateName Controller had no validation rules
  // at all, unlike SitesEntities.tsx's site-name field (validates
  // non-empty-after-trim with a visible error). A user could clear Template
  // Name entirely with zero client-side warning.
  it("shows a visible error when the template name is cleared, mirroring SitesEntities' site-name pattern", async () => {
    mockUpdateTemplateBasics.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })
    renderPage()

    const nameInput = screen.getByDisplayValue("Existing Template")
    fireEvent.change(nameInput, { target: { value: "" } })

    await waitFor(() =>
      expect(
        screen.getByText("organization.templates.create.nameRequired")
      ).toBeInTheDocument()
    )
  })

  it("shows the same visible error for a whitespace-only template name", async () => {
    mockUpdateTemplateBasics.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })
    renderPage()

    const nameInput = screen.getByDisplayValue("Existing Template")
    fireEvent.change(nameInput, { target: { value: "   " } })

    await waitFor(() =>
      expect(
        screen.getByText("organization.templates.create.nameRequired")
      ).toBeInTheDocument()
    )
  })

  // aexa-frontend#520 -- useAutoSave's setTimeout callback called
  // form.getValues()/onSave every 2s with no validation check, so clearing
  // the required templateName field showed the inline error above but
  // autosave still silently persisted the empty name via
  // updateTemplateBasics. Prove the persist call is actually blocked, not
  // just that the UI shows an error (the previous two tests only checked
  // the error text, which was already present before this fix).
  it("does not autosave the template while the required template name is empty (#520)", async () => {
    mockUpdateTemplateBasics.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })
    renderPage()

    const nameInput = screen.getByDisplayValue("Existing Template")
    fireEvent.change(nameInput, { target: { value: "" } })

    await waitFor(() =>
      expect(
        screen.getByText("organization.templates.create.nameRequired")
      ).toBeInTheDocument()
    )

    // Auto-save fires every 2s; give it comfortably past that window (extra
    // margin over the interval to avoid flaking under CI scheduling jitter)
    // and confirm it never persisted the invalid value.
    await new Promise((resolve) => setTimeout(resolve, 3500))
    expect(mockUpdateTemplateBasics).not.toHaveBeenCalled()
  }, 8000)

  // Same fix, opposite direction: once the name is valid again, autosave
  // must resume on its own -- it must not have permanently stalled from the
  // invalid attempt above (the retry has to be self-rescheduling, since
  // hasChanges stays "true" the whole time and won't re-trigger the effect).
  it("resumes autosave once the template name becomes valid again after being cleared (#520)", async () => {
    mockUpdateTemplateBasics.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })
    renderPage()

    const nameInput = screen.getByDisplayValue("Existing Template")
    fireEvent.change(nameInput, { target: { value: "" } })

    await waitFor(() =>
      expect(
        screen.getByText("organization.templates.create.nameRequired")
      ).toBeInTheDocument()
    )

    fireEvent.change(nameInput, { target: { value: "Fixed Name" } })

    await waitFor(
      () => expect(mockUpdateTemplateBasics).toHaveBeenCalled(),
      { timeout: 5000 }
    )
  }, 8000)

  // aexa-frontend#485 -- this page's entire body (including the "Add New"
  // modal below) is nested inside a single
  // <form onSubmit={handleSubmit(onSubmit)}>, where onSubmit calls
  // manualSave() (which persists via updateTemplateBasics). The modal's
  // Cancel button was missing type="button", so it defaulted to
  // type="submit" and clicking it would trigger a manual save instead of
  // just closing the modal.
  it("does not trigger a save when the Add New modal's Cancel button is clicked (#485)", async () => {
    renderPage()

    await userEvent.click(
      screen.getByRole("button", { name: "open add modal" })
    )
    expect(
      screen.getByText("organization.templates.create.addNew")
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.templates.create.cancel",
      })
    )

    expect(mockUpdateTemplateBasics).not.toHaveBeenCalled()
    expect(
      screen.queryByText("organization.templates.create.addNew")
    ).not.toBeInTheDocument()
  })

  // aexa-frontend#490 -- the "Add New" modal was a plain div with no
  // role="dialog", no aria-modal and no Escape handling, unlike KRI's
  // modals (round 10, #487).
  it("marks the Add New modal as a labeled dialog and closes it on Escape", async () => {
    renderPage()

    await userEvent.click(
      screen.getByRole("button", { name: "open add modal" })
    )
    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAccessibleName("organization.templates.create.addNew")

    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
