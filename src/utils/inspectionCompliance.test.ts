import { describe, expect, it } from "vitest"
import { computeComplianceScore } from "./inspectionCompliance"

describe("computeComplianceScore", () => {
  it("returns null when there are no checkbox questions at all", () => {
    const pages = [{ questions: [{ answerType: "input" }] }]
    const answerMap = new Map([["0-0", { answer: "Fine" }]])
    expect(computeComplianceScore(pages, answerMap)).toBeNull()
  })

  it("returns null when checkbox questions exist but none are answered yet", () => {
    const pages = [{ questions: [{ answerType: "checkbox" }] }]
    const answerMap = new Map([["0-0", { answer: "" }]])
    expect(computeComplianceScore(pages, answerMap)).toBeNull()
  })

  it("computes 100% when every answered checkbox is true", () => {
    const pages = [
      {
        questions: [{ answerType: "checkbox" }, { answerType: "checkbox" }],
      },
    ]
    const answerMap = new Map([
      ["0-0", { answer: true }],
      ["0-1", { answer: true }],
    ])
    expect(computeComplianceScore(pages, answerMap)).toEqual({
      percentage: 100,
      passedCount: 2,
      applicableCount: 2,
    })
  })

  it("computes a partial percentage across passed and failed checkboxes", () => {
    const pages = [
      {
        questions: [
          { answerType: "checkbox" },
          { answerType: "checkbox" },
          { answerType: "checkbox" },
        ],
      },
    ]
    const answerMap = new Map([
      ["0-0", { answer: true }],
      ["0-1", { answer: false }],
      ["0-2", { answer: true }],
    ])
    expect(computeComplianceScore(pages, answerMap)).toEqual({
      percentage: 67,
      passedCount: 2,
      applicableCount: 3,
    })
  })

  // A checkbox question genuinely reaches computeComplianceScore with a
  // blank answerMap entry in one real scenario: it was added to the
  // template AFTER this specific inspection was created, so no
  // QuestionAnswer row exists for it yet (InspectionReport.tsx's
  // answerMap falls back to "" for any question with no match). This is
  // NOT the same as a checkbox the user simply left at its default --
  // every pre-existing checkbox always has a real, persisted true/false
  // value (see the module-level comment above), so that case can't
  // actually reach this branch.
  it("excludes a checkbox with no recorded answer yet (added to the template after this inspection was created)", () => {
    const pages = [
      {
        questions: [{ answerType: "checkbox" }, { answerType: "checkbox" }],
      },
    ]
    const answerMap = new Map([
      ["0-0", { answer: true }],
      ["0-1", { answer: "" }],
    ])
    expect(computeComplianceScore(pages, answerMap)).toEqual({
      percentage: 100,
      passedCount: 1,
      applicableCount: 1,
    })
  })

  it("ignores non-checkbox question types even when their answer looks boolean-ish", () => {
    const pages = [
      {
        questions: [
          { answerType: "checkbox" },
          { answerType: "multipleSelect" },
        ],
      },
    ]
    const answerMap = new Map([
      ["0-0", { answer: false }],
      ["0-1", { answer: true }],
    ])
    expect(computeComplianceScore(pages, answerMap)).toEqual({
      percentage: 0,
      passedCount: 0,
      applicableCount: 1,
    })
  })

  it("aggregates checkbox questions across multiple pages", () => {
    const pages = [
      { questions: [{ answerType: "checkbox" }] },
      { questions: [{ answerType: "checkbox" }] },
    ]
    const answerMap = new Map([
      ["0-0", { answer: true }],
      ["1-0", { answer: false }],
    ])
    expect(computeComplianceScore(pages, answerMap)).toEqual({
      percentage: 50,
      passedCount: 1,
      applicableCount: 2,
    })
  })
})
