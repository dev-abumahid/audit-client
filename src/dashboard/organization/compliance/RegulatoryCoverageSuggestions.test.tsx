import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import RegulatoryCoverageSuggestions from "./RegulatoryCoverageSuggestions"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockSuggestRegulatorySources = vi.fn()
vi.mock("@/redux/apis/organization/compliance.api", () => ({
  useSuggestRegulatorySourcesMutation: () => [
    mockSuggestRegulatorySources,
    { isLoading: false },
  ],
}))

import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)

const SITES = [
  { id: "site-1", name: "HQ Casablanca" },
  { id: "site-2", name: "Warehouse Tangier" },
]

const domainLabel = (key: string) => key

function renderPanel(onAddSuggestion = vi.fn()) {
  return {
    onAddSuggestion,
    ...render(
      <RegulatoryCoverageSuggestions
        sites={SITES}
        domainLabel={domainLabel}
        onAddSuggestion={onAddSuggestion}
      />
    ),
  }
}

async function selectSiteAndCheck(siteName: string) {
  const select = screen.getByRole("combobox", {
    name: "organization.compliance.regulatoryCoverage.selectSite",
  }) as HTMLSelectElement
  await userEvent.selectOptions(select, siteName)
  await userEvent.click(
    screen.getByRole("button", {
      name: "organization.compliance.regulatoryCoverage.checkButton",
    })
  )
}

beforeEach(() => {
  mockSuggestRegulatorySources.mockReset()
  mockToastError.mockReset()
})

it("disables the check button until a site is selected", () => {
  renderPanel()

  const button = screen.getByRole("button", {
    name: "organization.compliance.regulatoryCoverage.checkButton",
  })
  expect(button).toBeDisabled()
})

it("shows a 'no gaps' message when the suggestion list is empty", async () => {
  mockSuggestRegulatorySources.mockReturnValue({
    unwrap: () => Promise.resolve({ data: { suggestions: [] } }),
  })
  renderPanel()

  await selectSiteAndCheck("HQ Casablanca")

  expect(mockSuggestRegulatorySources).toHaveBeenCalledWith({ site_id: "site-1" })
  expect(
    await screen.findByText("organization.compliance.regulatoryCoverage.noGaps")
  ).toBeInTheDocument()
})

it("renders each suggestion's name, domain, jurisdiction, and rationale", async () => {
  mockSuggestRegulatorySources.mockReturnValue({
    unwrap: () =>
      Promise.resolve({
        data: {
          suggestions: [
            {
              name: "GDPR",
              domain: "data_protection",
              jurisdiction: "European Union",
              rationale: "The site processes EU personal data.",
              source_url: "https://example.com/gdpr",
            },
          ],
        },
      }),
  })
  renderPanel()

  await selectSiteAndCheck("HQ Casablanca")

  expect(await screen.findByText("GDPR")).toBeInTheDocument()
  expect(screen.getByText("data_protection")).toBeInTheDocument()
  expect(screen.getByText("European Union")).toBeInTheDocument()
  expect(
    screen.getByText("The site processes EU personal data.")
  ).toBeInTheDocument()
  expect(
    screen.getByRole("link", {
      name: "organization.compliance.regulatoryCoverage.source",
    })
  ).toHaveAttribute("href", "https://example.com/gdpr")
})

it("does not render a source link when source_url is null", async () => {
  mockSuggestRegulatorySources.mockReturnValue({
    unwrap: () =>
      Promise.resolve({
        data: {
          suggestions: [
            {
              name: "GDPR",
              domain: "data_protection",
              jurisdiction: "EU",
              rationale: "x",
              source_url: null,
            },
          ],
        },
      }),
  })
  renderPanel()

  await selectSiteAndCheck("HQ Casablanca")

  await screen.findByText("GDPR")
  expect(
    screen.queryByRole("link", {
      name: "organization.compliance.regulatoryCoverage.source",
    })
  ).not.toBeInTheDocument()
})

