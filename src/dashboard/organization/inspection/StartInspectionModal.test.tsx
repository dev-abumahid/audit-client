import { render, screen } from "@testing-library/react"
import StartInspectionModal from "./StartInspectionModal"

// i18n isn't initialized in the test environment, so t() echoes the raw key
// back (see RiskRegisterPage.test.tsx for the same convention).

const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: () => ({ data: { data: [] } }),
}))

vi.mock("@/redux/apis/organization/template.api", () => ({
  useGetAllTemplatesQuery: () => ({ data: { data: [] }, isLoading: false }),
}))

describe("StartInspectionModal", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
  })

  it("renders the localized title, description and field labels", () => {
    render(<StartInspectionModal open={true} setOpen={vi.fn()} />)

    expect(
      screen.getByText("organization.inspection.startNewInspection")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.inspection.startModalDescription")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.inspection.selectSite")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.inspection.selectTemplate")
    ).toBeInTheDocument()
  })

  it("renders the localized footer buttons", () => {
    render(<StartInspectionModal open={true} setOpen={vi.fn()} />)

    expect(
      screen.getByRole("button", { name: "organization.inspection.cancel" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "organization.inspection.startInspection",
      })
    ).toBeInTheDocument()
  })
})
