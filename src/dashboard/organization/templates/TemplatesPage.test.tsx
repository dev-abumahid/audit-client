import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import TemplatesPage from "./TemplatesPage"

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
})
