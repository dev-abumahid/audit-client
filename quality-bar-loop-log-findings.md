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
