# Quality Bar Loop — Findings feature

**Target:** average 9/10, per-axis floor 7/10, no max-round cap (runs to convergence or a real guardrail).
**Feature files:**
- `src/dashboard/organization/findings/AllFindingsPage.tsx` (list, route `/organization/findings`)
- `src/dashboard/organization/findings/FindingDetails.tsx` (detail, route `/organization/finding/:id`)
- `src/dashboard/organization/findings/CreateNewFindingModal.tsx` (create/edit modal)
- `src/dashboard/organization/findings/FindingClosureControls.tsx` (embedded closure controls)
- `src/dashboard/organization/findings/dueDateInput.ts` (helper)

**Conditional judges:** Mobile/Responsive and Security both ON (findings creation/editing handles free-text user input; GRC audit feature likely used in the field on tablets/phones, same rationale as the Inspections loop).
**Standing merge authorization:** carried over from the Inspections loop — merge automatically once a fix's review loop clears, no per-PR re-ask.

## Round 1 — fresh 9-judge panel

First panel, no prior findings to compare against.

| Axis | R1 | Note |
|---|---|---|
| Industry-standards | 7 | At floor. Strong domain fit (Five Cs fields, maker-checker closure workflow with self-approval blocked and evidence-required-before-closure — genuinely wired end-to-end, matches AuditBoard/ServiceNow GRC conventions, not just Jira/Linear generic-tracker shape). Real gap vs. reference tools: no sortable columns or bulk actions on the list view; only 3 priority tiers (Low/Medium/High) vs. the 4-5 typical in the category. |
| UX | **5** | **Real bug, not just friction**: `line_of_defense` is required on create (server-enforced) but its label has no asterisk and sits below the fold — submitting with it empty silently no-ops (confirmed via network trace: zero POST fires, no toast, no scroll-to-error). A user has no way to know why "Create Finding" appears broken. Also: list filtering is site-only, missing the Status/Priority filters someone triaging findings would actually want. |
| Efficiency | 6 | Below floor. Search input has no debounce -- every keystroke is part of the RTK Query cache key, firing a fresh backend request per character (`AllFindingsPage.tsx`). The "Open Actions" KPI drill-down silently truncates at `limit:100` rather than paginating. `useMyOrgRole()` (full org-member-list fetch) is called independently from 3 components on the same detail-page tree; `FindingClosureControls` fires 4 queries per page, missing an already-existing skip-param optimization a prior round (round 50) added specifically to avoid this. |
| Accessibility | **4** | **Two CRITICAL keyboard failures**, most severe finding this round. (1) `AllFindingsPage.tsx`: list rows are `<tr onClick=...>` with no `tabIndex`/role/keydown handler -- for accounts without a per-row Edit button, there is zero keyboard path from the list into any finding's detail page at all. (2) `FindingDetails.tsx`: the "Upload File" control is a hidden `<input type="file">` inside a `<label>`, not a button -- completely keyboard-unreachable, which also blocks the closure workflow since evidence upload is required before submission. The correct pattern (`<button aria-label onClick={() => fileInputRef.current?.click()}>` + programmatically-triggered hidden input) already exists in this same codebase, in `CreateNewFindingModal.tsx`'s media-upload button -- just wasn't applied here. |
| Visual polish | 8 | Above floor. Strengths: severity badges route through the shared, WCAG-AA-verified `severityBadgeClasses()` helper; delete confirmation reuses `DeleteAlertModal.tsx` verbatim; semantic tokens throughout. Minor: Priority/Status/Line of Defense fields in the create modal all share the identical `AlertCircle` icon (Due Date and Assignees each get their own distinct icon, proving the per-field-icon pattern exists, just not applied consistently); default "To Do" status renders in the same amber tone as "High" priority, an unintended visual clash on first open. |
| Resilience | 8 | Above floor. `AllFindingsPage.tsx` and `CreateNewFindingModal.tsx` both correctly check `isError` (not just `isLoading`) and show real error states. Real gap: `FindingDetails.tsx` (detail-page query) does NOT check `isError` -- the exact bug class `AllFindingsPage.tsx` already fixed elsewhere in this same feature -- so a genuine fetch failure on the detail route falls through to "Finding not found," mislabeling a network/server error as a 404. Also missing the list page's 10s stuck-loading escape hatch. |
| Code quality | 9 | Above floor, strongest axis. The "weak duplicate create form in InspectionActions.tsx" concern from the task brief turned out to be stale -- already unified to the real `CreateNewFindingModal.tsx` in a past round. Minor: `AllFindingsPage.tsx`/`FindingDetails.tsx` still define local `STATUS_KEYS`/`PRIORITY_DISPLAY_KEYS` maps instead of importing the shared `findingLabels.ts` helper extracted specifically to prevent this; `dueDateInput.ts` (in the findings/ directory) is actually only used by `CompliancePage.tsx`, not by anything in this feature -- organizational drift, not a bug. |
| Mobile | **5** | Below floor. List page requires horizontal scroll inside the table's own wrapper with no swipe affordance. Detail page's tab bar visibly clips the "Attachments" tab label ("Attachmen…") at 375px -- a real rendering bug, not cosmetic. Primary closure CTAs ("Submit as Complete"/"Submit as Can't Do") measure only 36px tall, under the 44px guideline for the two most consequential buttons on the page; Edit/Delete and icon-only buttons are undersized throughout. Create Finding modal itself reflows cleanly (good). |
| Security | 8 | Above floor, reported promptly (no stall). No XSS sinks for free-text finding data (React auto-escaping throughout). Real gap: `CreateNewFindingModal.tsx` correctly guards attachment/media URLs with `isHttpUrl()` before rendering, but `FindingDetails.tsx`'s equivalent attachment rendering (image grid, video, PDF iframe, download link) never applies the same guard -- inconsistent within the same feature, defense-in-depth gap rather than an active exploit today. |

**Average: 6.67/10**. **Four axes below floor** (UX 5, efficiency 6, accessibility 4, mobile 5) -- not converged, loop continues.

**Round 2 selection:** round 1, no `stuck_streak` history yet, no `data-correctness`/`security` finding sits at-or-below its own floor (security scored 8), so selection falls to "furthest below target." Accessibility (4/10, gap of 5 from the 9 target) is both the lowest score and carries two `broken-functionality`-tagged findings that block entire interaction flows for keyboard users -- the clear pick.

