import { describe, expect, it } from "vitest"
import { getInspectionStatusLabel } from "./inspectionStatus"

describe("getInspectionStatusLabel", () => {
  const t = (key: string) => key

  it("resolves each known InspectionStatus to its i18n key", () => {
    expect(getInspectionStatusLabel(t, "DRAFT")).toBe(
      "organization.inspection.statusDraft"
    )
    expect(getInspectionStatusLabel(t, "IN_PROGRESS")).toBe(
      "organization.inspection.statusInProgress"
    )
    expect(getInspectionStatusLabel(t, "COMPLETED")).toBe(
      "organization.inspection.statusCompleted"
    )
    expect(getInspectionStatusLabel(t, "CANCELLED")).toBe(
      "organization.inspection.statusCancelled"
    )
  })

  // Guards against a crash/blank render if the backend ever sends a status
  // value outside the known enum.
  it("falls back to the raw value for an unrecognized status", () => {
    expect(getInspectionStatusLabel(t, "SOMETHING_NEW")).toBe(
      "SOMETHING_NEW"
    )
  })
})
