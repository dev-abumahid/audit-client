# Quality Bar Loop — Threat Intelligence (`/organization/intelligence`, IntelligencePage.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10 (default,
not a hard stop per standing user instruction carried over from earlier
loops in this same session).
Active judges: industry-standards, UX, efficiency, accessibility, visual
polish, resilience & edge cases, code quality, mobile/responsive, security
(both conditional judges activated -- the page has role-gated mutations
and at least one real input, same risk profile as the other org pages
already looped this session).

Standing merge authorization: yes (carried over from earlier loops in this
same session -- merge automatically once a fix passes review).

Started as the next item in the sidebar-navigation sweep, immediately
after the KRI Dashboard loop paused at avg ~7.44/10 (industry-standards
and code quality both needing product/design-scoped work this loop
shouldn't make unilaterally). No prior quality-bar-loop history exists
for this page. User instruction: "keep going down the list of tabs."

## Round 1

| Axis | Score |
|---|---|
| Industry-standards | 4/10 |
| UX | 6/10 |
| Efficiency | 8/10 |
| Accessibility | 7/10 |
| Visual polish | 8/10 |
| Resilience & edge cases | 4/10 |
| Code quality | 7/10 |
| Mobile/responsive | 5/10 |
| Security | 8/10 |

**Average: 6.33/10.** Below target (9); 4 axes below floor (7):
industry-standards, UX, resilience, mobile.

Key findings by axis:

- **Industry-standards (4/10, lowest):** no run history/versioning --
  every AI report query uses `limit: 1`, only the single latest run per
  type is ever shown, no way to browse/compare past runs despite
  `IntelligenceRun` being a paginated, timestamped resource
  server-side. No "generated on" timestamp rendered anywhere even
  though `rcsa_date`/`analysis_date` exist in the schema.
  `PredictResult.confidence` exists in the typed response but is never
  displayed. Significant AI output fields are silently dropped from
  rendering across all 4 panels (category/estimated_impact/
  early_indicators, key_drivers, mitigation_type/norm_reference/
  risk_reduction, type/source/affected_sites/corrective_action/
  financial_impact, management_actions). No citation/source-tracing
  back to specific intelligence items. `canCreateRisk` finding->risk
  conversion IS done well (role-gated, tag-invalidating, deep-links to
  the created risk) -- a genuine strength.
- **UX (6/10):** action bar well organized (ingestion actions visually
  distinct from a labeled "AI REPORTS" cluster); loading states
  per-button with visible spinners; real backend failures surfaced as
  clear toasts. Gap: could not verify actual in-progress experience for
  a multi-minute AI run (backend 500'd instantly in this environment);
  create-risk flow has no confirmation/preview step before creating a
  formal risk record.
- **Efficiency (8/10):** no unmemoized-derived-data bug class found
  (unlike the sibling KriDashboardPage) -- search is server-side and
  debounced 500ms, no client-side re-filtering. No polling; RTK Query
  tag invalidation drives refetch. Minor: 6 separate query hooks fire
  on mount (N+1-style fan-out), though each payload is tiny.
- **Accessibility (7/10):** all actions are real buttons with visible
  text labels (no icon-only buttons); severity never color-only
  (RiskBadge always pairs color + text); heading hierarchy correct and
  tested. Gap: no focus management when a report panel first appears
  (no ref/focus(), no aria-live) -- a screen-reader user gets no
  indication new content was added below the action bar. The
  itemsFetching spinner has no aria-label/sr-only text either.
- **Visual polish (8/10):** correctly reuses the shared
  `severityStyles.ts` vocabulary via `RiskBadge`, not a hand-rolled
  color map (unlike 2 sibling pages this session). Consistent card/panel
  language across all 4 very different AI-report data shapes.
  Intentional visual hierarchy in the action bar (explicitly commented
  as a deliberate fix). Minor: "worsening" trend icon reuses
  `SEVERITY_STYLES.high.text`, conflating severity and trend semantics.
- **Resilience (4/10, tied-lowest):** confirmed LIVE via a
  `window.fetch` monkey-patch -- none of the 5 RTK Query hooks
  (items query + 4 run-history queries) destructure `isError`. A
  simulated fetch failure rendered the exact same "No intelligence
  items yet" empty state as a genuinely empty org, with zero error
  indication -- the same isError-omission bug class already found and
  fixed on 3 sibling pages this session, but the WORST instance of it
  yet (5 queries, not 1-2). Mutations by contrast are handled well
  (try/catch -> toast on all 6). Malformed AI-response handling is
  solid (explicit runtime type guards before rendering each panel). No
  timeout/progress messaging for slow AI calls.
- **Code quality (7/10):** the isError gap above is also this axis's
  main finding. Mutations share a clean `errorMessage()` helper (avoids
  6x duplicated error-extraction). Good self-documentation citing real
  issue numbers. Minor duplication: 4 structurally-identical AI-report
  handlers could collapse into one parameterized helper.
- **Mobile (5/10):** no horizontal clipping/overflow, responsive grids
  collapse correctly. But touch targets are undersized across the
  board: the 4 AI-report buttons measure 28px tall, severity filter
  chips 28px, pagination buttons 26px, per-item Create-Risk button
  ~24px, theme toggle 28x28px, search input 36px -- only the two
  primary ingestion buttons reach 40px (still short of 44px). Same bug
  class fixed on 3 sibling pages this session, but more pervasive here.
- **Security (8/10):** `canCreateRisk` role gate genuinely enforced
  server-side (`assertCanWriteOrgResource`), not just client-side --
  confirmed in aexa-server's own route comments and test coverage
  across all 4 roles. No dangerouslySetInnerHTML anywhere; all
  AI-generated content rendered as plain JSX text (auto-escaped).
  Search term flows through RTK Query's typed params object, safely
  encoded. Minor: raw backend error messages forwarded verbatim to
  toasts (low severity); 2 risk-id URL interpolations unencoded
  (low-risk, DB-generated UUIDs).

**Next fix (Round 2):** resilience is tied for the lowest score (4/10)
and the fix is the most proven, lowest-risk pattern in this entire
session -- add `isError` handling to the 5 RTK Query hooks (items query
+ 4 run-history queries), mirroring the exact fix already shipped on 3
sibling pages this session.

## Round 2 (resilience -- isError handling, PR #655)

Added `isError` handling to all 5 queries. Items query failure replaces
the item list (search/pagination stay live, unlike sibling pages, since
this page's header hosts independent action buttons that don't depend
on the items fetch) with a distinct error state. Each of the 4
report-run queries failing shows an inline notice in place of that
panel, gated on `!xResult` so a stale-but-valid result from an earlier
success is never clobbered by a later failed refetch.

Negative control confirmed the new tests fail without their respective
halves of the fix. Review round 1: angle A found a real bug -- the
items-list branch checked `itemsError` alone (no `!items.length`-style
guard), unlike the 4 report panels' correct `xError && !xResult`
pattern, so a failed REFETCH after an already-successful page (e.g.
paginating) would have discarded a real, valid stale list in favor of
the error message. Fixed same-round with a new regression test (stale
data survives isError=true when real data is still present) and its
own negative control; angle B live-verified the diff's structure and
i18n completeness, confirmed unit-test coverage was faithful, but
couldn't force a genuine live failure through a `window.fetch`
monkey-patch in this specific attempt -- a known environmental
limitation (documented in this session's own memory: RTK Query's
internal fetch reference can miss a post-load patch) -- rather than a
code issue; I had already live-verified all 5 error states rendering
correctly before opening the PR. Review round 2 (scoped to the fix
commit): implicitly clean, same negative-control discipline applied.

**Status:** resilience should clear the floor now, and clear it more
convincingly than any prior instance of this fix pattern this session
(5 queries fixed at once, plus a genuine stale-data-preservation bug
caught and fixed in the same round). Remaining below-floor axes:
industry-standards (4/10, the lowest -- needs real feature/design work:
run history, timestamps, confidence indicators, source citations),
UX (6/10), mobile (5/10 -- the proven touch-target fix pattern, not yet
applied here). Picking mobile next: same well-established h-11/h-11-w-11
pattern already shipped on 3 sibling pages this session, lowest risk of
the remaining below-floor axes.

## Round 3 (mobile -- touch targets, PR #656)

Bumped every button on the page to a 44px touch target (`h-11`): the 2
primary actions (40px), the 4 AI-report buttons (28px), severity filter
chips (28px), the search input (36px), the per-item Create Risk button
(~24px), and pagination Previous/Next (26px) -- the widest single
application of this session's proven fix pattern (9+ buttons on one
page, vs. 3-5 on each sibling page).

Negative control confirmed the new test fails without the fix. One
review round, both reviewers returned zero blocking findings -- angle A
verified the severity-chip template literal's conditional background
class survived the edit correctly, and flagged one pre-existing,
unrelated i18n pluralization question (not introduced or worsened by
this PR); angle B live-verified all button groups (primary actions, AI
reports cluster, severity chips, pagination) at 44px with correct
vertical centering and no visual cramping, matching the class-ordering
convention already established on 3 sibling pages.

**Status:** mobile should clear the floor now. Remaining below-floor
axes: industry-standards (4/10, still the lowest) and UX (6/10). Both
need real product/design scoping this loop shouldn't make unilaterally
-- run history/versioning, timestamps on AI reports, surfacing the
confidence score already in the data, source citations back to
specific intelligence items, and a preview/confirmation step before
create-risk. This is a natural pause point for the Threat Intelligence
loop: 3 rounds shipped (isError x5, touch-targets x9+), the two
remaining gaps are feature-shaped work, not mechanical fixes -- the
same wall CorrelationMatrixPage's industry-standards axis and the KRI
Dashboard's industry-standards/code-quality axes hit. A fresh
full-panel re-score would be the natural next step before deciding
whether to attempt a scoped industry-standards fix (e.g. surfacing the
already-computed `confidence`/`*_date` fields, the cheapest of the
industry-standards findings) or pause here per the standing "scope
ambiguous things, keep going down the list of tabs" instruction.

## Round 4 (industry-standards -- report generation date + confidence, PR #657)

Added a "Generated: {{date}}" line to each of the 4 AI report panels
(Predictions/Mitigations use `IntelligenceRun.createdAt`; RCSA/
Resilience Scan use their own more specific `rcsa_date`/`analysis_date`
fields already present in the typed AI response). Added a 4th stat
card to the Predictions panel surfacing `PredictResult.confidence`
(already part of the typed response, never rendered). Both were
concrete, well-scoped rendering fixes using data the response already
contained -- not new features needing product/design input, unlike this
axis's other open findings.

Negative control confirmed the new test fails without the fix. One
review round: angle A verified all 4 date-source accesses are
structurally correct (createdAt vs. .result.rcsa_date/.result.
analysis_date not reversed), the confidence access is safely
type-guard-narrowed, and the test assertion genuinely proves the
confidence math ran (no other mocked field could produce "73"); angle B
independently confirmed the same against the real type definitions and
flagged one pre-existing (not newly introduced) soft gap --
`isPredictResult`'s guard doesn't individually validate `confidence`,
matching the same risk-tolerance pattern already used for
`score_7d`/`score_30d` elsewhere in this file, not a regression.
(Note: angle B's agent also ran an improper broad `git checkout <branch>
-- .` against this session's own git-discipline rule -- caught and
independently verified safe since it targeted the branch already
checked out, no data lost, but flagged here for the record.)

**Status:** industry-standards should move up modestly but not clear
the floor -- the larger findings (run history/versioning UI, source
citations, several other dropped AI-output fields, no export) remain
open and need real product scoping. UX (6/10) is in a similar position
(could not verify actual in-progress experience for a multi-minute AI
run in this environment; create-risk flow has no confirmation/preview
step). Treating this as the natural pause point for the Threat
Intelligence loop: 4 rounds shipped (isError x5, touch-targets x9+,
report metadata), two remaining below-floor axes both need product/
design decisions this loop shouldn't make unilaterally. Per the
standing "scope ambiguous things, keep going down the list of tabs"
instruction, moving to the next sidebar tab: Alerts.

## Confirming re-score

Resumed per the standing "resume the work on the floor gap ones"
instruction. Re-verified via source read and live-testing where
possible: **industry-standards 5/10, UX 6/10 -- both still below the
7 floor.** Generation date + confidence (round 4's fix) confirmed
still shown. Run-history UI and source citations confirmed still
missing (all 4 `useGetIntelligenceRunsQuery` calls still hardcode
`limit: 1`, only ever showing the single latest run per type). The
create-risk flow was confirmed still direct/no-preview (no Modal/
Dialog/confirm reference anywhere in the file).

## Round 4 (UX -- create-risk confirmation dialog, PR TBD)

Selected the most concretely-scoped, self-contained finding from
UX's gap: Create Risk fired `createRiskFromItem` directly on click,
with zero chance to review the AI's own analysis (severity, risk
summary, potential impact) before a real risk record was created
from it. Added a confirm dialog (the same shadcn/Radix AlertDialog
pattern used elsewhere in the codebase, e.g. Board Reports' Publish
confirmation) surfacing that context before the actual creation
mutation fires.

Industry-standards' remaining gaps (run-history UI, source citations,
several other dropped AI-output fields, export) and UX's other open
item (no visibility into a multi-minute AI run's actual progress)
are still real feature-shaped work, not addressed this round --
picked the one item concrete enough to ship cleanly in a single round
rather than attempting all of it at once.

4 tests updated/added for the new two-step flow, verified against a
negative control (genuinely fails on the pre-fix source).

**QA**: lint clean, typecheck clean repo-wide. Full suite:
2003/2003 passing.

**Live verification**: could not be completed this round -- the
shared dev backend's API rate limiter (aexa-server's `apiLimiter`,
Redis-backed, 300 req/15min) is currently exhausted from this
session's own heavy concurrent judge/review-agent usage across many
features tonight. Confirmed via direct inspection of
`aexa-server/src/app.ts` that the store is Redis-backed, not
in-memory, so restarting the dev server process (tried twice) does
not reset it -- it will only clear once the real 15-minute window
elapses. Relied on the unit tests (with their own genuine negative
control) instead, documented rather than silently skipped.

## Fresh full panel re-score (this session, resumed after Alerts converged)

Two untracked cross-page batch fixes landed since the "confirming
re-score" checkpoint: PR #806 (focus-visible rings on raw buttons) and
PR #809 (page wrapper spacing standardization). Dispatched a fresh
full 9-axis panel to account for both before picking the next fix.

| Axis | Prior | Fresh | Delta |
|---|---|---|---|
| Industry-standards | 5 | 5 | -- |
| UX | 6 | 7 | +1, clears floor |
| Efficiency | 8 | 8 | -- |
| Accessibility | 7 | 8 | +1 (PR #806) |
| Visual polish | 8 | 8 | -- |
| Resilience | 8 | 8 | -- |
| Code quality | 7 | 7 | -- |
| Mobile | 5 | 8 | +3 (PR #809 + round-3 touch targets holding) |
| Security | 8 | 8 | -- |

**Average: 7.44/10.** Up from the prior checkpoint. **Only
industry-standards (5) remains below floor.**

UX cleared the floor -- round 4's create-risk confirmation dialog
confirmed live-correct, matching the shadcn/Radix AlertDialog pattern
used elsewhere. Mobile jumped +3 from PR #809's spacing fix compounding
with round 3's already-shipped touch targets. Accessibility +1 from
PR #806's focus-ring sweep.

Industry-standards' remaining gaps: no run history/versioning (all 4
`useGetIntelligenceRunsQuery` calls hardcode `limit: 1`), no source
citations, several typed AI-response fields silently dropped from
rendering, no export. Per this session's standing "ship, don't pause
on product decisions" guidance, scoping the most tractable slice as
real feature work this round: a run-history list/dropdown per report
type, replacing the hardcoded `limit: 1` -- this is the one gap that's
purely a frontend data-fetching/UI change (the backend resource is
already paginated and timestamped), not a change needing new backend
work like citations or additional AI-output fields would.

## Round 5 fix (run history modal)

Shipped: a "View past runs" history button (44px touch target) next to
each of the 4 report panels' generatedOn date, opening a shared modal
(same pattern as CompliancePage's attestation history -- fetch-on-
demand via `skip`, scoped by run_type) listing up to 20 past runs for
that report type via the already-paginated `getIntelligenceRuns`
endpoint (no new backend work). Each history entry shows its date and
a one-line type-guard-derived summary (7-day score + trend for
predictions, mitigation-plan count, risk appetite for RCSA, overall
resilience score).

This directly closes the "no run history/versioning" gap that's been
industry-standards' #1 cited finding since round 1. The other 3
gaps (source citations, several dropped AI-output fields, export)
remain open -- each needs either new backend work (citations) or a
larger per-panel redesign (surfacing the dropped fields), not a single
round's mechanical scope.

3 new tests: opens the correct-report-type modal and lists past runs
with dates/summaries, shows an empty-history message, closes via the
close button. Negative control confirmed all 3 fail against pre-fix
source. Live verification: the page itself renders correctly and the
button doesn't appear until a report result exists (correctly gated,
matching the existing panel-conditional pattern) -- this environment's
`/predict` endpoint reliably 500s instantly (a known, previously-
documented limitation of this dev environment, not a bug introduced
here), so the actual modal content couldn't be exercised against a
live AI report. Relied on the negative-control-verified unit tests
for that behavior instead.

## Round 6 (industry-standards re-score after PR #841)

| Axis | Prior | Round 6 | Delta |
|---|---|---|---|
| Industry-standards | 5 | **6** | +1, still below floor |
| (all other axes) | -- | unchanged | carried forward |

**Average: 7.56/10.** Up from 7.44. Industry-standards remains the
only axis below floor.

Run-history fix confirmed closed via code + 52/52 tests passing,
including the round-5 describe block's 8 tests. Live check: page
renders structurally correct under sustained dev-server 429s (shared
load, not a defect); the History feature itself couldn't be clicked
live since no AI report has successfully generated in this environment
(known limitation), verified via code + tests instead.

Remaining gaps, re-confirmed via code: (b) no source citations from an
AI finding back to a specific intelligence item -- still open, needs
backend work (aexa-ai's response has no citation/source_ids field to
surface). (c) several typed AI-response fields still dropped from
rendering -- narrower than previously scored (confidence was already
fixed round 4): `PredictResult.key_drivers`, `RcsaResult.
assessment_period`, `RcsaResult.management_actions`,
`ResilienceScanResult.company_context`, `ResilienceScore.trend` are
all typed but never rendered. (d) no export/report-download -- still
open, larger feature work.

**Next fix:** industry-standards is the only below-floor axis, wins
automatically. Among its 3 open gaps, (c) is the only one needing zero
new backend work -- the data already exists in the typed response,
purely a rendering gap, same spirit as round 4's confidence fix.
Picking it as this round's fix; (b) citations and (d) export remain
open, each needing either new backend fields or larger feature scope.

## Round 7 (industry-standards re-score after PR #842)

| Axis | Round 6 | Round 7 | Delta |
|---|---|---|---|
| Industry-standards | 6 | 6 | unchanged -- real progress, still below floor |

**Average: 7.56/10.** Unchanged. Industry-standards remains the only
axis below floor, stuck_streak now 2 (rounds 6-7 both at 6).

Judge's assessment: PR #842's fix was real (5 fields across 3 of 4
report types, plus a genuine crash-guard fix, no regressions) but only
partial -- roughly 10 of ~15 originally-flagged dropped fields remain
unaddressed across the 4 typed AI-response objects:
`EmergingRisk.category/estimated_impact/early_indicators` (Predictions),
`MitigationAction.norm_reference` (Mitigations), `RiskUniverseEntry.
control_gaps/recommended_controls` (RCSA), `ImmediateAlert.type/source/
affected_sites/corrective_action/financial_impact` (Resilience Scan).
Source citations and export remain fully open, unchanged.

**Next fix:** rather than continuing to trickle the same gap across
more single-field rounds (this axis's stuck_streak is already
building), closing ALL remaining dropped fields across all 4 object
types in one round -- same tractable, backend-free rendering pattern
as the last 2 rounds, just completing it in full this time instead of
partially.
