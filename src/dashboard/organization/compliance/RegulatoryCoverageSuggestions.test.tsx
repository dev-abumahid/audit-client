import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import RegulatoryCoverageSuggestions from "./RegulatoryCoverageSuggestions"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// This file never triggers src/i18n/i18n.ts's real init, so react-i18next's
// real t() falls back to the raw key with no interpolation -- fine for
// every other assertion here, but round-4's per-suggestion aria-label fix
// (addAsObligationFor/dismissFor, interpolating {{name}}) is untestable
// without the real template string to interpolate against. Overriding just
// these two keys with their real en.json templates (same technique
// CompliancePage.test.tsx already uses for a handful of keys) lets the
// tests confirm the suggestion name actually reaches the label; every
// other key still falls back to itself unchanged.
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  const TEMPLATES: Record<string, string> = {
    "organization.compliance.regulatoryCoverage.addAsObligationFor":
      "Add {{name}} as obligation",
    "organization.compliance.regulatoryCoverage.dismissFor": "Dismiss {{name}}",
    "organization.compliance.regulatoryCoverage.addedFor":
      "{{name}} already added as obligation",
  }
  return {
    ...mod,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        const template = TEMPLATES[key] ?? key
        if (!options) return template
        return template.replace(/\{\{(\w+)\}\}/g, (_match, varName) =>
          String(options[varName] ?? "")
        )
      },
    }),
  }
})

const mockSuggestRegulatorySources = vi.fn()
let mockIsLoading = false
vi.mock("@/redux/apis/organization/compliance.api", () => ({
  useSuggestRegulatorySourcesMutation: () => [
    mockSuggestRegulatorySources,
    { get isLoading() { return mockIsLoading } },
  ],
}))

import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)

const SITES = [
  { id: "site-1", name: "HQ Casablanca" },
  { id: "site-2", name: "Warehouse Tangier" },
]

const domainLabel = (key: string) => key

function renderPanel(
  onAddSuggestion = vi.fn(),
  { sites = SITES, sitesError = false }: { sites?: typeof SITES; sitesError?: boolean } = {}
) {
  return {
    onAddSuggestion,
    ...render(
      <RegulatoryCoverageSuggestions
        sites={sites}
        sitesError={sitesError}
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
  mockIsLoading = false
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
      name: /organization\.compliance\.regulatoryCoverage\.source/,
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

// Round-1 quality-bar-loop review (security axis): aexa-ai's own
// _normalize already drops a non-http(s) source_url, but this is a
// sink-side guard against a stale cached response or a future call site
// that bypasses the backend guard -- must not render as a real link.
it("does not render a source link for a non-http(s) source_url", async () => {
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
              source_url: "javascript:alert(document.cookie)",
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
    screen.getByRole("button", { name: "Add GDPR as obligation" })
  )

  expect(onAddSuggestion).toHaveBeenCalledWith("site-1", suggestion)
})

// Round-8 quality-bar-loop review (UX axis): clicking "Add as obligation"
// twice for the same suggestion used to be indistinguishable from clicking
// it once -- nothing marked the suggestion as already actioned, so a user
// could open the pre-fill form repeatedly and, if they saved each time, end
// up with duplicate persisted obligations for one gap.
it("disables 'Add as obligation' and relabels it after use, without re-calling onAddSuggestion", async () => {
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
  const addButton = screen.getByRole("button", { name: "Add GDPR as obligation" })
  await userEvent.click(addButton)

  expect(onAddSuggestion).toHaveBeenCalledTimes(1)
  const addedButton = screen.getByRole("button", {
    name: "GDPR already added as obligation",
  })
  expect(addedButton).toBeDisabled()
  expect(
    screen.getByText("organization.compliance.regulatoryCoverage.added")
  ).toBeInTheDocument()

  // Disabled buttons don't fire click handlers, but assert the intent
  // directly too: no second call happened.
  await userEvent.click(addedButton)
  expect(onAddSuggestion).toHaveBeenCalledTimes(1)
})

// Exercises marking a suggestion added and then dismissing that same item.
// `status` is a single Map<index, "dismissed" | "added">, so the two states
// are mutually exclusive by construction (a round-12 cleanup of what used to
// be two independent Sets, which a reviewer flagged as leaving "can an index
// be both?" unspecified) -- dismissing an already-added suggestion
// overwrites its status to "dismissed" and it cleanly disappears, no stale
// "Added" ghost row left behind.
it("cleanly removes a suggestion from view if it's dismissed after being added", async () => {
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
  renderPanel()

  await selectSiteAndCheck("HQ Casablanca")
  await screen.findByText("GDPR")
  await userEvent.click(
    screen.getByRole("button", { name: "Add GDPR as obligation" })
  )
  expect(
    screen.getByRole("button", { name: "GDPR already added as obligation" })
  ).toBeInTheDocument()

  await userEvent.click(screen.getByRole("button", { name: "Dismiss GDPR" }))

  expect(screen.queryByText("GDPR")).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "GDPR already added as obligation" })
  ).not.toBeInTheDocument()
  expect(
    screen.getByText("organization.compliance.regulatoryCoverage.allDismissed")
  ).toBeInTheDocument()
})

