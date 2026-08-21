import { afterEach, describe, expect, it, vi } from "vitest"
import { assertPreviewOnly } from "./assertPreviewOnly"

// Regression coverage for a real bug an independent review caught: DEV and
// PROD are mutually exclusive in Vite, so an earlier version of this guard
// that early-returned on `!isProd` made its own "throw in dev" branch
// unreachable in every real build mode. These tests assert the guard
// actually throws/warns under each combination, not just that the function
// runs without crashing.

const originalDev = import.meta.env.DEV
const originalProd = import.meta.env.PROD
const originalFlag = import.meta.env.VITE_ENABLE_PREVIEW_ROUTES

function setEnv(dev: boolean, prod: boolean, flag?: string) {
  import.meta.env.DEV = dev
  import.meta.env.PROD = prod
  import.meta.env.VITE_ENABLE_PREVIEW_ROUTES = flag
}

describe("assertPreviewOnly", () => {
  afterEach(() => {
    setEnv(originalDev, originalProd, originalFlag)
    vi.restoreAllMocks()
  })

  it("throws in a dev build, regardless of the opt-in flag", () => {
    setEnv(true, false)
    expect(() => assertPreviewOnly("RiskMatrixPreview")).toThrow(
      /preview-only component/
    )
  })

  it("throws in a dev build even when the opt-in flag is set", () => {
    setEnv(true, false, "true")
    expect(() => assertPreviewOnly("RiskMatrixPreview")).toThrow(
      /preview-only component/
    )
  })

  it("console.errors (does not throw) in a prod build with no opt-in flag", () => {
    setEnv(false, true)
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => assertPreviewOnly("RiskMatrixPreview")).not.toThrow()
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls[0][0]).toMatch(/preview-only component/)
  })

  it("does nothing in a prod build when the opt-in flag is set", () => {
    setEnv(false, true, "true")
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => assertPreviewOnly("RiskMatrixPreview")).not.toThrow()
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
