import { act, renderHook } from "@testing-library/react"
import { useRiskCsvExport } from "./useRiskCsvExport"

// docs/design-docs/site-ai-risk-register-generation.md §3/§7: this hook is
// the "full register export" path the design doc's export-hardening note
// was about -- verifies the two new AI-generated free-text fields
// (internal_pilot, regulatory_citation_note) are actually included in the
// export AND routed through csvTextField()'s real (not mocked) CSV-
// formula-injection guard, end to end against the real generated Blob
// content, not just a call-args assertion.

const mockTrigger = vi.fn()
vi.mock("@/redux/apis/organization/risk.api", () => ({
  useLazyGetAllRisksQuery: () => [mockTrigger, { isFetching: false }],
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))

const mockTriggerDownload = vi.fn()
vi.mock("@/utils/csvExport", async () => {
  const actual = await vi.importActual<typeof import("@/utils/csvExport")>(
    "@/utils/csvExport"
  )
  return {
    ...actual, // csvTextField runs for real -- that's exactly what's under test.
    triggerDownload: (...args: unknown[]) => mockTriggerDownload(...args),
  }
})

function makeRisk(overrides: Record<string, unknown> = {}) {
  return {
    ref: "CYB-001",
    name: "Supply chain disruption",
    category: "supply_chain",
    site: { name: "HQ Casablanca" },
    status: "open",
    inherent_score: 8,
    residual_score: 5,
    pagerank_score: 3,
    financial_impact_min: 100,
    financial_impact_max: 500,
    probability: 40,
    velocity: "high",
    trend: "increasing",
    ai_generated: true,
    source_info: null,
    regulatory_citation_note: null,
    internal_pilot: null,
    ...overrides,
  }
}

async function readExportedCsv(): Promise<string> {
  const blob = mockTriggerDownload.mock.calls[0][0] as Blob
  return blob.text()
}

describe("useRiskCsvExport", () => {
  beforeEach(() => {
    mockTrigger.mockReset()
    mockTriggerDownload.mockReset()
  })

  it("includes Citation Note and Internal Pilot columns with the risks' real values", async () => {
    mockTrigger.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: [
            makeRisk({
              regulatory_citation_note: "French labor law",
              internal_pilot: "HSE Manager",
            }),
          ],
        }),
    })
    const { result } = renderHook(() =>
      useRiskCsvExport({
        debouncedSearch: "",
        siteFilter: "",
        filterCat: "",
        statusParam: null,
        pendingApprovalOnly: false,
      })
    )

    await act(async () => {
      await result.current.handleExport()
    })

    const csv = await readExportedCsv()
    const [header, row] = csv.split("\r\n")
    expect(header).toContain("Citation Note")
    expect(header).toContain("Internal Pilot")
    expect(row).toContain("French labor law")
    expect(row).toContain("HSE Manager")
  })

  it("exports an empty string, not the literal 'null', when the fields are unset", async () => {
    mockTrigger.mockReturnValue({
      unwrap: () => Promise.resolve({ data: [makeRisk()] }),
    })
    const { result } = renderHook(() =>
      useRiskCsvExport({
        debouncedSearch: "",
        siteFilter: "",
        filterCat: "",
        statusParam: null,
        pendingApprovalOnly: false,
      })
    )

    await act(async () => {
      await result.current.handleExport()
    })

    const csv = await readExportedCsv()
    expect(csv).not.toContain("null")
  })

  // CSV injection: a cell starting with =/+/-/@ executes as a formula when
  // opened in Excel/LibreOffice. csvTextField() neutralizes this with a
  // leading apostrophe -- verified here against the REAL helper (not
  // mocked away) for both new AI-generated fields specifically, since
  // these are free text an LLM produced, not a fixed enum/number like the
  // pre-existing columns.
  it("neutralizes a formula-injection payload in regulatory_citation_note", async () => {
    mockTrigger.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: [
            makeRisk({
              regulatory_citation_note: '=HYPERLINK("http://evil.example","click")',
            }),
          ],
        }),
    })
    const { result } = renderHook(() =>
      useRiskCsvExport({
        debouncedSearch: "",
        siteFilter: "",
        filterCat: "",
        statusParam: null,
        pendingApprovalOnly: false,
      })
    )

    await act(async () => {
      await result.current.handleExport()
    })

    const csv = await readExportedCsv()
    // Embedded double-quotes get CSV-doubled ("" ) by csvTextField's own
    // quoting rule, on top of the leading-apostrophe neutralization --
    // both apply, since the value also contains a comma.
    expect(csv).toContain(
      '"\'=HYPERLINK(""http://evil.example"",""click"")"'
    )
    // The raw, un-neutralized formula must not appear anywhere -- proves
    // the apostrophe was actually prepended, not just present elsewhere.
    expect(csv).not.toMatch(/[^']=HYPERLINK/)
  })

  it("neutralizes a formula-injection payload in internal_pilot", async () => {
    mockTrigger.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: [makeRisk({ internal_pilot: "+cmd|' /C calc'!A1" })],
        }),
    })
    const { result } = renderHook(() =>
      useRiskCsvExport({
        debouncedSearch: "",
        siteFilter: "",
        filterCat: "",
        statusParam: null,
        pendingApprovalOnly: false,
      })
    )

    await act(async () => {
      await result.current.handleExport()
    })

    const csv = await readExportedCsv()
    expect(csv).toContain("'+cmd")
  })

  it("quotes a field containing a comma so it doesn't split into extra columns", async () => {
    mockTrigger.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: [
            makeRisk({
              regulatory_citation_note: "Code du travail, article R.4544-1",
            }),
          ],
        }),
    })
    const { result } = renderHook(() =>
      useRiskCsvExport({
        debouncedSearch: "",
        siteFilter: "",
        filterCat: "",
        statusParam: null,
        pendingApprovalOnly: false,
      })
    )

    await act(async () => {
      await result.current.handleExport()
    })

    const csv = await readExportedCsv()
    expect(csv).toContain('"Code du travail, article R.4544-1"')
  })
})
