import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import RiskOverrideBadge from "./RiskOverrideBadge"
import { formatLocaleDate } from "@/utils/formatDate"

// aexa-frontend#269 -- unlike most tests in this app (which let t() echo the
// raw key back, since no i18n instance is initialized in the test
// environment -- see RiskApprovalControls.test.tsx's precedent), this badge's
// whole job is surfacing interpolated overriddenBy/overriddenAt values in its
// tooltip, so a real string-interpolating stub is needed to assert on that --
// same convention as EditPricingModal.test.tsx's `t(key, options)` mock.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const templates: Record<string, string> = {
        "organization.riskRegister.overrideStaleBadge": "{{label}} override stale",
        "organization.riskRegister.overrideActiveBadge": "{{label}} overridden",
        "organization.riskRegister.overrideTooltip":
          "{{label}} overridden by {{by}} on {{date}}",
        "organization.riskRegister.overrideUnknownActor": "unknown user",
        "organization.riskRegister.overrideUnknownDate": "an unknown date",
      }
      let out = templates[key] ?? key
      for (const [k, v] of Object.entries(options ?? {})) {
        out = out.replaceAll(`{{${k}}}`, String(v))
      }
      return out
    },
    i18n: { language: "en" },
  }),
}))

describe("RiskOverrideBadge", () => {
  it("renders nothing when the score isn't overridden", () => {
    const { container } = render(
      <RiskOverrideBadge
        isOverride={false}
        isStale={false}
        overriddenBy={null}
        overriddenAt={null}
        label="Inherent Score"
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the stale badge, not the active badge, when the override is stale", () => {
    render(
      <RiskOverrideBadge
        isOverride={true}
        isStale={true}
        overriddenBy="acc-42"
        overriddenAt="2026-07-10T12:00:00.000Z"
        label="Inherent Score"
      />
    )
    expect(screen.getByTestId("override-stale-badge")).toBeInTheDocument()
    expect(
      screen.queryByTestId("override-active-badge")
    ).not.toBeInTheDocument()
  })

  it("renders the active (non-stale) badge, not the stale badge, when the override is fresh", () => {
    render(
      <RiskOverrideBadge
        isOverride={true}
        isStale={false}
        overriddenBy="acc-42"
        overriddenAt="2026-07-10T12:00:00.000Z"
        label="Residual Score"
      />
    )
    expect(screen.getByTestId("override-active-badge")).toBeInTheDocument()
    expect(
      screen.queryByTestId("override-stale-badge")
    ).not.toBeInTheDocument()
  })

  it("surfaces who overrode it and when, via the hover tooltip", () => {
    render(
      <RiskOverrideBadge
        isOverride={true}
        isStale={true}
        overriddenBy="acc-42"
        overriddenAt="2026-07-10T12:00:00.000Z"
        label="Inherent Score"
      />
    )
    const badge = screen.getByTestId("override-stale-badge")
    expect(badge).toHaveAttribute(
      "title",
      expect.stringContaining("acc-42")
    )
    // Confirms the raw accountId (not a resolved display name) is what's
    // surfaced -- see the component's own file comment for why: there is no
    // server endpoint to resolve accountId -> name from this frontend.
    // Uses the shared formatLocaleDate() helper (aexa-frontend#342) rather
    // than a bare toLocaleString(), so the assertion goes through the same
    // helper instead of the visiting-machine's default locale.
    expect(badge.getAttribute("title")).toContain(
      formatLocaleDate("2026-07-10T12:00:00.000Z", "en", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    )
  })

  it("falls back to an 'unknown user'/'unknown date' tooltip when overriddenBy/At are missing", () => {
    render(
      <RiskOverrideBadge
        isOverride={true}
        isStale={false}
        overriddenBy={null}
        overriddenAt={null}
        label="Inherent Score"
      />
    )
    const badge = screen.getByTestId("override-active-badge")
    expect(badge.getAttribute("title")).toContain("unknown user")
    expect(badge.getAttribute("title")).toContain("an unknown date")
  })
})
