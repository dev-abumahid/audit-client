import { render, screen } from "@testing-library/react"
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
  default: ({ open }: { open: boolean }) =>
    open ? <button>Confirm delete</button> : null,
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
})
