# Quality Bar Loop — Inspections (`/organization/audit/inspections`, InspectionTable.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10 (default,
not a hard stop per standing user instruction carried over from earlier
loops in this same session).
Active judges: industry-standards, UX, efficiency, accessibility, visual
polish, resilience & edge cases, code quality, mobile/responsive, security
(both conditional judges activated -- the page manages field inspections
with create/edit/delete and file uploads, same risk profile as every other
org page looped this session).

Standing merge authorization: yes (carried over from earlier loops in this
same session -- merge automatically once a fix passes review).

Started as the next item in the sidebar-navigation sweep, immediately
after the Templates loop reached a comprehensive stopping point (5 rounds,
every round-1 industry-standards finding addressed except full version
history, judged disproportionate to the round's scope). No prior
quality-bar-loop history exists for this page. User instruction: "keep
going down the list of tabs" -- explicitly, do not pause between rounds/
pages to ask permission to continue; only stop for a genuine blocker.

## Round 1

| Axis | Score |
|---|---|
| Industry-standards | 5/10 |
| UX | 6/10 |
| Efficiency | 5/10 |
| Accessibility | 5/10 |
| Visual polish | 6/10 |
| Resilience & edge cases | 5/10 |
| Code quality | 5/10 |
| Mobile/responsive | 3/10 (lowest) |
| Security | 9/10 |

**Average: 5.44/10.** Below target (9); 8 of 9 axes below floor (7) --
only security clears it.

Key findings by axis:

- **Mobile (3/10, lowest):** the same systemic 44px touch-target bug
  fixed on 9+ pages this session, but hitting the primary field-
  inspector on-site workflow this time -- row Eye/Edit/Delete buttons
  measure 30x24px, even the largest Button size (`lg`) only reaches
  32px tall, checkbox answers are 20px, the Start-New modal's site/
  template combobox rows measure 30px tall and the popover itself
  (380px) exceeds a 375px viewport. Also: the table needs horizontal
  scroll on mobile with no responsive fallback, and the bottom step-nav
  in CreateNewInspection/UpdateInspection isn't pinned so a user must
  scroll past all of a page's questions to reach Next/Submit.
- **Efficiency (5/10):** CreateNewInspection.tsx/UpdateInspection.tsx
  re-render their ENTIRE question tree on every keystroke (no
  memoization, unlike InspectionReport.tsx's own memo'd QuestionCard/
  PageSection pattern); UpdateInspection.tsx's visibleNotes effect does
  O(totalQuestions) work per keystroke; StartInspectionModal's site/
  template search has no debounce (inconsistent with InspectionTable's
  own 500ms debounce).
- **Code quality (5/10):** CreateNewInspection.tsx and
  UpdateInspection.tsx are near-duplicates (739 vs 1265 lines) with the
  file-validation block copy-pasted 4x and already-drifted (Update
  fixed a media-rendering bug Create never got); pervasive `any` despite
  typed shapes existing elsewhere (InspectionReport.tsx uses them
  correctly); InspectionTable.tsx does too much for one 497-line
  component; a dead/misleading "Actions" section in InspectionReport.tsx
  renders an always-empty list using field names the code's own comment
  admits don't match the real model.
- **Accessibility (5/10):** InspectionTable.tsx's row Eye/Edit/Delete
  icon buttons have ZERO accessible name (confirmed live: ariaLabel
  null, empty text) -- the single highest-traffic control on the page.
  A genuine keyboard trap: CreateNewInspection.tsx's per-answer media
  delete at one call site is a `<span onClick>` with no role/tabIndex/
  keyboard handler (a sibling instance in the same file, and
  UpdateInspection.tsx's equivalent, both correctly use `<button
  aria-label>`). Modal infrastructure itself (DeleteAlertModal, the
  report's media lightbox) is genuinely solid.
- **Resilience (5/10):** InspectionReport.tsx never destructures
  `isError` from its single-inspection query, so a real fetch failure
  is permanently mislabeled "still loading" with no retry --
  UpdateInspection.tsx (same hook) already has the correct fallback.
  StartInspectionModal's site/template queries have the same isError
  gap InspectionTable.tsx explicitly fixed for itself in an earlier
  round. **Real backend gap:** `update_inspection_into_db` accepts a new
  `siteId` and writes it without re-validating it belongs to the
  caller's org (the sibling create path does validate this) -- a
  cross-org data-reassignment risk.
- **UX (6/10):** live-reproduced a real data-integrity bug -- a
  slider question with a non-numeric configured default value silently
  stores and displays the literal string in a submitted, completed
  inspection record. Every question on a page shows "Q1" regardless of
  its real position (live-confirmed with 3 distinct questions all
  badged Q1). The protected system template ("do not edit") is
  selectable in the Start-New picker with nothing preventing a real
  inspection against it. Required-field validation only fires at final
  submit, not per-page.
- **Visual polish (6/10):** the same "In Progress" inspection renders
  amber on the table/edit views but teal (hardcoded `bg-primary/10`) on
  the report page -- live-confirmed in both themes. UploadNotesModal
  hand-rolls raw Tailwind gray instead of the app's semantic tokens, and
  one "selected file" color has no dark-mode variant at all.
  Create/UpdateInspection have two different maturity levels for the
  identical "remove media" control (one dark-mode-safe, one not).
- **Industry-standards (5/10):** core template-to-inspection-to-PDF-
  report workflow is real and solid, but missing several things
  reference tools (SafetyCulture/Fulcrum/GoCanvas/Zenput) treat as
  table stakes: no scoring/compliance %, no recurring/scheduled
  inspections, no bulk actions, no offline/draft-first capture, no
  camera-native capture. Report page has no empty-state for a
  zero-page template (UpdateInspection.tsx already handles this
  identical case).
- **Security (9/10):** file upload client-side has no validation but
  is fully backstopped server-side (MIME allowlist, size limit, UUID
  filenames blocking path traversal). Org-scoping, role-gating, and
  IDOR guards are careful and consistent everywhere except the one
  resilience-axis finding above (siteId re-validation on update).

**Next fix (Round 2):** mobile is the clear lowest score and the same
proven, lowest-risk touch-target pattern fixed on 9+ sibling pages this
session -- and it's the primary on-site field-inspector workflow, so
it matters most here specifically. Going first.

## Round 2 (mobile)

Shipped as aexa-frontend PR [#678](https://github.com/Qiyrix/aexa-frontend/pull/678), merged.

Fixed every round-1 mobile finding plus several cheap adjacent
accessibility/UX/visual-polish issues found in the same files:

- **InspectionTable.tsx**: Start New button, search input, and row
  Eye/Edit/Delete buttons to 44px, plus accessible names on the
  previously-unlabeled row action buttons (each interpolates the
  inspection's template name). The two filter `SelectTrigger`s needed
  `!h-11` (important modifier), not a plain `h-11` -- `SelectTrigger`
  sizes itself via a data-attribute-scoped Tailwind variant
  (`data-[size=default]:h-7`) that tailwind-merge doesn't reliably
  override with an unscoped className the way it does for plain cva
  Button/Input size variants used everywhere else this session.
  Confirmed live (28px measured before, 44px after) and now covered by
  a dedicated unit test -- the `SelectTrigger` test mock previously
  returned `null`, hiding the bug from the whole suite; the mock itself
  was fixed to render className/children so this class of regression
  can't hide again.
- **StartInspectionModal.tsx**: site/template popover triggers, list
  items, and footer buttons to 44px; excludes the protected system
  template from the picker (`isSystemTemplateName` filter); each
  trigger's accessible name now combines the static field label with
  the live selected-site/template text via `aria-labelledby` (pointing
  only at the static label would have replaced the button's own
  text-derived name entirely).
- **CreateNewInspection.tsx / UpdateInspection.tsx**: checkbox answer
  touch target via the wrapping label's `min-h-11`; sticky bottom
  action nav on Create (previously required scrolling past every
  question on a page to reach Next/Submit); header `flex-wrap` for long
  template names; fixed the "every question badged Q1" bug (was
  indexing by page, not by the question's own position within the
  page); converted a keyboard-trap `<span onClick>` media-remove control
  to a real `<button>`.
- **UploadNotesModal.tsx**: footer button touch targets, an
  `overflow-y-aut` typo, a missing dark-mode color variant.
- **Shared `Dialog` component** (`src/components/ui/dialog.tsx`): both
  the built-in close (X) button and `DialogFooter`'s optional close
  button get the 44px fix -- applies app-wide, largest blast radius of
  this round. Verified via the full suite (5213 tests, zero
  regressions) plus live checks on two unrelated dialog consumers (Team
  Members "Invite Member," Findings "Create Finding"). Review caught
  that the close button's `icon-sm` size resolves to the single
  `size-6` utility, which tailwind-merge does not reliably dedupe
  against a separate `h-11 w-11` -- the same class of gotcha as the
  SelectTrigger fix above, just missed initially. Fixed to `!h-11
  !w-11` in the same PR, negative-controlled, reconfirmed live at
  44x44px.

Investigated one review-shaped finding (a status-toggle pattern
possibly triggering a redundant auto-save) and found it didn't
reproduce with this React Hook Form version -- kept the test as a
documented regression guard rather than shipping an unnecessary fix.

Live verification (375x812): Inspections list, Start Inspection modal
(including live confirmation the system template is excluded from the
picker), a full inspection run through a 3-section template (numbering
correctly resets to Q1 per section, not a running count), the edit
page's status trigger, and the shared Dialog fix on two other
consumers. All passed.

QA gate: typecheck clean, eslint clean (one pre-existing unrelated
warning), full vitest suite 353 files / 5213 tests passing.

Round 2 is done. Per the standing instruction to keep going down the
list of tabs without pausing between rounds, round 3 would normally
start now (next-lowest tied axes: accessibility/efficiency/resilience/
code-quality/industry-standards, all at 5/10) -- paused here only
because the user asked to pause specifically after this PR merged, to
ask a few questions.
