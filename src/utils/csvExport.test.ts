import { csvTextField } from "./csvExport"

// Extracted from RiskGraphPage's export feature during the Risk Register's
// CSV export work -- these tests guard the CSV-injection escaping now
// shared by both pages.
describe("csvTextField", () => {
  it("passes through an ordinary value unchanged", () => {
    expect(csvTextField("Flood risk at coastal data center")).toBe(
      "Flood risk at coastal data center"
    )
  })

  it("force-text-prefixes a value starting with =", () => {
    expect(csvTextField("=cmd")).toBe("'=cmd")
  })

  it("force-text-prefixes a value starting with +, -, or @", () => {
    expect(csvTextField("+1234")).toBe("'+1234")
    expect(csvTextField("-1234")).toBe("'-1234")
    expect(csvTextField("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)")
  })

  it("quotes and escapes a value containing a comma", () => {
    expect(csvTextField("Regulatory, Compliance")).toBe(
      '"Regulatory, Compliance"'
    )
  })

  it("quotes and doubles embedded quotes", () => {
    expect(csvTextField('Says "urgent" review needed')).toBe(
      '"Says ""urgent"" review needed"'
    )
  })

  it("quotes a value containing a newline", () => {
    expect(csvTextField("Line one\nLine two")).toBe('"Line one\nLine two"')
  })

  it("applies the injection prefix before quoting when both apply", () => {
    expect(csvTextField('=A1,"B1"')).toBe('"\'=A1,""B1"""')
  })
})
