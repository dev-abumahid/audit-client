import { describe, expect, it, vi } from "vitest"
import { isFindingOverdue } from "./findingOverdue"

describe("isFindingOverdue", () => {
  it("is true for a TO_DO finding whose due date has passed", () => {
    expect(
      isFindingOverdue({ dueDate: "2020-01-01T00:00:00.000Z", status: "TO_DO" })
    ).toBe(true)
  })

  it("is true for an IN_PROGRESS finding whose due date has passed", () => {
    expect(
      isFindingOverdue({
        dueDate: "2020-01-01T00:00:00.000Z",
        status: "IN_PROGRESS",
      })
    ).toBe(true)
  })

  it("is false for a finding whose due date is in the future", () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    expect(isFindingOverdue({ dueDate: future, status: "TO_DO" })).toBe(false)
  })

  // The whole point of this helper: a COMPLETE/CANT_DO finding stays
  // "not overdue" regardless of how far in the past its due date sits --
  // it was resolved, overdue-ness no longer applies.
  it("is false for a COMPLETE finding even with a past due date", () => {
    expect(
      isFindingOverdue({ dueDate: "2020-01-01T00:00:00.000Z", status: "COMPLETE" })
    ).toBe(false)
  })

  it("is false for a CANT_DO finding even with a past due date", () => {
    expect(
      isFindingOverdue({ dueDate: "2020-01-01T00:00:00.000Z", status: "CANT_DO" })
    ).toBe(false)
  })

  it("treats a due date of exactly now as not yet overdue", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"))
    expect(
      isFindingOverdue({
        dueDate: "2026-06-15T12:00:00.000Z",
        status: "TO_DO",
      })
    ).toBe(false)
    vi.useRealTimers()
  })
})
