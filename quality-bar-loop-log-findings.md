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
