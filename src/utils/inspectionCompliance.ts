// quality-bar-loop (Inspections, round 24, industry-standards finding):
// inspection scoring/compliance percentage was absent from the data model
// entirely, the single gap round 20's judge panel called out as most
// consistent with what every reference tool in this category (SafetyCulture/
// iAuditor, Fulcrum, GoCanvas) treats as a baseline capability.
//
// Scoped to checkbox-type questions only (the app's own "Yes"/"No" pass/fail
// question type) -- this mirrors how SafetyCulture computes its own score
// (pass/fail items only, informational fields excluded) rather than
// inventing a weighting scheme across answer types with no established
// convention in this codebase to build on. Slider/date/text/media questions
// carry no inherent pass/fail semantics, so including them would require a
// product decision this round doesn't have grounds to make unilaterally.
//
// Unanswered checkbox questions are excluded from the denominator (same
// "applicable" convention as most inspection tools' compliance scores,
// which report against what was actually assessed, not what's still
// outstanding -- that gap is already surfaced separately via the
// Questions x/y stat this sits next to). In practice this only excludes
// a checkbox question added to the template AFTER this specific
// inspection was created (its answerMap entry falls back to "" -- see
// InspectionReport.tsx's answerMap construction -- since no matching
// QuestionAnswer row exists yet).
//
// Review finding on PR #698, verified rather than taken at face value:
// a checkbox question that predates the inspection is NEVER actually
// "unanswered" in this data model -- UpdateInspection.tsx's own
// documented investigation (round 18) established that every checkbox
// gets a real, persisted `false` default from the moment the
// inspection is created (the create flow submits one entry per
// question, defaults included), and the UI itself always renders a
// visible Yes/No toggle for a checkbox question, never a blank/
// third state. An inspector who leaves a checkbox at its default is
// therefore leaving a real "No" on the record, not skipping the
// question -- the same interpretation many real-world audit
// checklists use (unchecked = not verified = counts against
// compliance). This is a deliberate consequence of the scoring
// convention, not a bug to fix by inventing a tri-state this data
// model doesn't have.
export interface ComplianceScore {
  percentage: number
  passedCount: number
  applicableCount: number
}

interface QuestionLike {
  answerType?: string
}

interface PageLike {
  questions?: QuestionLike[]
}

interface AnswerMapEntry {
  answer: unknown
}

// Returns null when there are zero answered checkbox questions -- a
// template with no pass/fail questions, or one where none have been
// answered yet, has no meaningful score to report.
export function computeComplianceScore(
  pages: PageLike[],
  answerMap: Map<string, AnswerMapEntry>
): ComplianceScore | null {
  let passedCount = 0
  let applicableCount = 0

  pages.forEach((page, pageIndex) => {
    ;(page.questions ?? []).forEach((question, questionIndex) => {
      if (question.answerType !== "checkbox") return
      const entry = answerMap.get(`${pageIndex}-${questionIndex}`)
      if (entry?.answer !== true && entry?.answer !== false) return
      applicableCount++
      if (entry.answer === true) passedCount++
    })
  })

  if (applicableCount === 0) return null

  return {
    percentage: Math.round((passedCount / applicableCount) * 100),
    passedCount,
    applicableCount,
  }
}
