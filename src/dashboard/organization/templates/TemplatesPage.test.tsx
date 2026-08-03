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
const mockDeleteTemplate = vi.fn()

vi.mock("@/redux/apis/organization/template.api", () => ({
  useGetAllTemplatesQuery: (...args: unknown[]) =>
    mockUseGetAllTemplatesQuery(...args),
  useDeleteTemplateMutation: () => [mockDeleteTemplate, { isLoading: false }],
}))

vi.mock("./shared/CreateTemplateWithAIDialog", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-template-ai-dialog" /> : null,
}))

vi.mock("@/components/shared/DeleteAlertModal", () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>Confirm delete</button> : null,
}))

function makeTemplate(overrides = {}) {
  return {
    id: "template-1",
    templateName: "ISO 27001 Audit Template",
    templateDisc: "Standard information security audit checklist",
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
    mockDeleteTemplate.mockReset()
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: { data: [makeTemplate()], meta: { total: 1 } },
      isLoading: false,
    })
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
