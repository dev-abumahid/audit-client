import { formatDateOnlyForDisplay } from "./dueDateInput"

describe("formatDateOnlyForDisplay", () => {
  it("formats a UTC-midnight date-only string in en-US by default (language undefined)", () => {
    expect(
      formatDateOnlyForDisplay("2026-12-31T00:00:00.000Z", undefined)
    ).toBe(
      new Date(Date.UTC(2026, 11, 31)).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    )
  })

  // aexa-frontend#390: this used to hardcode "en-US" regardless of the
  // active UI language, so French users always saw English month names.
  it("formats in fr-FR when language starts with 'fr'", () => {
    expect(formatDateOnlyForDisplay("2026-12-31T00:00:00.000Z", "fr")).toBe(
      new Date(Date.UTC(2026, 11, 31)).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    )
  })

  it("formats in fr-FR for regional variants like 'fr-CA'", () => {
    expect(formatDateOnlyForDisplay("2026-12-31T00:00:00.000Z", "fr-CA")).toBe(
      new Date(Date.UTC(2026, 11, 31)).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    )
  })

  it("still truncates to the UTC calendar day for a value with a non-midnight time-of-day", () => {
    // next_review_date can carry a genuine non-zero time-of-day in
    // production (see dueDateInput.ts's comment) -- this must not leak
    // into the display or interact with the local offset.
    expect(formatDateOnlyForDisplay("2027-03-01T23:50:00.000Z", "en")).toBe(
      new Date(Date.UTC(2027, 2, 1)).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    )
  })
})
