import { describe, expect, it } from "vitest"
import { PLACEHOLDER_IMAGE_SRC } from "./placeholderImage"

describe("PLACEHOLDER_IMAGE_SRC", () => {
  it("is an inline SVG data URI, not a network request", () => {
    expect(PLACEHOLDER_IMAGE_SRC.startsWith("data:image/svg+xml")).toBe(true)
  })

  it("does not reference any external host (e.g. via.placeholder.com)", () => {
    expect(PLACEHOLDER_IMAGE_SRC).not.toMatch(/https?:\/\//)
  })

  it("decodes to well-formed, non-empty SVG markup", () => {
    const encoded = PLACEHOLDER_IMAGE_SRC.replace(
      "data:image/svg+xml;utf8,",
      ""
    )
    const svg = decodeURIComponent(encoded)
    expect(svg.startsWith("<svg")).toBe(true)
    expect(svg.trim().endsWith("</svg>")).toBe(true)
  })
})
