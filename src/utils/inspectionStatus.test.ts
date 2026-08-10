import { describe, expect, it } from "vitest"
import {
  getInspectionStatusLabel,
  getInspectionStatusSeverity,
} from "./inspectionStatus"

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

// quality-bar-loop (Inspections, round 14, visual polish): the single
// source of truth for status->severity color, replacing InspectionTable's
// own Record lookup, UpdateInspection's own nested ternary, and
// InspectionReport's hardcoded single-color pill -- all three previously
// diverged (or in InspectionReport's case, ignored status entirely).
describe("getInspectionStatusSeverity", () => {
  it("maps each known InspectionStatus to its established severity color", () => {
    expect(getInspectionStatusSeverity("COMPLETED")).toBe("low")
    expect(getInspectionStatusSeverity("IN_PROGRESS")).toBe("medium")
    expect(getInspectionStatusSeverity("CANCELLED")).toBe("critical")
    expect(getInspectionStatusSeverity("DRAFT")).toBe("neutral")
  })

  it("falls back to info for an unrecognized status", () => {
    expect(getInspectionStatusSeverity("SOMETHING_NEW")).toBe("info")
  })
})