it("resets the added state on a fresh check", async () => {
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
  renderPanel()

  await selectSiteAndCheck("HQ Casablanca")
  await screen.findByText("GDPR")
  await userEvent.click(
    screen.getByRole("button", { name: "Add GDPR as obligation" })
  )
  expect(
    screen.getByRole("button", { name: "GDPR already added as obligation" })
  ).toBeInTheDocument()

  await selectSiteAndCheck("HQ Casablanca")
  await screen.findByText("GDPR")

  expect(
    screen.getByRole("button", { name: "Add GDPR as obligation" })
  ).toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "GDPR already added as obligation" })
  ).not.toBeInTheDocument()
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
    screen.getByRole("button", { name: "Dismiss GDPR" })
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

// Round-6 quality-bar-loop review (resilience axis): a 504 from the
// aexa-server timeout distinction (see compliance.service.ts's
// AbortError handling) must produce a different, more specific toast
// than a generic failure.
it("shows a distinct timeout toast when the request fails with a 504", async () => {
  mockSuggestRegulatorySources.mockReturnValue({
    unwrap: () => Promise.reject({ status: 504, data: { message: "Timed out" } }),
  })
  renderPanel()

  await selectSiteAndCheck("HQ Casablanca")

  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(mockToastError).toHaveBeenCalledWith(
    "organization.compliance.regulatoryCoverage.checkTimedOut"
  )
  expect(mockToastError).not.toHaveBeenCalledWith(
    "organization.compliance.regulatoryCoverage.checkFailed"
  )
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
    screen.getByRole("button", { name: "Dismiss GDPR" })
  )
  expect(screen.queryByText("GDPR")).not.toBeInTheDocument()

  await userEvent.click(
    screen.getByRole("button", {
      name: "organization.compliance.regulatoryCoverage.checkButton",
    })
  )

  expect(await screen.findByText("GDPR")).toBeInTheDocument()
})

