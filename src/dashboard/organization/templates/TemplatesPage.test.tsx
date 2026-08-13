import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import TemplatesPage from "./TemplatesPage"

// Controllable `i18n.language` for the date-fns locale test below, while
// every other test in this file keeps relying on the real (uninitialized)
// react-i18next t(), which just echoes the raw key back -- same technique
// as TeamMembersTab.test.tsx.
let mockLanguage: string | undefined = undefined
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => {
      const real = mod.useTranslation()
      return { ...real, i18n: { ...real.i18n, language: mockLanguage } }
    },
  }
})

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// aexa-frontend#226 -- role hook mocked per-test via this mutable holder,
// same convention as RiskRegisterPage.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
}))

const mockUseGetAllTemplatesQuery = vi.fn()
const mockUseGetTemplateCategoriesQuery = vi.fn()
const mockDeleteTemplate = vi.fn()
const mockDuplicateTemplate = vi.fn()
// Mutable per-test, same convention as RiskRegisterPage.test.tsx's
// mockIsRiskDeleting -- lets the double-submission-guard test below flip
// this to true without a static mock.
let mockIsTemplateDeleting = false
let mockIsTemplateDuplicating = false

vi.mock("@/redux/apis/organization/template.api", () => ({
  useGetAllTemplatesQuery: (...args: unknown[]) =>
    mockUseGetAllTemplatesQuery(...args),
  useDeleteTemplateMutation: () => [
    mockDeleteTemplate,
    { isLoading: mockIsTemplateDeleting },
  ],
  useDuplicateTemplateMutation: () => [
    mockDuplicateTemplate,
    { isLoading: mockIsTemplateDuplicating },
  ],
  useGetTemplateCategoriesQuery: (...args: unknown[]) =>
    mockUseGetTemplateCategoriesQuery(...args),
}))

vi.mock("./shared/CreateTemplateWithAIDialog", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-template-ai-dialog" /> : null,
}))

vi.mock("@/components/shared/DeleteAlertModal", () => ({
  default: ({
    open,
    onConfirm,
    loading,
  }: {
    open: boolean
    onConfirm: () => void
    loading?: boolean
  }) =>
    open ? (
      <button onClick={onConfirm} disabled={loading}>
        Confirm delete
      </button>
    ) : null,
}))

function makeTemplate(overrides = {}) {
  return {
    id: "template-1",
    templateName: "ISO 27001 Audit Template",
    templateDisc: "Standard information security audit checklist",
    status: "PUBLISHED",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    access: [],
    ...overrides,
  }
}

