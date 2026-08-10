import { describe, expect, it } from "vitest"
import {
  MAX_INSPECTION_FILE_SIZE_BYTES,
  validateInspectionFile,
} from "./inspectionFileValidation"

function makeFile(overrides: { size?: number; type?: string } = {}) {
  const file = new File(["x"], "test.png", {
    type: overrides.type ?? "image/png",
  })
  if (overrides.size !== undefined) {
    Object.defineProperty(file, "size", { value: overrides.size })
  }
  return file
}

describe("validateInspectionFile", () => {
  it("accepts a file under the size limit with an allowed MIME type", () => {
    const file = makeFile({ size: 1024, type: "image/png" })
    expect(validateInspectionFile(file)).toEqual({ valid: true })
  })

  it("accepts a file exactly at the size limit", () => {
    const file = makeFile({ size: MAX_INSPECTION_FILE_SIZE_BYTES })
    expect(validateInspectionFile(file)).toEqual({ valid: true })
  })

  it("rejects a file over the 5MB size limit", () => {
    const file = makeFile({ size: MAX_INSPECTION_FILE_SIZE_BYTES + 1 })
    expect(validateInspectionFile(file)).toEqual({
      valid: false,
      reason: "size",
    })
  })

  it("rejects an unsupported MIME type", () => {
    const file = makeFile({ size: 1024, type: "application/zip" })
    expect(validateInspectionFile(file)).toEqual({
      valid: false,
      reason: "type",
    })
  })

  it.each([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "application/pdf",
  ])("accepts the allowed MIME type %s", (type) => {
    const file = makeFile({ size: 1024, type })
    expect(validateInspectionFile(file)).toEqual({ valid: true })
  })

  // Size is checked before type, matching every call site's original
  // ordering (both checks toast a distinct error, so if a file failed
  // both, this decides which message the user actually sees).
  it("reports size before type when a file fails both checks", () => {
    const file = makeFile({
      size: MAX_INSPECTION_FILE_SIZE_BYTES + 1,
      type: "application/zip",
    })
    expect(validateInspectionFile(file)).toEqual({
      valid: false,
      reason: "size",
    })
  })
})
