import { attachmentFileName } from "./attachmentFileName"

describe("attachmentFileName", () => {
  it("decodes and extracts the last path segment", () => {
    expect(attachmentFileName("https://cdn.example.com/a%20file.pdf")).toBe(
      "a file.pdf"
    )
  })

  it("falls back to the raw segment on a malformed percent-escape", () => {
    expect(attachmentFileName("https://cdn.example.com/100%off.pdf")).toBe(
      "100%off.pdf"
    )
  })

  it("falls back to 'file' when there is no path segment", () => {
    expect(attachmentFileName("https://cdn.example.com/")).toBe("file")
  })
})
