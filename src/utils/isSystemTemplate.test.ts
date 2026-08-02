import { isSystemTemplateName } from "./isSystemTemplate"

describe("isSystemTemplateName", () => {
  it("matches the exact synthetic template name", () => {
    expect(
      isSystemTemplateName("⚙ AI-Generated Findings (system, do not edit)")
    ).toBe(true)
  })

  it("matches on substring even without the decoration", () => {
    expect(isSystemTemplateName("AI-Generated Findings")).toBe(true)
  })

  it("returns false for an unrelated template name", () => {
    expect(isSystemTemplateName("ISO 27001 Audit Template")).toBe(false)
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