// Round-2 quality-bar-loop review (resilience axis, below floor both
// rounds): checkCoverage's closure used to capture selectedSiteId as it
// was when the request STARTED -- a slow response for the site the user
// has since navigated away from used to land unconditionally and silently
// repopulate the panel with the wrong site's suggestions.
// Round-10 quality-bar-loop review (resilience axis, dropped below floor):
// checkCoverage reset dismissed/added synchronously but left the PREVIOUS
// suggestions list on screen (with every Add button re-enabled) for the
// entire duration of a fresh, same-site check -- letting a user re-add an
// already-added suggestion mid-refresh and reintroduce the exact
// duplicate-obligation bug PR #952 fixed. suggestions must clear
// immediately, not just dismissed/added.
it("clears the previous suggestions list (not just dismissed/added) as soon as a fresh check starts", async () => {
  let resolveCheck: (value: unknown) => void = () => {}
  mockSuggestRegulatorySources
    .mockReturnValueOnce({
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
    .mockImplementationOnce(() => ({
      unwrap: () =>
        new Promise((resolve) => {
          resolveCheck = resolve
        }),
    }))

  renderPanel()

  await selectSiteAndCheck("HQ Casablanca")
  await screen.findByText("GDPR")
  await userEvent.click(
    screen.getByRole("button", { name: "Add GDPR as obligation" })
  )
  expect(
    screen.getByRole("button", { name: "GDPR already added as obligation" })
  ).toBeInTheDocument()

  // Re-run the check for the SAME site -- the AI call is now in flight
  // (unresolved).
  await userEvent.click(
    screen.getByRole("button", {
      name: "organization.compliance.regulatoryCoverage.checkButton",
    })
  )

  // The stale "GDPR" suggestion -- and its now-re-enabled Add button --
  // must be gone immediately, not still showing with the fix available to
  // re-click while the fresh response is still pending.
  expect(screen.queryByText("GDPR")).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Add GDPR as obligation" })
  ).not.toBeInTheDocument()

  resolveCheck({ data: { suggestions: [] } })
  await screen.findByText(
    "organization.compliance.regulatoryCoverage.noGaps"
  )
})

it("discards a stale response for a site the user has since switched away from", async () => {
  let resolveSiteOneCheck: (value: unknown) => void = () => {}
  mockSuggestRegulatorySources.mockImplementationOnce(() => ({
    unwrap: () =>
      new Promise((resolve) => {
        resolveSiteOneCheck = resolve
      }),
  }))

  renderPanel()

  const select = screen.getByRole("combobox", {
    name: "organization.compliance.regulatoryCoverage.selectSite",
  }) as HTMLSelectElement
  await userEvent.selectOptions(select, "HQ Casablanca")
  await userEvent.click(
    screen.getByRole("button", {
      name: "organization.compliance.regulatoryCoverage.checkButton",
    })
  )

  // User switches to a different site before site 1's slow request settles.
  await userEvent.selectOptions(select, "Warehouse Tangier")

  // Site 1's request finally resolves -- it must be discarded, not applied.
  resolveSiteOneCheck({
    data: {
      suggestions: [
        {
          name: "Site 1 stale suggestion",
          domain: "data_protection",
          jurisdiction: "EU",
          rationale: "x",
          source_url: null,
        },
      ],
    },
  })
  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(screen.queryByText("Site 1 stale suggestion")).not.toBeInTheDocument()
})

it("does not show an error toast for a stale request the user has already switched away from", async () => {
  let rejectSiteOneCheck: (reason: unknown) => void = () => {}
  mockSuggestRegulatorySources.mockImplementationOnce(() => ({
    unwrap: () =>
      new Promise((_resolve, reject) => {
        rejectSiteOneCheck = reject
      }),
  }))

  renderPanel()

  const select = screen.getByRole("combobox", {
    name: "organization.compliance.regulatoryCoverage.selectSite",
  }) as HTMLSelectElement
  await userEvent.selectOptions(select, "HQ Casablanca")
  await userEvent.click(
    screen.getByRole("button", {
      name: "organization.compliance.regulatoryCoverage.checkButton",
    })
  )

  await userEvent.selectOptions(select, "Warehouse Tangier")

  rejectSiteOneCheck(new Error("network error"))
  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(mockToastError).not.toHaveBeenCalled()
})

// Round-4 quality-bar-loop review (accessibility axis, 3 consecutive
// below-floor rounds).
describe("accessibility fixes (round 4)", () => {
  it("moves focus to the panel heading after dismissing a suggestion", async () => {
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
      screen.getByRole("button", { name: "Dismiss GDPR" })
    )

    const heading = screen.getByRole("heading", {
      name: "organization.compliance.regulatoryCoverage.title",
    })
    expect(heading).toHaveFocus()
  })

  // Review round 1 finding on PR #949: an earlier version of this fix used
  // `focus:outline-none` with no replacement indicator -- moving focus
  // somewhere with zero visible indication is arguably worse than not
  // managing focus at all (WCAG 2.4.7). The heading must reuse the same
  // focus-ring utility every other focusable element in this file already
  // uses, not suppress the outline.
  it("gives the dismiss-focused heading a visible focus indicator, not a suppressed outline", () => {
    renderPanel()

    const heading = screen.getByRole("heading", {
      name: "organization.compliance.regulatoryCoverage.title",
    })
    expect(heading.className).toContain("focus-ring")
    expect(heading.className).not.toContain("outline-none")
  })

  it("keeps the live region mounted before any check has run, for reliable AT announcement", () => {
    renderPanel()

    // The region itself (not just its eventual content) must exist from
    // first render -- an aria-live container that only appears once
    // already populated is unreliable across AT/browser combos.
    const region = document.querySelector('[aria-live="polite"]')
    expect(region).not.toBeNull()
  })

  it("marks the check button aria-busy and announces a loading message while a check is in flight", () => {
    mockIsLoading = true
    renderPanel()

    const button = screen.getByRole("button", {
      name: "organization.compliance.regulatoryCoverage.checkButton",
    })
    expect(button).toHaveAttribute("aria-busy", "true")
    expect(
      screen.getByText("organization.compliance.regulatoryCoverage.checking")
    ).toBeInTheDocument()
  })

  it("does not mark the check button aria-busy or announce loading when idle", () => {
    renderPanel()

    const button = screen.getByRole("button", {
      name: "organization.compliance.regulatoryCoverage.checkButton",
    })
    expect(button).toHaveAttribute("aria-busy", "false")
    expect(
      screen.queryByText(
        "organization.compliance.regulatoryCoverage.checking"
      )
    ).not.toBeInTheDocument()
  })

  // Round-6 quality-bar-loop review (visual polish axis) computed the real
  // contrast ratios for these tokens and found muted-foreground already
  // clears 4.5:1 AA at this size -- round-4's earlier foreground swap was an
  // unnecessary overcorrection that made secondary metadata visually
  // outrank the rationale text below it. Reverted; this test now asserts
  // the restored (and still AA-compliant) muted state.
  it("renders the metadata pill and jurisdiction text with muted (not foreground) contrast", async () => {
    mockSuggestRegulatorySources.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: {
            suggestions: [
              {
                name: "GDPR",
                domain: "data_protection",
                jurisdiction: "European Union",
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

    expect(screen.getByText("data_protection").className).toContain(
      "text-muted-foreground"
    )
    expect(screen.getByText("European Union").className).toContain(
      "text-muted-foreground"
    )
  })
})

describe("resilience fixes (round 6)", () => {
  it("shows the shared sites-load-error message instead of a dead select+button when sitesError is true", () => {
    renderPanel(vi.fn(), { sitesError: true })

    expect(
      screen.getByText("organization.compliance.sitesLoadError")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", {
        name: "organization.compliance.regulatoryCoverage.selectSite",
      })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: "organization.compliance.regulatoryCoverage.checkButton",
      })
    ).not.toBeInTheDocument()
  })

  it("shows an explanatory empty state instead of a dead select+button when the org has no sites", () => {
    renderPanel(vi.fn(), { sites: [] })

    expect(
      screen.getByText("organization.compliance.regulatoryCoverage.noSites")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", {
        name: "organization.compliance.regulatoryCoverage.selectSite",
      })
    ).not.toBeInTheDocument()
  })

  it("sitesError takes precedence over the empty-sites state when both are true", () => {
    renderPanel(vi.fn(), { sites: [], sitesError: true })

    expect(
      screen.getByText("organization.compliance.sitesLoadError")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("organization.compliance.regulatoryCoverage.noSites")
    ).not.toBeInTheDocument()
  })

  it("renders the normal select+button when sites are present and there is no error", () => {
    renderPanel()

    expect(
      screen.getByRole("combobox", {
        name: "organization.compliance.regulatoryCoverage.selectSite",
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByText("organization.compliance.sitesLoadError")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("organization.compliance.regulatoryCoverage.noSites")
    ).not.toBeInTheDocument()
  })
})