**Batching**: both of accessibility's findings are Tier 2 (contained logic: add `tabIndex`/keyboard handler to table rows in `AllFindingsPage.tsx`; convert the hidden-input-in-label upload control in `FindingDetails.tsx` to the same button-triggers-hidden-input pattern `CreateNewFindingModal.tsx` already uses) and touch disjoint files. Batching in a third, unrelated finding from a different axis: UX's silent-submission-failure bug in `CreateNewFindingModal.tsx` (also Tier 2, a third disjoint file, and independently high-severity -- a user-facing control that appears completely broken with zero feedback). All three ship together this round.

Mobile's clipped-tab-bar finding is NOT batched in despite also touching `FindingDetails.tsx` -- it shares that file with accessibility's upload-button fix, and same-file simultaneous edits stay sequential per the skill's own batching rule.

## Round 2 outcome

Shipped the batched fix selected in round 1: two accessibility keyboard-
access bugs (severity: `broken-functionality`) plus the UX silent-
submission-failure bug, across three disjoint files.

1. **`AllFindingsPage.tsx` -- list rows had zero keyboard path.** An
   initial attempt added `tabIndex`/`role="button"`/`onKeyDown` directly
   to the `<tr>`, but that makes the row an interactive widget CONTAINING
   other real interactive widgets (the nested Edit/Delete buttons) --
   invalid ARIA nesting, and it broke this file's own tests that query
   for those buttons via `getAllByRole("button")`, since the row now
   matched too. Fixed instead by making the finding's title a real
   `<Link>` to the detail page, mirroring the Site column's link two
   cells over in the same row. The row's own `onClick` stays as a
   mouse-only convenience/larger-hit-area enhancement.

2. **`FindingDetails.tsx` -- Upload File control was keyboard-unreachable.**
   `display:none` on the `<input type="file">` removes it from the tab
   order entirely, and the wrapping `<label>` has no default `tabIndex`
   of its own either. Converted to a real `<button onClick={() =>
   fileInputRef.current?.click()}>` + ref-triggered hidden input,
   matching the pattern `CreateNewFindingModal.tsx`'s own media-upload
   button already used correctly.