describe("TemplatesPage", () => {
  beforeEach(() => {
    mockLanguage = undefined
    mockRole = "ADMIN"
    mockUseGetAllTemplatesQuery.mockReset()
    mockUseGetTemplateCategoriesQuery.mockReset()
    mockDeleteTemplate.mockReset()
    mockDuplicateTemplate.mockReset()
    mockIsTemplateDeleting = false
    mockIsTemplateDuplicating = false
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: { data: [makeTemplate()], meta: { total: 1 } },
      isLoading: false,
    })
    mockUseGetTemplateCategoriesQuery.mockReturnValue({ data: { data: [] } })
  })

  it("shows Generate Template, Create Template, Edit and Delete for an ADMIN", () => {
    render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

    expect(
      screen.getByText("organization.templates.list.generateTemplate")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.templates.list.createTemplate")
    ).toBeInTheDocument()
    expect(
      screen.queryAllByRole("button").some((b) => b.querySelector("svg.lucide-square-pen"))
    ).toBe(true)
    expect(
      screen.queryAllByRole("button").some((b) => b.querySelector("svg.lucide-trash2"))
    ).toBe(true)
  })

  // aexa-frontend#468: the Edit/Trash2 row-action icon buttons had no
  // aria-label / accessible name.
  it("gives the Edit and Delete row-action icon buttons an accessible name", () => {
    render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

    const editButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-square-pen"))!
    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!

    expect(editButton).toHaveAccessibleName()
    expect(deleteButton).toHaveAccessibleName()
    expect(editButton.getAttribute("aria-label")).not.toBe(
      deleteButton.getAttribute("aria-label")
    )
  })

  // aexa-frontend#484 -- the template list row's thumbnail <img> had no
  // alt attribute.
  it("gives the template list row's thumbnail an alt attribute", () => {
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: {
        data: [makeTemplate({ templateLogo: "https://cdn.example.com/logo.png" })],
        meta: { total: 1 },
      },
      isLoading: false,
    })

    render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

    expect(
      screen.getByAltText("ISO 27001 Audit Template")
    ).toBeInTheDocument()
  })

  it("gives the disabled system-template Edit and Delete buttons an accessible name too", () => {
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: {
        data: [
          makeTemplate({
            id: "system-template",
            templateName: "⚙ AI-Generated Findings (system, do not edit)",
            templateDisc: null,
          }),
        ],
        meta: { total: 1 },
      },
      isLoading: false,
    })

    render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

    const editButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-square-pen"))!
    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!

    expect(editButton).toHaveAccessibleName()
    expect(deleteButton).toHaveAccessibleName()
  })

  // quality-bar-loop round 2 (Templates, mobile, round-1 finding): search
  // input, Generate/Create buttons and row Edit/Delete icon buttons all
  // measured well under the 44px touch-target guideline via the shared
  // Input/Button components' default sizes.
  it("gives the search input, action buttons, and row Edit/Delete buttons a 44px touch target", () => {
    render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

    expect(
      screen.getByPlaceholderText(
        "organization.templates.list.searchPlaceholder"
      ).className
    ).toMatch(/\bh-11\b/)
    expect(
      screen.getByText("organization.templates.list.generateTemplate")
        .closest("button")!.className
    ).toMatch(/\bh-11\b/)
    expect(
      screen.getByText("organization.templates.list.createTemplate")
        .closest("button")!.className
    ).toMatch(/\bh-11\b/)

    const editButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-square-pen"))!
    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!

    expect(editButton).toHaveAttribute("data-size", "icon-touch")
    expect(deleteButton).toHaveAttribute("data-size", "icon-touch")
  })

  it("gives the disabled system-template Edit and Delete buttons a 44px touch target too", () => {
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: {
        data: [
          makeTemplate({
            id: "system-template",
            templateName: "⚙ AI-Generated Findings (system, do not edit)",
            templateDisc: null,
          }),
        ],
        meta: { total: 1 },
      },
      isLoading: false,
    })

    render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

    const editButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-square-pen"))!
    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!

    expect(editButton).toHaveAttribute("data-size", "icon-touch")
    expect(deleteButton).toHaveAttribute("data-size", "icon-touch")
  })

  // aexa-server PR #324 / quality-bar-loop round 5 (industry-standards):
  // draft/publish status, addressing the "no publish/draft state" gap.
  describe("draft status badge", () => {
    it("shows a Draft badge for a draft template, and none for a published one", () => {
      mockUseGetAllTemplatesQuery.mockReturnValue({
        data: {
          data: [
            makeTemplate({ id: "t1", templateName: "Draft One", status: "DRAFT" }),
            makeTemplate({
              id: "t2",
              templateName: "Published One",
              status: "PUBLISHED",
            }),
          ],
          meta: { total: 2 },
        },
        isLoading: false,
      })

      render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

      expect(
        screen.getByText("organization.templates.list.draftBadge")
      ).toBeInTheDocument()
      // Only one badge should exist -- the published row gets none.
      expect(
        screen.getAllByText("organization.templates.list.draftBadge")
      ).toHaveLength(1)
    })
  })

  // aexa-server PR #323 / quality-bar-loop round 4 (industry-standards):
  // category/tag support, another gap shared by every reference tool in
  // this category.
  describe("category filter", () => {
    it("shows the category as a badge on rows that have one, and omits it otherwise", () => {
      mockUseGetAllTemplatesQuery.mockReturnValue({
        data: {
          data: [
            makeTemplate({ id: "t1", category: "Safety" }),
            makeTemplate({ id: "t2", templateName: "No category", category: null }),
          ],
          meta: { total: 2 },
        },
        isLoading: false,
      })

      render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

      expect(screen.getByText("Safety")).toBeInTheDocument()
    })

    it("does not render a category filter dropdown when the org has no categorized templates", () => {
      mockUseGetTemplateCategoriesQuery.mockReturnValue({ data: { data: [] } })
      render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

      expect(
        screen.queryByLabelText(
          "organization.templates.list.categoryFilterLabel"
        )
      ).not.toBeInTheDocument()
    })

    it("renders a category filter dropdown populated from the org's distinct categories, and refetches on change", async () => {
      mockUseGetTemplateCategoriesQuery.mockReturnValue({
        data: { data: ["Electrical", "Safety"] },
      })

      render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

      const select = screen.getByLabelText(
        "organization.templates.list.categoryFilterLabel"
      )
      expect(
        screen.getByRole("option", { name: "Electrical" })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("option", { name: "Safety" })
      ).toBeInTheDocument()

      await userEvent.selectOptions(select, "Safety")

      await waitFor(() =>
        expect(mockUseGetAllTemplatesQuery).toHaveBeenLastCalledWith(
          expect.objectContaining({ category: "Safety", page: 1 })
        )
      )
    })

    it("passes category: undefined (no filter) when 'All categories' is selected", async () => {
      mockUseGetTemplateCategoriesQuery.mockReturnValue({
        data: { data: ["Safety"] },
      })

      render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

      expect(mockUseGetAllTemplatesQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: undefined })
      )
    })
  })

  // aexa-server PR #322 / quality-bar-loop round 3 (industry-standards):
  // template cloning, the single most universal expectation across
  // SafetyCulture/iAuditor/Typeform/Google Forms, which this page had none
  // of before.
  describe("template duplication", () => {
    it("shows a Duplicate button for every writable row, including the system template", () => {
      mockUseGetAllTemplatesQuery.mockReturnValue({
        data: {
          data: [
            makeTemplate(),
            makeTemplate({
              id: "system-template",
              templateName: "⚙ AI-Generated Findings (system, do not edit)",
              templateDisc: null,
            }),
          ],
          meta: { total: 2 },
        },
        isLoading: false,
      })

      render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

      expect(
        screen.queryAllByRole("button").filter((b) => b.querySelector("svg.lucide-copy"))
      ).toHaveLength(2)
    })

    it("hides the Duplicate button for a VIEWER", () => {
      mockRole = "VIEWER"
      render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

      expect(
        screen.queryAllByRole("button").some((b) => b.querySelector("svg.lucide-copy"))
      ).toBe(false)
    })

    it("calls duplicateTemplate with the row's id and shows a success toast", async () => {
      mockDuplicateTemplate.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true, message: "Duplicated" }),
      })

      render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

      const duplicateButton = screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg.lucide-copy"))!
      await userEvent.click(duplicateButton)

      expect(mockDuplicateTemplate).toHaveBeenCalledWith("template-1")
      const { toast } = await import("sonner")
      expect(toast.success).toHaveBeenCalledWith("Duplicated")
    })

    it("shows an error toast when duplicateTemplate fails", async () => {
      mockDuplicateTemplate.mockReturnValue({
        // RTK Query's fetchBaseQuery rejection shape -- the server message
        // lives under `data`, not `message` directly (found by review, PR
        // #675: the handler originally read `err?.message`, which a real
        // rejection like this never populates).
        unwrap: () => Promise.reject({ data: { message: "Server error" } }),
      })

      render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

      const duplicateButton = screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg.lucide-copy"))!
      await userEvent.click(duplicateButton)

      const { toast } = await import("sonner")
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Server error")
      )
    })

    // Found by review (PR #675): the handler originally guarded on the
    // mutation hook's shared `isLoading` flag, which is true while ANY row
    // is duplicating -- so clicking a second row while a first row's
    // duplicate was still in flight silently no-op'd (no call, no toast),
    // even though that second row's button wasn't visually disabled.
    it("lets a second row's Duplicate click go through while a different row's duplicate is still pending", async () => {
      mockUseGetAllTemplatesQuery.mockReturnValue({
        data: {
          data: [
            makeTemplate({ id: "template-1", templateName: "Template One" }),
            makeTemplate({ id: "template-2", templateName: "Template Two" }),
          ],
          meta: { total: 2 },
        },
        isLoading: false,
      })
      let resolveFirst: (v: unknown) => void
      mockDuplicateTemplate.mockReturnValueOnce({
        unwrap: () => new Promise((resolve) => { resolveFirst = resolve }),
      })
      mockDuplicateTemplate.mockReturnValueOnce({
        unwrap: () => Promise.resolve({ success: true, message: "Duplicated" }),
      })

      const { rerender } = render(
        <MemoryRouter><TemplatesPage /></MemoryRouter>
      )

      const duplicateButtons = () =>
        screen
          .getAllByRole("button")
          .filter((b) => b.querySelector("svg.lucide-copy"))
      await userEvent.click(duplicateButtons()[0])
      // Simulates the real RTK Query hook reporting isLoading: true while
      // row 1's mutation is genuinely in flight (this test's mock, unlike
      // the real hook, doesn't derive isLoading from pending promises on
      // its own -- setting it explicitly and forcing a re-render
      // reproduces the exact runtime condition the original bug depended
      // on: the hook call on row 2's click sees isLoading: true).
      mockIsTemplateDuplicating = true
      rerender(<MemoryRouter><TemplatesPage /></MemoryRouter>)

      await userEvent.click(duplicateButtons()[1])

      expect(mockDuplicateTemplate).toHaveBeenCalledWith("template-2")
      resolveFirst!({ success: true, message: "Duplicated" })
    })

    it("gives the Duplicate button a 44px touch target and a per-template accessible name", () => {
      render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

      const duplicateButton = screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg.lucide-copy"))!

      expect(duplicateButton).toHaveAttribute("data-size", "icon-touch")
      expect(duplicateButton).toHaveAccessibleName()
    })
  })

  it("hides Generate Template, Create Template, Edit and Delete for a VIEWER", () => {
    mockRole = "VIEWER"
    render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

    expect(
      screen.queryByText("organization.templates.list.generateTemplate")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("organization.templates.list.createTemplate")
    ).not.toBeInTheDocument()
    expect(
      screen.queryAllByRole("button").some((b) => b.querySelector("svg.lucide-square-pen"))
    ).toBe(false)
    expect(
      screen.queryAllByRole("button").some((b) => b.querySelector("svg.lucide-trash2"))
    ).toBe(false)
  })

  it("hides write controls for a LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

    expect(
      screen.queryByText("organization.templates.list.createTemplate")
    ).not.toBeInTheDocument()
  })

  // aexa-frontend#265: the delete-path counterpart to #234/#243. Those fixed
  // page state going stale when a FILTER change shrinks totalPages; this
  // covers a delete alone shrinking totalPages with no filter touched.
  it("aexa-frontend#265: clamps the page back into range after a delete shrinks totalPages", async () => {
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: { data: [makeTemplate()], meta: { total: 25 } },
      isLoading: false,
    })
    mockDeleteTemplate.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, message: "Deleted" }),
    })

    render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

    const nextButton = () =>
      screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg.lucide-chevron-right"))!

    // totalPages = ceil(25/10) = 3 -- page to the last page.
    await userEvent.click(nextButton())
    await userEvent.click(nextButton())
    await waitFor(() =>
      expect(mockUseGetAllTemplatesQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 3 })
      )
    )

    // Deleting the last template on page 3 drops total to 20 -> totalPages 2,
    // stranding page 3 out of range.
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: { data: [], meta: { total: 20 } },
      isLoading: false,
    })

    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!
    await userEvent.click(deleteButton)
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockUseGetAllTemplatesQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      )
    )
  })

  // Same discarded-isLoading double-submission bug fixed for
  // RiskRegisterPage/aexa-frontend#620 -- useDeleteTemplateMutation's
  // isLoading was previously discarded, so the Delete confirmation button
  // never disabled while a request was already in flight.
  it("disables the delete confirmation button while a delete is already in flight", async () => {
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: { data: [makeTemplate()], meta: { total: 1 } },
      isLoading: false,
    })
    mockIsTemplateDeleting = true

    render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!
    await userEvent.click(deleteButton)

    expect(
      screen.getByRole("button", { name: /confirm delete/i })
    ).toBeDisabled()
  })

  // Found by review (PR #675, while adding the sibling duplicate handler):
  // this handler read `err?.message`, but RTK Query's fetchBaseQuery
  // rejection nests the server message under `data` -- a real rejection
  // never populated `message`, so delete failures always fell through to
  // the generic fallback text instead of the server's actual message.
  it("shows the server's error message (not just the generic fallback) when delete fails", async () => {
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: { data: [makeTemplate()], meta: { total: 1 } },
      isLoading: false,
    })
    mockDeleteTemplate.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "In use, cannot delete" } }),
    })

    render(<MemoryRouter><TemplatesPage /></MemoryRouter>)

    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!
    await userEvent.click(deleteButton)
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    const { toast } = await import("sonner")
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("In use, cannot delete")
    )
  })

  // Bug-fix batch: templateDisc?.slice(0, 50) + " ..." rendered the literal
  // string "undefined ..." for templates with no description (e.g. the
  // system "AI-Generated Findings" template), and always appended " ..."
  // even when nothing was actually truncated.
  it("shows a no-description fallback instead of 'undefined ...' when templateDisc is missing", () => {
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: {
        data: [makeTemplate({ templateDisc: undefined })],
        meta: { total: 1 },
      },
      isLoading: false,
    })

    render(
      <MemoryRouter>
        <TemplatesPage />
      </MemoryRouter>
    )

    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument()
    expect(
      screen.getByText("organization.templates.list.noDescription")
    ).toBeInTheDocument()
  })

  it("does not append an ellipsis when the description is short enough to not be truncated", () => {
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: {
        data: [makeTemplate({ templateDisc: "Short description" })],
        meta: { total: 1 },
      },
      isLoading: false,
    })

    render(
      <MemoryRouter>
        <TemplatesPage />
      </MemoryRouter>
    )

    expect(screen.getByText("Short description")).toBeInTheDocument()
    expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument()
  })

  it("truncates a long description and appends an ellipsis", () => {
    const longDesc = "A".repeat(80)
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: {
        data: [makeTemplate({ templateDisc: longDesc })],
        meta: { total: 1 },
      },
      isLoading: false,
    })

    render(
      <MemoryRouter>
        <TemplatesPage />
      </MemoryRouter>
    )

    expect(
      screen.getByText(`${"A".repeat(50)} ...`)
    ).toBeInTheDocument()
  })

  it("does not truncate a description that is exactly 50 characters", () => {
    const exactDesc = "A".repeat(50)
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: {
        data: [makeTemplate({ templateDisc: exactDesc })],
        meta: { total: 1 },
      },
      isLoading: false,
    })

    render(
      <MemoryRouter>
        <TemplatesPage />
      </MemoryRouter>
    )

    expect(screen.getByText(exactDesc)).toBeInTheDocument()
    expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument()
  })

  // aexa-frontend#377 -- the synthetic "AI-Generated Findings" template
  // (created server-side by risk.correlation.service.ts for the root-cause
  // -bucketing -> Action flow) had identical, fully-functional Edit/Delete
  // buttons to any real template, with no enforcement against editing or
  // deleting it. The API has no isSystem flag, so the frontend keys off the
  // known name substring, same convention the backend's own find-or-create
  // already uses for this template.
  describe("system template protection (#377)", () => {
    it("disables Edit and Delete for the system 'AI-Generated Findings' template", () => {
      mockUseGetAllTemplatesQuery.mockReturnValue({
        data: {
          data: [
            makeTemplate({
              id: "system-template",
              templateName: "⚙ AI-Generated Findings (system, do not edit)",
              templateDisc: null,
            }),
          ],
          meta: { total: 1 },
        },
        isLoading: false,
      })

      render(
        <MemoryRouter>
          <TemplatesPage />
        </MemoryRouter>
      )

      const editButton = screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg.lucide-square-pen"))!
      const deleteButton = screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg.lucide-trash2"))!

      expect(editButton).toBeDisabled()
      expect(deleteButton).toBeDisabled()
      // The system template's Edit button no longer links anywhere -- the
      // real fix (#377) removes the Link wrapper entirely for it, rather
      // than just disabling a still-navigable link.
      expect(editButton.closest("a")).toBeNull()
      expect(
        screen.getAllByTitle(
          "organization.templates.list.systemTemplateTooltip"
        ).length
      ).toBeGreaterThan(0)
    })

    it("clicking the disabled Delete button on the system template does not open the delete confirmation", async () => {
      mockUseGetAllTemplatesQuery.mockReturnValue({
        data: {
          data: [
            makeTemplate({
              id: "system-template",
              templateName: "⚙ AI-Generated Findings (system, do not edit)",
              templateDisc: null,
            }),
          ],
          meta: { total: 1 },
        },
        isLoading: false,
      })

      render(
        <MemoryRouter>
          <TemplatesPage />
        </MemoryRouter>
      )

      const deleteButton = screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg.lucide-trash2"))!
      await userEvent.click(deleteButton)

      expect(
        screen.queryByRole("button", { name: /confirm delete/i })
      ).not.toBeInTheDocument()
    })

    it("still allows Edit and Delete for a normal, non-system template", () => {
      render(
        <MemoryRouter>
          <TemplatesPage />
        </MemoryRouter>
      )

      const editButton = screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg.lucide-square-pen"))!
      const deleteButton = screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg.lucide-trash2"))!

      expect(editButton).not.toBeDisabled()
      expect(deleteButton).not.toBeDisabled()
    })
  })

  // aexa-frontend#336: date-fns's format() was called with no locale option,
  // so the Created/Updated columns always showed English month abbreviations
  // regardless of the app's selected language.
  describe("locale-aware Created/Updated date formatting (#336)", () => {
    it("renders English month abbreviations when i18n.language is not French", () => {
      mockLanguage = "en"
      render(
        <MemoryRouter>
          <TemplatesPage />
        </MemoryRouter>
      )

      expect(screen.getAllByText("01 Jun 2026")).toHaveLength(2)
    })

    it("renders French month names when i18n.language starts with fr", () => {
      mockLanguage = "fr-FR"
      render(
        <MemoryRouter>
          <TemplatesPage />
        </MemoryRouter>
      )

      expect(screen.getAllByText("01 juin 2026")).toHaveLength(2)
      expect(screen.queryByText("01 Jun 2026")).not.toBeInTheDocument()
    })
  })
})
