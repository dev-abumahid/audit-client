import { formatLocaleDate } from "./formatDate"

describe("formatLocaleDate", () => {
  it("formats in en-US when language is undefined (default)", () => {
    expect(formatLocaleDate("2026-03-15T00:00:00Z", undefined)).toBe(
      new Date("2026-03-15T00:00:00Z").toLocaleDateString("en-US")
    )
  })

  it("formats in en-US when language is 'en'", () => {
    expect(formatLocaleDate("2026-03-15T00:00:00Z", "en")).toBe(
      new Date("2026-03-15T00:00:00Z").toLocaleDateString("en-US")
    )
  })

  it("formats in fr-FR when language starts with 'fr'", () => {
    expect(formatLocaleDate("2026-03-15T00:00:00Z", "fr")).toBe(
      new Date("2026-03-15T00:00:00Z").toLocaleDateString("fr-FR")
    )
  })

  it("formats in fr-FR for regional variants like 'fr-CA'", () => {
    expect(formatLocaleDate("2026-03-15T00:00:00Z", "fr-CA")).toBe(
      new Date("2026-03-15T00:00:00Z").toLocaleDateString("fr-FR")
    )
  })

  it("passes through Intl.DateTimeFormatOptions unchanged", () => {
    expect(
      formatLocaleDate("2026-03-15T00:00:00Z", "en", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    ).toBe(
      new Date("2026-03-15T00:00:00Z").toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    )
  })

  it("accepts a Date instance as well as a string/number", () => {
    const d = new Date("2026-03-15T00:00:00Z")
    expect(formatLocaleDate(d, "fr")).toBe(d.toLocaleDateString("fr-FR"))
  })
})
