import { describe, expect, it } from "vitest"
import { parseSliderDefault } from "./parseSliderDefault"

describe("parseSliderDefault", () => {
  it("falls back to 5 for a non-numeric string", () => {
    expect(parseSliderDefault("text")).toBe(5)
  })

  it("falls back to 5 for undefined/null/empty string", () => {
    expect(parseSliderDefault(undefined)).toBe(5)
    expect(parseSliderDefault(null)).toBe(5)
    expect(parseSliderDefault("")).toBe(5)
  })

  it("preserves a genuine numeric value", () => {
    expect(parseSliderDefault(7)).toBe(7)
    expect(parseSliderDefault("3")).toBe(3)
    expect(parseSliderDefault(0)).toBe(0)
  })

  // Review follow-up: plain Number(value) coercion would silently turn a
  // boolean into 1/0 or a whitespace-only string into 0 -- a
  // wrong-but-plausible default instead of the intended fallback to 5.
  it("falls back to 5 for a boolean, not Number(value)'s 1/0 coercion", () => {
    expect(parseSliderDefault(true)).toBe(5)
    expect(parseSliderDefault(false)).toBe(5)
  })

  it("falls back to 5 for a whitespace-only string, not Number(value)'s 0 coercion", () => {
    expect(parseSliderDefault("   ")).toBe(5)
  })

  it("falls back to 5 for an array or object", () => {
    expect(parseSliderDefault([])).toBe(5)
    expect(parseSliderDefault([5])).toBe(5)
    expect(parseSliderDefault({})).toBe(5)
  })
})
