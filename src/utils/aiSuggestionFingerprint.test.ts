import { buildSuggestionFingerprint } from "./aiSuggestionFingerprint"

describe("buildSuggestionFingerprint", () => {
  it("joins normalized title and category with '::'", () => {
    expect(buildSuggestionFingerprint("Supplier concentration", "Operational")).toBe(
      "supplier concentration::operational"
    )
  })

  it("is case-insensitive", () => {
    expect(buildSuggestionFingerprint("SUPPLIER concentration", "OPERATIONAL")).toBe(
      buildSuggestionFingerprint("supplier concentration", "operational")
    )
  })

  it("trims leading/trailing whitespace", () => {
    expect(
      buildSuggestionFingerprint("  Supplier concentration  ", "  Operational  ")
    ).toBe("supplier concentration::operational")
  })

  it("collapses internal whitespace runs to a single space", () => {
    expect(
      buildSuggestionFingerprint("Supplier   concentration", "Operational")
    ).toBe("supplier concentration::operational")
  })

  it("produces distinct fingerprints for distinct titles", () => {
    expect(buildSuggestionFingerprint("Title A", "Operational")).not.toBe(
      buildSuggestionFingerprint("Title B", "Operational")
    )
  })

  it("produces distinct fingerprints for distinct categories", () => {
    expect(buildSuggestionFingerprint("Title A", "Operational")).not.toBe(
      buildSuggestionFingerprint("Title A", "Cybersecurity")
    )
  })

  // Mirrors the backend's own regression test (aexa-server#349, found in
  // review): a literal "::" inside title/category must not let two
  // genuinely different pairs collide at the join point.
  it("does not collide when a literal '::' inside title/category would otherwise straddle the join point", () => {
    expect(buildSuggestionFingerprint("A::B", "C")).not.toBe(
      buildSuggestionFingerprint("A", "B::C")
    )
  })
})
