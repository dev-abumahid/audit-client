import { isSystemTemplateName } from "./isSystemTemplate"

describe("isSystemTemplateName", () => {
  it("matches the exact synthetic template name", () => {
    expect(
      isSystemTemplateName("⚙ AI-Generated Findings (system, do not edit)")
    ).toBe(true)
  })

  it("returns false for an unrelated template name", () => {
    expect(isSystemTemplateName("ISO 27001 Audit Template")).toBe(false)
  })

  // Found by live verification (PR #675): a substring check incorrectly
  // matched the Duplicate feature's own "{name} (copy)" suffix, since
  // appending it to the system template's name still contains the marker
  // substring -- locking Edit/Delete on what should be an independent,
  // fully-editable copy. Exact match fixes this; a name that merely
  // CONTAINS the marker (undecorated, decorated, or suffixed) must not
  // match unless it's the precise synthetic name.
  it("does not match a name that only contains the marker as a substring", () => {
    expect(isSystemTemplateName("AI-Generated Findings")).toBe(false)
    expect(
      isSystemTemplateName(
        "⚙ AI-Generated Findings (system, do not edit) (copy)"
      )
    ).toBe(false)
  })

  // aexa-frontend#377 review follow-up: templateName is typed as a required
  // string, but this model has documented precedent for the API/type shape
  // not lining up exactly (see TemplateSummary's comment in template.d.ts).
  // Guard against null/undefined rather than throw.
  it("returns false without throwing for null or undefined", () => {
    expect(isSystemTemplateName(null)).toBe(false)
    expect(isSystemTemplateName(undefined)).toBe(false)
  })

  it("returns false for an empty string", () => {
    expect(isSystemTemplateName("")).toBe(false)
  })
})