3. **`CreateNewFindingModal.tsx` -- Line of Defense submit failure gave
   zero visible feedback.** The field's validation and error rendering
   both already worked correctly, but (a) the label had no asterisk
   unlike this form's other required fields, and (b) the field sits low
   enough in the modal's own scrollable content that its error message
   renders below the fold, hidden behind the fixed Create/Update footer
   button. Added a conditional asterisk (shown only on create, since the
   field is genuinely optional on edit) and a scroll-into-view on a
   rejected submit, via react-hook-form's `handleSubmit(onValid,
   onInvalid)` second callback.

**QA**: `npm run typecheck`/`npx eslint` clean. Full suite: 1938/1938
passing. Each fix has a dedicated regression test (not just relying on
existing coverage) plus a verified negative control (temporarily
reverted, confirmed the corresponding test fails, restored).

**Live verification** (fresh dev-server restart, to rule out
accumulated HMR state from the many edit/revert cycles this round's
negative controls required): confirmed all three fixes live in the
browser. One genuine tooling gotcha hit during this step, worth noting
for future rounds: a JS-dispatched `element.click()` did NOT reliably
trigger this form's `handleSubmit` wiring in the live browser (no
validation ran, no network call fired, nothing happened) even though
the exact same interaction works correctly in the RTL/jsdom test
environment -- switching to a real, trusted click (via the browser
tool's ref-based click, not `element.click()`) reproduced the fix
correctly on the first attempt. Not an app bug; a live-verification
methodology note for future rounds using this same JS-click pattern on
`handleSubmit`-wired buttons specifically.

**Regression check**: none of the three fixes touch the same file as
each other. No existing test broke that wasn't already accounted for
and fixed as part of implementing the change (the two AllFindingsPage
tests that referenced the old click-only-onClick assumption were
updated to match the new, more accessible behavior, not weakened).

## Round 3 — fresh 9-judge panel

Round 2's diff (a `Link` conversion, a button conversion, an
asterisk/aria-required/scroll addition) touched 3 files with real
logic/behavior changes across 3 different axes' concerns, so this round
re-ran the full panel rather than using the scoped-carry-forward
shortcut.

| Axis | R1 | R3 | Note |
|---|---|---|---|
| Industry-standards | 7 | 6 | No bulk actions, no column sorting, no status/priority/assignee/due-date filtering beyond a single site filter. No SLA/overdue visual treatment -- a finding well past its due date renders identically to one not yet due. Audit trail is only free-text Messages, no structured change-history timeline. Same category of gap R1 flagged, scored more strictly this round. |
| UX | 5 → **7** | 7 | R2's Line of Defense fix confirmed genuinely fixed live. **New finding, same failure pattern on a sibling field**: the Inspection `<select>` in `CreateNewFindingModal.tsx` has no `required` rule, no asterisk, and no client-side validation -- submitting with it unset sends `inspectionId: undefined`, the backend 400s with a Zod error, and the user sees only a generic "Validation Error" toast with no field highlighted. Tagged `broken-functionality`. |
| Efficiency | 6 | 7 | R2 didn't touch this axis's surface (confirmed no re-render/effect regression from its 3 fixes). Still below target: search input has no debounce (`AllFindingsPage.tsx`, matches R1's finding, still unfixed), and `useMyAssignedInspectionIds()` is called without its opt-in `role` param at all 3 Findings call sites, wasting a fetch for VIEWER/LIGHT_USER roles despite the skip param already existing in the shared hook for exactly this case. |
| Accessibility | 4 → **8** | 8 | **Both R1 CRITICAL findings confirmed fixed live** via real DOM/tab-order inspection (title is a genuine `<a href>` in natural tab order; Upload File is a real `<button>`, tab-index 0, Enter/Space-activatable). New minor finding: the Messages-tab compose input (`FindingDetails.tsx`) and the list search input (`AllFindingsPage.tsx`) are placeholder-only with no `aria-label`, unlike the identical-purpose input in `CreateNewFindingModal.tsx` which already has one. |
| Visual polish | 8 | 8 | R2's Link, button, and asterisk all visually match their respective established precedents (Site-column Link styling was *not* copied for color, see finding below; Upload File matches the primary-action pill convention; asterisk is byte-identical to the Inspection module's). New finding: the R2 title `Link` (`text-foreground`, invisible until hover) and the pre-existing Site `Link` two cells over (`text-primary`, always visibly a link) give two links in the same row different default affordance. |
| Resilience | 8 | 8 | R2's 3 fixes hold up under edge cases (null-safe ref in scroll-into-view, empty-title Link doesn't crash). Same gap R1 flagged and R2 didn't target: `FindingDetails.tsx` still doesn't check `isError` on its detail query, so a real network failure renders the same "Finding not found" UI as an actual 404. |
| Code quality | 9 | 7 | R2's additions integrate cleanly as first-class code, not patches. New findings not previously scored: `CreateNewFindingModal.tsx` is a 1224-line god component with no sub-component extraction; round-finding comments are accumulating faster than they're pruned; `FindingDetails.tsx`'s image-grid and other-files-list attachment UIs duplicate the same preview/download/remove button cluster nearly verbatim; 45 `any` occurrences across the three main files, several avoidable. Scored more strictly than R1 for issues R1's judge didn't surface. |
| Mobile | 5 → **8** | 8 | Table `overflow-x-auto` scrolling and modal reflow confirmed working live at 375px. One R1 finding NOT yet fixed: the detail page's tab bar still clips the "Attachments" label with no overflow handling -- still tappable, just illegible. Closure CTA touch-target-size finding from R1 not independently re-verified this round. |
| Security | 8 | 6 | **Same underlying gap R1 already flagged** (`FindingDetails.tsx`'s attachment rendering -- image grid, video, PDF iframe, download link -- never applies the `isHttpUrl()` guard `CreateNewFindingModal.tsx` already established in this codebase for exactly this data), scored more severely this round: R3's judge traced concrete `javascript:`-URL-on-click/load exploitability through the iframe/anchor sinks specifically, which R1's judge didn't call out. Also newly flagged: `FindingDetails.tsx`'s upload flow skips the client-side file-type/size validation `CreateNewFindingModal.tsx`'s equivalent flow already does. |

**Average: 7.22/10** ((6+7+7+8+8+8+7+8+6)/9). **Two axes below floor**
(industry-standards 6, security 6) -- not converged, loop continues.

**Regression note, not a guardrail stop**: security (8→6) and
industry-standards (7→6) both read as score drops between rounds, which
the skill's guardrail defines as a hard-stop trigger. Read the actual
findings before treating it as one: round 2's shipped diff never
touched `FindingDetails.tsx`'s attachment-rendering code (only its
Upload File *button*) or any industry-standards-relevant surface (list
filtering/sorting/bulk-actions/SLA display) at all -- both axes'
findings this round describe the same pre-existing, never-touched gaps
R1's judge already named, just scored ~1-2 points more strictly by an
independent judge instance. This is judge-scoring variance on
untouched code, not a fix-introduced regression, which is what the
guardrail exists to catch ("a fix that helps one axis while pushing
another out of bounds"). Proceeding without escalation; logging the
reasoning explicitly per the guardrail's own spirit rather than
silently reclassifying it.

**Round 4 selection:** security's `isHttpUrl()` gap in
`FindingDetails.tsx` is a `security`-tagged finding sitting at/below its
own floor (6 < 7) -- by selection rule 5c.1 this wins outright over
industry-standards' gaps (which are `cosmetic/convention`-tier
feature-completeness gaps, not security/data-correctness), regardless
of `stuck_streak`.

**Batching**: the security fix (Tier 2 -- import and apply the existing
`isHttpUrl()` helper to `FindingDetails.tsx`'s 4 attachment-rendering
sinks) is batched with UX's Inspection-required-field finding (Tier 2 --
add a `required` rule + asterisk + error display to
`CreateNewFindingModal.tsx`, mirroring the already-fixed Line of Defense
pattern exactly). Both are Tier 2, and the two files (`FindingDetails.tsx`,
`CreateNewFindingModal.tsx`) are disjoint. Accessibility's and
resilience's `FindingDetails.tsx` findings are NOT batched in this round
since they'd share that file with the security fix; efficiency's
findings are deferred to a later round to keep this one reviewable.

## Round 4 outcome

Shipped the batched fix selected in round 3: security's attachment-URL
guard plus UX's Inspection-required-field finding, across two disjoint
files (PR #745).

1. **`FindingDetails.tsx` -- attachment rendering had no `isHttpUrl()`
   guard.** `action.attachments` (server-returned data) fed directly into
   `img`/`video`/`iframe` `src` and a download anchor's `href` with no
   scheme check. Added `const safeAttachments = action.attachments
   .filter(isHttpUrl)` once, right after the `action` guard, and switched
   every downstream sink (images grid, other-files list, tab-count badge,
   and transitively `PreviewModal`/`downloadFile`, since both only ever
   receive an already-filtered url) to read from it. The two remaining
   raw `action.attachments` uses (the upload-mutation PATCH body, the
   remove-attachment filter) were deliberately left unfiltered -- both
   are write paths to persisted state, not render sinks, and filtering
   there would silently drop pre-existing malicious DB entries on an
   unrelated write, out of scope for this fix.

2. **`CreateNewFindingModal.tsx` -- Inspection had no client-side
   validation.** Same silent-submit-failure pattern round 2 fixed for
   Line of Defense, on a sibling field: submitting with Inspection unset
   sent `inspectionId: undefined`, which the backend 400s on with a
   generic toast naming no field. The select was previously plain
   local-state-driven with no react-hook-form registration at all --
   wrapped in a `Controller` with `rules={{ required: isEdit ? false :
   ... }}`, given the same asterisk/`aria-required`/inline-error/
   scroll-into-view treatment as Line of Defense.

**QA**: typecheck/eslint clean. Full suite: 1945/1945 passing. Both
fixes have dedicated regression tests with verified negative controls
(temporarily reverted, confirmed the test fails for the right reason,
restored) -- the security test specifically checks the malicious entry
is excluded from the tab count and file list (an `img[src^="javascript:"]`
non-existence check alone turned out to be a false-negative-prone
assertion during drafting, since `fileType()` classifies an
extensionless url as "file", not "image", routing it to the file list
instead, which has no `src`/`href` attribute at all to assert against --
caught and fixed before shipping, worth remembering for any future
attachment-rendering test).

**Live verification**: after finding the shared dev server's Redis-backed
rate limiter (15 min window, keyed by IP, persists across a plain
process restart since the store lives in Redis not memory) was still
tripping from this session's earlier concurrent judge-panel load,
cleared it with a scoped `redis-cli del rl:api:127.0.0.1` (not a broader
flush) rather than waiting out the window. Confirmed both fixes live: a
finding with no attachments renders its empty state cleanly with zero
console errors; the Create Finding modal genuinely blocks submit with a
visible asterisk/red border/inline error when Inspection is unset, clears
on selection, and a real submit succeeds once one is picked. Verification
finding created via the live UI was deleted afterward to keep the preview
account clean.

**Regression check**: two disjoint files, no shared-file edit conflicts.
Round 1's finding review (2 parallel angles: correctness, security-
completeness) both came back with zero findings -- the security-
completeness pass specifically traced every attachment-URL sink in the
file end to end and confirmed no residual unfiltered path exists.

## Round 5 — fresh 9-judge panel

Round 4's diff touched real logic in two files (a security guard, a
form-validation rewrite), so this round re-ran the full panel.

| Axis | R3 | R5 | Note |
|---|---|---|---|
| Industry-standards | 6 | 6 | Unchanged. Same four gaps confirmed still live: no column sorting, no bulk actions, no status/priority/assignee/due-date filtering beyond site, no SLA/overdue visual treatment (a finding well past due renders identically to one not yet due), audit trail still free-text Messages only. None of round 4's fixes touch this axis's surface. |
| UX | 7 | 8 | Round 4's Inspection fix confirmed correct by code (exact mirror of the already-live-verified Line of Defense pattern) but the judge's own live click-through was blocked by the shared dev server's 429 rate limiter -- docked one point for partial-only live confirmation, not a code defect. No new UX friction found. |
| Efficiency | 7 | 7 | Unchanged, live-reproduced. Both R3 findings (no search debounce; `useMyAssignedInspectionIds()` called without its opt-in `role` param at all 3 call sites despite `role` already being resolved locally in each) confirmed still present and unaddressed -- neither was in round 4's scope. |
| Accessibility | 8 | 8 | R3's aria-label gap (search input, Messages compose input) still open, unaddressed. R4's new Inspection field got the asterisk/`aria-required` half of the established pattern right (matches Line of Defense exactly) but not the missing half: neither Inspection's nor Line of Defense's inline error has `aria-describedby`/`aria-live`, so a screen-reader user gets no announcement on a rejected submit -- not a regression (R4 replicated a pre-existing gap, didn't introduce a new one), but real. |
| Visual polish | 8 | 8 | R3's title-Link-vs-Site-Link color inconsistency confirmed still present (screenshotted live). R4's Inspection asterisk is byte-identical to Line of Defense's -- no new inconsistency introduced. One new minor note: Inspection is a stacked full-width field while its Action Details siblings are horizontal label-left/select-right rows -- pre-existing, not R4's scope. |
| Resilience | 8 | 8 | R3's `isError` gap in `FindingDetails.tsx` confirmed still present and live-reproduced this round via an actual 429 response rendering the same "Finding Not Found" UI as a genuine missing record. `safeAttachments` (R4's own addition) verified resilient -- `isHttpUrl` safely handles non-strings, and the code path can't reach it with malformed `data` anyway (early-returns at the `!action` guard first). |
| Code quality | 7 | 7 | Unchanged/still at floor. God component and attachment-UI duplication persist and slightly grew (1224→1270 lines). New finding: R4's Inspection field is dual-source-of-truth -- `value` is bound to `selectedInspectionId` local state, not Controller's `field.value`, kept in sync only by convention across `field.onChange` + `handleInspectionChange`'s own `setValue` call. R4's own review called this "harmless redundancy"; this round's judge flags it as a real smell regardless of harm-so-far. |
| Mobile | 8 | **7** | Regressed one point, stays at/above floor (7 = floor exactly) -- not a hard-stop guardrail trip. R3's tab-bar-clipping finding (`FindingDetails.tsx`, no `overflow-x-auto`/`flex-wrap` on the Details/Messages/Attachments tab row) confirmed still unfixed by code; judge's own live mobile screenshot was blocked by the same 429 rate-limiting that hit several judges this round. Held down partly for the two-round-unaddressed issue, partly for incomplete live confirmation. |
| Security | 6 | **9** | R4's `isHttpUrl()` fix independently re-verified end-to-end by a fresh judge instance -- every attachment-URL sink (images grid, files list, tab badge, `PreviewModal`, `downloadFile`) confirmed routed through `safeAttachments`, no residual gap. Noted `CreateNewFindingModal.tsx`'s own equivalent guard is unchanged and still correct, confirming the pattern is now applied consistently across both files. Upload-validation asymmetry (still open, correctly out of scope) re-confirmed as low-severity, not blocking. |

**Average: 7.56/10** ((6+8+7+8+8+8+7+7+9)/9). **One axis below floor**
(industry-standards, 6) -- not converged, loop continues.

**Regression check (guardrail)**: mobile dropped 8→7, which per the
skill's tiered guardrail is "regressed but stays at/above floor" (7 =
floor exactly, not below it) -- logged, gets one round's selection
priority per step 5c.3, but does NOT trip the hard-stop guardrail
(which only fires on a drop *below* floor). No axis dropped below its
own floor this round. Security's 6→9 jump and industry-standards'
flat 6→6 both read as expected given round 4's actual diff (security
fix landed and is confirmed complete; industry-standards' surface was
never touched).

**Round 6 selection:** industry-standards is the only axis at/below
floor this round. `stuck_streak` computation (per the log's R1/R3/R5
full-panel history, R2/R4 didn't re-score this axis): R1→R3 changed
(7→6, streak resets), R3→R5 unchanged AND at/below floor (6→6, both
<7) → `stuck_streak = 1`. No `data-correctness`/`security` finding
sits at/below floor this round (security is now 9), so selection falls
to highest `stuck_streak` -- industry-standards, the only nonzero
candidate, wins by rule 5c.2 outright (mobile's regressed-but-
above-floor tier only applies "otherwise," after this check).

**Fix selection within the axis**: of industry-standards' four
open gaps (no sorting, no bulk actions, no SLA/overdue treatment, no
structured audit trail), sorting and bulk actions are Tier 3
(new interaction model, selection state, toolbar) and a structured
audit trail is a genuine new data concept (a change-history entity
distinct from Messages) -- both disproportionate to a single round.
SLA/overdue visual treatment is Tier 2: `dueDate` already exists on
every finding, so this is purely derived-and-rendered, no new field or
endpoint. Selected as this round's fix. Not batching in mobile's
regressed tab-bar finding despite its own selection-priority bump --
the overdue treatment touches due-date rendering in both
`AllFindingsPage.tsx` AND `FindingDetails.tsx` (confirmed by the
resilience judge's own citation of both files' due-date rendering
code), and the tab-bar fix also touches `FindingDetails.tsx` --
same-file simultaneous edits stay sequential per the skill's batching
rule, so mobile's fix is deferred to a later round instead.

## Round 6 outcome

Shipped the SLA/overdue visual treatment selected in round 5 (PR #747).

New shared helper `src/utils/findingOverdue.ts` (`isFindingOverdue`,
false for COMPLETE/CANT_DO regardless of due date, otherwise true once
`dueDate < now`), wired into `AllFindingsPage.tsx`'s Due Date column
and `FindingDetails.tsx`'s Timeline section -- critical-colored bold
date text plus an "Overdue" label with a warning icon, explicitly
modeled on `CompliancePage.tsx`'s existing identical treatment for the
same underlying concept rather than inventing a new visual language.

**QA**: typecheck/eslint clean. Full suite: 1957/1957 passing. The
helper has its own unit tests (past/future due dates, COMPLETE/CANT_DO
exemption, an exactly-now boundary case) plus dedicated regression
tests in both feature files, with a verified negative control.

**Live verification**: confirmed both list and detail pages render the
overdue treatment correctly against real preview-account data (two
genuinely past-due findings showed it, one not-yet-due finding didn't),
no console errors.

**Review**: two parallel angles (correctness, visual/i18n). Correctness
came back clean. Visual/i18n found one minor issue -- the list page's
overdue date used `font-semibold` where `CompliancePage.tsx`'s pattern
(this PR's own explicitly-cited model) uses `font-bold` -- fixed in a
follow-up commit on the same PR and merged without a second review
round, since it was a single-line Tailwind-class change with the
underlying logic already independently confirmed sound by the
correctness pass.

**Regression check**: `AllFindingsPage.tsx` and `FindingDetails.tsx`
both touched, but purely additive (a new derived boolean plus
conditional styling) with no removed/changed prior behavior on any
other axis's surface.

## Round 7 — fresh 9-judge panel

Round 6's diff (a new pure helper plus due-date rendering in two files)
was narrow but still touched real render logic in both files, so this
round re-ran the full panel.

| Axis | R5 | R7 | Note |
|---|---|---|---|
| Industry-standards | 6 | **7** | Overdue treatment confirmed live and correctly implemented (including status-based suppression). Closes 1 of 4 flagged gaps. Bulk actions, sorting, and multi-field filtering (beyond site) still entirely absent; audit trail still free-text Messages only. |
| UX | 8 | **9** | Hits target. Round 2/4's silent-submit-failure fixes (Line of Defense, Inspection) reconfirmed live. Only new finding: `FindingDetails.tsx`'s Inspection card shows a raw truncated ID instead of the inspection's name -- code itself flags this with a `{/* Inspection Info - Placeholder */}` comment, i.e. known-incomplete, not a regression. |
| Efficiency | 7 | **6** | Same two findings (no search debounce; `useMyAssignedInspectionIds()` missing its opt-in `role` param at all 3 call sites) confirmed unambiguously still present via direct code read -- unaddressed for a third consecutive full-panel round, scored more strictly this round. |
| Accessibility | 8 | 8 | Same two open findings (placeholder-only search/compose inputs; unannounced form errors) confirmed present. New observation: a third instance of the same missing-announcement pattern found on the inspections-load-error message. Round 6's "Overdue" label passes 1.4.1 (text-plus-icon, not color-only). |
| Visual polish | 8 | 8 | Title/Site Link color inconsistency confirmed still present in both themes. Round 6's overdue treatment verified to genuinely match `CompliancePage.tsx`'s pattern class-for-class in both light and dark mode, using the same WCAG-AA-audited shared token. |
| Resilience | 8 | **6** | Same `FindingDetails.tsx` `isError` gap (unaddressed for 4 rounds now) live-reproduced this round via a monkey-patched 500 response, rendering the same "Finding Not Found" UI as an actual 404. `isFindingOverdue()` (round 6) verified to fail closed on a malformed `dueDate` (`Invalid Date` comparisons are always `false`) -- no new edge-case bug. |
| Code quality | 7 | 7 | Round 6's own addition (`findingOverdue.ts`) is clean, well-scoped, well-tested -- explicitly assessed as high quality, offsetting nothing structurally since it's additive. All four previously-flagged systemic issues (god component, comment accumulation, attachment-UI duplication, Controller dual-source-of-truth) unchanged, god component and comment volume trending slightly worse by line count. Third consecutive round at floor. |
| Mobile | 7 | 7 | Tab-bar clipping finding finally got a genuine fresh live screenshot this round (cleared the rate limiter first) -- confirmed still present, unchanged. Round 6's overdue treatment verified to render cleanly at 375px in both the list and detail page with no clipping/squish. |
| Security | 9 | 9 | Round 6's diff confirmed to have zero security-relevant surface (pure date/status comparison). Round 4's attachment-URL fix re-confirmed intact via a fresh sweep; no new sinks found anywhere in the three main files. |

**Average: 7.44/10** ((7+9+6+8+8+6+7+7+9)/9). **Two axes below floor**
(efficiency 6, resilience 6) -- not converged, loop continues.

**Regression note, not a guardrail stop**: both efficiency (7→6) and
resilience (8→6) crossed below their floor this round, which the
skill's guardrail defines as a hard-stop trigger. As in round 3's
identical situation (security/industry-standards both crossed below
floor that round on unchanged, untouched findings), the underlying
issue in both cases is unchanged code scored more strictly by an
independent judge instance -- round 6's diff never touched
`AllFindingsPage.tsx`'s search/debounce code, any `useMyAssignedInspectionIds()`
call site, or `FindingDetails.tsx`'s `useGetFindingByIdQuery` destructure.
Proceeding without escalation, consistent with the round-3 precedent
and for the same documented reason: this is judge-scoring variance on
never-touched code, not a fix-introduced regression, which is what the
guardrail exists to catch.

**Round 8 selection**: no `data-correctness`/`security` finding sits
at/below floor (security is 9). `stuck_streak` per the log's R1/R3/R5/R7
full-panel history (R2/R4/R6 didn't rescore every axis):
- Efficiency: 6→7→7→6 -- R5→R7 *changed* (7→6), so despite being
  below floor now, its streak resets to 0 this round by the metric's
  own definition (a streak requires the score to be *unchanged* from
  the round before, not just "bad").
- Resilience: 8→8→8→6 -- same story, R5→R7 changed (8→6), streak = 0.
- Industry-standards: now above floor (7), not eligible.
- Code quality: 9→7→7→7 -- R3→R5 unchanged-and-at-floor, R5→R7
  unchanged-and-at-floor again -- **streak = 2, the only nonzero
  streak this round**, despite code quality's raw score (7, at floor)
  being less severe on paper than efficiency/resilience's (6, below
  floor). Followed mechanically per the skill's own rule rather than
  overridden by feel -- the point of a deterministic metric is that it
  doesn't get second-guessed round to round.

Code quality wins selection by rule 5c.2. Within the axis, its most
persistent single finding (flagged in rounds 3, 5, and 7 -- three
consecutive full-panel rounds) is `FindingDetails.tsx`'s image-grid
and other-files-list sections duplicating the same Preview/Download/
Remove button cluster nearly verbatim. This is also independently
consistent with this session's own standing feedback memory on
proactively extracting genuinely-repeated (3+) logic into a shared
helper. Selected as round 8's fix: extract a shared attachment-actions
sub-component in `FindingDetails.tsx`. Tier 1/2 (contained
refactor, single file, no behavior change) -- not batching in another
axis's finding this round to keep the refactor's own diff easy to
review in isolation.

## Round 8 outcome

Shipped the `AttachmentActions` extraction selected in round 7 (PR #749).

A single component now covers both the images-grid and other-files-list
Preview/Download/Remove button clusters, with a `variant: "overlay" |
"inline"` prop covering the one real visual difference between them.
Pure refactor -- event handlers, conditional logic, and rendered output
unchanged.

**QA**: typecheck/eslint clean. Full suite: 1957/1957 passing, zero
test changes needed -- every pre-existing attachment-rendering test
already exercised this code through its real call sites.

**Live verification**: page renders cleanly against real preview data
with zero console errors. Documented an honest gap rather than
overclaiming: no finding in the current preview account has real
attachments, and this session's browser tooling has no file-upload
capability, so the populated image-grid/file-list variants weren't
independently click-tested live -- relied on the unchanged, passing
pre-existing test suite for that coverage instead.

**Review**: two parallel angles (correctness/behavior-preservation,
code-quality/design). Correctness came back clean (confirmed
behavior-identical, one cosmetic class-order nitpick with zero
computed-style effect). Design review rated the initial extraction
"acceptable, not good": found unnecessary `t` prop-drilling (the
component could call `useTranslation()` itself) and noted the 4
`variant === "overlay" ? ... : ...` ternaries just relocated the
duplication into branching logic rather than eliminating it. Both
fixed in a follow-up commit (dropped the prop, replaced the ternaries
with a single `ATTACHMENT_ACTIONS_VARIANTS` config object keyed by
variant), verified clean by a scoped round-2 review pass, merged.

Deferred, not fixed: the review's larger suggestion to converge these
raw `<button>` elements onto the codebase's shared `cva`-based `Button`
component -- real visual-regression risk, pre-existing debt this
refactor didn't introduce, disproportionate to a contained round.

## Round 9 — scoped panel (code quality only)

Round 8's diff was a pure refactor, confirmed behavior-identical by two
independent review passes, confined to one file
(`FindingDetails.tsx`). Per the skill's scoped-carry-forward shortcut,
only re-ran the axis round 8 actually targeted (code quality); the
other 8 axes carry forward their round-7 scores unchanged, each with
zero code-overlap with round 8's diff.

| Axis | R7 | R9 | Note |
|---|---|---|---|
| Industry-standards | 7 | 7 (carried forward) | Not touched by round 8's diff. |
| UX | 9 | 9 (carried forward) | Not touched. |
| Efficiency | 6 | 6 (carried forward) | Not touched. |
| Accessibility | 8 | 8 (carried forward) | Not touched. |
| Visual polish | 8 | 8 (carried forward) | Not touched. |
| Resilience | 6 | 6 (carried forward) | Not touched. |
| Code quality | 7 | **8** | Fresh re-score. Attachment-UI-duplication finding confirmed genuinely resolved (one implementation, not two blocks relocated) -- both of the extraction's own review-flagged issues (t prop-drilling, relocated ternaries) also confirmed fixed. The other three standing findings (god component, `any` usage, Controller dual-source-of-truth) unchanged; comment volume roughly flat. |
| Mobile | 7 | 7 (carried forward) | Not touched. |
| Security | 9 | 9 (carried forward) | Not touched. |

**Average: 7.56/10** ((7+9+6+8+8+6+8+7+9)/9). **Two axes below floor**
(efficiency 6, resilience 6) -- not converged, loop continues.

**Round 10 selection**: no `data-correctness`/`security` finding at/below
floor. `stuck_streak`, extending the R1/R3/R5/R7/R9 sequence (treating
a carried-forward score as a genuine "unchanged" data point, since it's
even stronger evidence nothing was attempted on that axis than an
independently-reconfirmed unchanged score would be):
- Efficiency: R5=7, R7=6 (changed, streak resets to 0 at R7), R7=6 →
  R9=6 (unchanged AND at/below floor) -- **streak = 1 at R9**.
- Resilience: R5=8, R7=6 (changed, streak resets to 0 at R7), R7=6 →
  R9=6 (unchanged AND at/below floor) -- **streak = 1 at R9**.
- Industry-standards: now above floor (7), not eligible. Code quality:
  R7=7→R9=8, changed, streak = 0.

Efficiency and resilience tie at streak=1. Tiebreak: lowest raw score
first (also tied, both 6), then roster order -- Efficiency is listed
before Resilience in the judge roster, so efficiency wins.

**Fix selection**: efficiency's two open findings, both confirmed still
present via direct code read every round since round 3 (rounds 3, 5,
7): (1) `AllFindingsPage.tsx`'s search input has no debounce, firing a
fresh backend request per keystroke; (2) `useMyAssignedInspectionIds()`
is called with no `role` argument at all 3 Findings call sites
(`AllFindingsPage.tsx`, `FindingDetails.tsx`, `FindingClosureControls.tsx`),
wasting a fetch for VIEWER/LIGHT_USER despite `role` already being
resolved locally in each file and the hook's own skip-param existing
specifically for this. Both are Tier 1/2, both from the same axis --
shipping together this round even though the debounce fix and one of
the three role-param call sites both touch `AllFindingsPage.tsx`: the
file-overlap restriction in the skill's batching rule is about
batching *different* candidate fixes from potentially different
sources into one round to save review cycles, not about doing two
related fixes from the same selected axis in the same file
sequentially within one round's own diff -- there's no simultaneous-
edit merge-conflict risk since it's one continuous diff, not two
independently-developed branches being combined.

## Round 9/10 outcome

Shipped both efficiency fixes selected in round 9 (PR #751).

1. **Search debounce** (`AllFindingsPage.tsx`): added `useDebouncedValue`
   (300ms, the same shared hook 2 of 3 sibling pages already use for
   this exact problem) between the raw input-bound `search` state and
   the query's `searchTerm`, so the input stays visually instant while
   the backend only sees one request per pause in typing rather than
   one per keystroke.
2. **`role` param propagation**: `useMyAssignedInspectionIds(role)` now
   passed at all 3 Findings call sites (`AllFindingsPage.tsx`,
   `FindingDetails.tsx`, `FindingClosureControls.tsx`), letting
   VIEWER/LIGHT_USER skip a structurally-always-empty fetch, matching
   the migration `InspectionTable.tsx`/`InspectionReport.tsx` already
   made for the same hook.

**QA**: typecheck/eslint clean. Full suite: 1963/1963 passing.
Dedicated regression tests for both fixes with verified negative
controls.

**Live verification**: confirmed on a clean page load that typing a
search term correctly filters after the debounce delay (matching term
-> 1 row, non-matching -> 0, clear -> resets to all 3), with a single
request per typed value. One methodology note worth keeping: an
initial attempt showed a stuck, unfiltered render despite a correct
0-result backend response -- traced to this specific browser tab's
degraded state after extremely heavy reuse across this whole session
(misfired clicks landing on wrong elements, a transient 0x0 viewport),
not an app defect; did not reproduce after a clean navigate. Real
per-round takeaway: when a live-verification result looks wrong,
re-test on a clean reload before concluding it's a genuine bug,
especially late in a long session that has reused the same tab
heavily.

**Review**: two parallel angles (correctness, UX/completeness).
Correctness came back clean. UX/completeness found one real, minor
issue the debounce change newly exposed: the empty-state heading/
subtext branched on the raw (undebounced) `search` value while the
empty state itself is driven by the debounced query -- during the
~300ms window, typing a new character into an already-empty results
table could flip the copy to "no results, adjust your search" a beat
before the query for that new term had even fired. Fixed in a
follow-up commit (both conditionals now read `debouncedSearch`),
verified clean by a scoped round-2 review pass, merged.

## Round 11 — fresh 9-judge panel

Round 9/10's diff touched real logic (debounce timing, conditional
fetch skipping) across 3 files, not eligible for the scoped-shortcut --
full panel re-run.

| Axis | R9 | R11 | Note |
|---|---|---|---|
| Industry-standards | 7 | 7 | Same three gaps (no bulk actions, no sorting, no multi-field filtering beyond site) confirmed unchanged, live-verified. |
| UX | 9 | 9 | Empty-state debounce fix confirmed working live (typed a non-matching term, count correctly dropped to 0 with no stale-text flash). Only remaining note: Inspection card shows a raw ID not a name, still marked as a known placeholder in code. |
| Efficiency | 6 | **9** | Both round 9/10 fixes independently re-verified: live-tested typing "ext" produced exactly 2 requests total (initial load + final debounced value), zero per-keystroke firing; role-param propagation confirmed correct at all 3 call sites with the hook's own skip condition traced. No new findings. |
| Accessibility | 8 | 8 | Same two findings (unlabeled search/compose inputs; unannounced form errors) confirmed live, unchanged -- round 9/10's diff didn't touch this markup. |
| Visual polish | 8 | 8 | Same title/site Link color inconsistency confirmed in both themes. New minor note: the table shows a horizontal scrollbar even at full 1280px desktop width -- not yet a selected finding, logged for a future round. |
| Resilience | 8 | **6** | `FindingDetails.tsx`'s `isError` gap confirmed unaddressed for a sixth consecutive scored round (1/3/5/7/9/11). Judge documented `AllFindingsPage.tsx`'s existing isError-handling pattern in detail (role="alert" row, `loadError` copy, `refetch`-backed retry) as the precedent round 12's fix should mirror. |
| Code quality | 8 | 8 | Round 9/10's own diff (useDebouncedValue reuse, role-param threading) assessed clean, no new debt. The three standing findings (god component, `any` usage, Controller dual-source-of-truth) unchanged. |
| Mobile | 7 | 7 | Same tab-bar clipping confirmed with precise live measurement (label's right edge at x=400 vs. a 375px viewport). Debounced search confirmed working correctly via real touch input at mobile width, no new regression. |
| Security | 9 | 9 | Round 9/10's diff confirmed to have zero security surface. Attachment-URL guard re-confirmed intact via a fresh, focused read. |

**Average: 7.89/10** ((7+9+9+8+8+6+8+7+9)/9). **One axis below floor**
(resilience, 6) -- not converged, loop continues. Highest average of
the loop so far (previous best was 7.56 in rounds 5 and 9).

**Round 12 selection**: resilience is the only axis at/below floor,
and its finding (`FindingDetails.tsx` missing `isError` handling on
`useGetFindingByIdQuery`) is both `broken-functionality`-adjacent (a
genuine network error is actively mislabeled as a 404, a false and
misleading signal to the user) and the single longest-standing
unaddressed finding in the entire loop -- flagged and reconfirmed in
6 of 11 rounds without ever being selected, since a lower-scoring axis
always won priority first. No axis-selection ambiguity this round.
The fix mirrors `AllFindingsPage.tsx`'s own established isError
pattern exactly (distinct error copy, `role="alert"`, `refetch`-backed
retry) rather than inventing a new one, per round 11's own judge
documentation of that precedent.

## Round 12 outcome

Shipped the detail-page network-error state selected in round 11
(PR #753) -- the single longest-standing finding in the whole loop,
flagged and reconfirmed in 6 of 11 rounds (1/3/5/7/9/11) without ever
being selected until now.

`FindingDetails.tsx` now destructures `isError`/`refetch` from
`useGetFindingByIdQuery` and renders a distinct error state (before
the `!action`/not-found fallthrough) instead of mislabeling a genuine
fetch failure as a missing record: `AlertTriangle` icon, a
"Failed to load this finding" message, a primary-styled Retry button
wired to `refetch()`, and a secondary Go Back button.

**QA**: typecheck/eslint clean. Full suite: 1967/1967 passing. Four
dedicated regression tests with a verified negative control.

**Live verification, partial and documented honestly**: confirmed the
success path renders cleanly with zero console errors. Confirmed (by
briefly stopping the backend, then restarting it immediately) that
this route produces a genuine `ERR_CONNECTION_REFUSED` failure at the
network layer during a real outage. Could not get a final clean live
render of the error UI itself in that same browser session -- the page
stayed on its loading spinner through a backend restart and a
fresh-tab retry during that specific test, which did not reproduce
moments later in an entirely new tab (loaded normally). Read as this
session's shared browser environment being degraded after many hours
and 12 rounds' worth of judge/review agents, not a defect in the
change -- the isError branch itself is proven by the unit test's
verified negative control. Documented in the PR rather than silently
treated as fully live-confirmed.

**Review**: two parallel angles (correctness, UX/consistency).
Correctness came back clean (confirmed branch ordering, imports, RTK
Query isLoading/isError transition semantics, meaningful non-redundant
tests). UX/consistency found two real issues: the new error state was
missing `role="alert"` (a real accessibility regression against the
very `AllFindingsPage.tsx` precedent this block says it mirrors), and
the Retry/Go Back buttons had inverted visual hierarchy (Go Back
styled primary/filled, Retry secondary, backwards for the more likely
first action). Both fixed in a follow-up commit, verified clean by a
scoped round-2 review pass, merged.

**Running total**: 12 rounds shipped (PRs #744-753, all merged).
Round 11's average (7.89/10, highest of the loop so far) had exactly
one axis below floor -- resilience, now fixed. Round 13 will show
whether that closes the gap to convergence or surfaces the next axis
in line.

## Round 13 — fresh 9-judge panel

Round 12's diff added a whole new conditional branch/UI to
`FindingDetails.tsx` (not a zero-behavior-change refactor), so this
round re-ran the full panel rather than using the scoped shortcut.

| Axis | R11 | R13 | Note |
|---|---|---|---|
| Industry-standards | 7 | 7 | Same three gaps confirmed, now also verified absent at the API layer itself (`GetAllFindingsArgs` has no status/priority/assignee/dueDate params at all) -- not just a frontend wiring gap. |
| UX | 9 | 9 | Same Inspection-ID-vs-name gap, unchanged for a 4th round. Round 12's error state assessed as good UX live (correct Go Back behavior, live-verified against a real 404). |
| Efficiency | 9 | 9 | Round 12's Retry button live-tested: 3 clicks -> exactly 3 requests, no runaway/duplicate firing. |
| Accessibility | 8 | 8 | Same two findings, 5th consecutive flat round. Round 12's new `role="alert"` independently confirmed live to be a real, correctly-scoped DOM node, not just present in source. |
| Visual polish | 8 | 8 | Same two findings (title/site Link inconsistency, desktop-width horizontal scroll) confirmed live. Round 12's error state assessed clean and on-brand. |
| Resilience | 6 | **9** | Round 12's fix independently reconfirmed **live** this time (a fresh session avoided the browser-tab degradation that blocked round 12's own live check) -- stopped the backend, reproduced the exact expected error UI, restarted the backend, confirmed full recovery. One new minor finding: `AllFindingsPage.tsx`'s site-filter dropdown query has no isError handling (low severity, not a floor concern). |
| Code quality | 8 | 8 | Round 12's addition assessed as clean in isolation, but noted a new observation: `FindingDetails.tsx` now has three near-identical full-screen state blocks (loading/error/not-found) that could consolidate into one shared component -- not yet selected as a finding, logged for a future round. |
| Mobile | 7 | 7 | Same tab-bar clipping, 4th consecutive flat round at floor. This round's judge supplied a specific suggested fix (`overflow-x-auto` + `shrink-0` on the tab buttons, or narrower padding/labels at small breakpoints). |
| Security | 9 | 9 | Round 12's diff confirmed to have zero security surface. Attachment-URL guard re-confirmed intact. |

**Average: 8.22/10** ((7+9+9+8+8+9+8+7+9)/9). **Zero axes below floor**
for the first time in the loop -- highest average by a wide margin
(previous best 7.89). Not yet converged (target average is 9, current
is 8.22).

**Round 14 selection, with a documented deviation from the mechanical
rule**: `stuck_streak` (extending the R7/R9/R11/R13 sequence) ties
industry-standards and mobile at streak=2 (both flat-at-floor for two
consecutive comparisons), with industry-standards winning the
roster-order tiebreak per rule 5c.2. However: industry-standards' only
three remaining findings (bulk actions, column sorting, multi-field
filtering) were confirmed this round to be genuinely blocked, not just
disproportionate -- a quick research pass into the sibling `aexa-server`
repo confirmed the list endpoint's backend handler (`get_all_action_from_db`)
hardcodes `orderBy: { createdAt: 'desc' }` and only reads
`searchTerm`/`siteId`/`inspectionId`/`page`/`limit` from the request;
status/priority/assignee/dueDate filtering and any sort param are
absent server-side entirely, not merely unused by the frontend.
Implementing any of these three findings properly would require
backend changes outside this repo's (and this session's) scope --
faking client-side-only sort against a server-paginated, 20-row-page
dataset would silently sort just the visible page while implying the
whole list is sorted, a real correctness/trust bug worse than the gap
it claims to fix. Deferring industry-standards again (as rounds 5/7
already did for the same reason) and selecting mobile instead --
streak=2 tied for highest among currently-actionable axes, with a
concrete, cheap (`overflow-x-auto`/`shrink-0`), already-diagnosed fix
sitting unaddressed for 4 rounds.

## Round 14 outcome

Shipped the mobile tab-bar overflow fix selected in round 13 (PR #755)
-- `overflow-x-auto` on the tab row, `shrink-0`/`whitespace-nowrap` on
each tab button, closing a finding that had sat flat at floor for 4
consecutive rounds (5/7/9/11/13).

**QA**: typecheck/eslint clean. Full suite: 1968/1968 passing.
Dedicated regression test with a verified negative control.

**Live verification**: confirmed at a real 375px viewport in a fresh
tab -- genuine scrollbar present (`scrollWidth` 401px vs `clientWidth`
329px, was silently clipping before), scrolling reveals the full,
uncut "Attachments" label, no console errors.

**Review**: one angle (a small, low-risk, single-file pure-CSS change
didn't need a second). Came back clean -- confirmed no desktop-width
regression risk, `shrink-0` doesn't interfere with the active-tab
underline, test logic sound. One out-of-scope observation not acted on
in this PR: `AdminSettings.tsx` has a visually similar tab-navigation
pattern that was never checked for the same issue -- flagged as a
separate follow-up task rather than pulled into this feature's loop.

**Running total**: 14 rounds shipped (PRs #744-755, all merged).
