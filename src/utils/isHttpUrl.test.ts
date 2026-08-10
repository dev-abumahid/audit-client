import { describe, expect, it } from "vitest"
import { isHttpUrl } from "./isHttpUrl"

describe("isHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isHttpUrl("https://cdn.example.com/photo.jpg")).toBe(true)
    expect(isHttpUrl("http://cdn.example.com/photo.jpg")).toBe(true)
  })

  it("rejects a javascript: URI", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false)
  })

  it("rejects a data: URI", () => {
    expect(isHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false)
  })

  it("rejects non-string values", () => {
    expect(isHttpUrl(null)).toBe(false)
    expect(isHttpUrl(undefined)).toBe(false)
    expect(isHttpUrl(42)).toBe(false)
  })
})