it("calls onAddSuggestion with the selected site id and the suggestion when 'Add as obligation' is clicked", async () => {
  const suggestion = {
    name: "GDPR",
    domain: "data_protection",
    jurisdiction: "EU",
    rationale: "x",
    source_url: null,
  }
  mockSuggestRegulatorySources.mockReturnValue({
    unwrap: () => Promise.resolve({ data: { suggestions: [suggestion] } }),
  })
  const { onAddSuggestion } = renderPanel()

  await selectSiteAndCheck("HQ Casablanca")
  await screen.findByText("GDPR")
  await userEvent.click(
    screen.getByRole("button", {
      name: "organization.compliance.regulatoryCoverage.addAsObligation",
    })
  )

  expect(onAddSuggestion).toHaveBeenCalledWith("site-1", suggestion)
})

it("removes a dismissed suggestion from view without calling onAddSuggestion", async () => {
  mockSuggestRegulatorySources.mockReturnValue({
    unwrap: () =>
      Promise.resolve({
        data: {
          suggestions: [
            {
              name: "GDPR",
              domain: "data_protection",
              jurisdiction: "EU",
              rationale: "x",
              source_url: null,
            },
          ],
        },
      }),
  })
  const { onAddSuggestion } = renderPanel()

  await selectSiteAndCheck("HQ Casablanca")
  await screen.findByText("GDPR")
  await userEvent.click(
    screen.getByRole("button", {
      name: "organization.compliance.regulatoryCoverage.dismiss",
    })
  )

  expect(screen.queryByText("GDPR")).not.toBeInTheDocument()
  expect(
    screen.getByText("organization.compliance.regulatoryCoverage.allDismissed")
  ).toBeInTheDocument()
  expect(onAddSuggestion).not.toHaveBeenCalled()
})

it("shows a toast error and does not render a suggestion list when the request fails", async () => {
  mockSuggestRegulatorySources.mockReturnValue({
    unwrap: () => Promise.reject(new Error("network error")),
  })
  renderPanel()

  await selectSiteAndCheck("HQ Casablanca")

  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(mockToastError).toHaveBeenCalledWith(
    "organization.compliance.regulatoryCoverage.checkFailed"
  )
  expect(
    screen.queryByText("organization.compliance.regulatoryCoverage.noGaps")
  ).not.toBeInTheDocument()
})

it("resets suggestions and re-runs a fresh check when switching to a different site", async () => {
  mockSuggestRegulatorySources.mockReturnValue({
    unwrap: () =>
      Promise.resolve({
        data: {
          suggestions: [
            {
              name: "GDPR",
              domain: "data_protection",
              jurisdiction: "EU",
              rationale: "x",
              source_url: null,
            },
          ],
        },
      }),
  })
  renderPanel()

  await selectSiteAndCheck("HQ Casablanca")
  await screen.findByText("GDPR")

  const select = screen.getByRole("combobox", {
    name: "organization.compliance.regulatoryCoverage.selectSite",
  }) as HTMLSelectElement
  await userEvent.selectOptions(select, "Warehouse Tangier")

  // Switching sites clears the previous result until a fresh check runs.
  expect(screen.queryByText("GDPR")).not.toBeInTheDocument()
})

// Review round 1 finding on PR #945: dismissals must not survive a fresh
// check on the SAME site -- otherwise a suggestion the user dismissed
// during an earlier check would stay silently hidden even though the new
// response may not be identical (regulations change, the AI may return a
// different mix each time). checkCoverage clears `dismissed` before every
// request, not just on site switch.
it("restores a previously dismissed suggestion when re-checking the same site", async () => {
  mockSuggestRegulatorySources.mockReturnValue({
    unwrap: () =>
      Promise.resolve({
        data: {
          suggestions: [
            {
              name: "GDPR",
              domain: "data_protection",
              jurisdiction: "EU",
              rationale: "x",
              source_url: null,
            },
          ],
        },
      }),
  })
  renderPanel()

  await selectSiteAndCheck("HQ Casablanca")
  await screen.findByText("GDPR")
  await userEvent.click(
    screen.getByRole("button", {
      name: "organization.compliance.regulatoryCoverage.dismiss",
    })
  )
  expect(screen.queryByText("GDPR")).not.toBeInTheDocument()

  await userEvent.click(
    screen.getByRole("button", {
      name: "organization.compliance.regulatoryCoverage.checkButton",
    })
  )

  expect(await screen.findByText("GDPR")).toBeInTheDocument()
})
