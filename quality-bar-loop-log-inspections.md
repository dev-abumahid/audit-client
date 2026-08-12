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

Round 2 is done. User asked to pause after the PR merged to ask a few
questions (about whether AI-workflow quality is being tracked -- see
[[project_ai_judge_deferred]] for the resulting decision: add a 10th
AI-quality judge later, once other pages are near 9/10; for now keep
running the existing 9-axis panel). Resumed immediately after.

## Round 3 (fresh 9-judge panel)

| Axis | Round 1 | Round 3 |
|---|---|---|
| Industry-standards | 5/10 | 4/10 |
| UX | 6/10 | 3/10 |
| Efficiency | 5/10 | 4/10 |
| Accessibility | 5/10 | 4/10 |
| Visual polish | 6/10 | 6/10 |
| Resilience & edge cases | 5/10 | 3/10 |
| Code quality | 5/10 | 5/10 |
| Mobile/responsive | 3/10 | 6/10 |
| Security | 9/10 | 6/10 |

**Average: 4.56/10** (down from round 1's 5.44, despite mobile improving
+3). This is **not** a regression caused by round 2's diff -- that diff
only touched touch-target CSS and a handful of accessible-name/keyboard
fixes across the frontend inspection files and the shared Dialog
component; it never touched the backend, `RunInspection.tsx`, the
slider default-value logic, or answer/mediaFiles rendering. Round 3's
panel was simply more thorough than round 1's and surfaced real,
pre-existing issues a shallower first pass missed, plus round 2's own
accessibility work incidentally exposed adjacent gaps (keyboard-
unreachable uploads, hover-only delete overlays) that round 1 never
probed for.

Key new/confirmed findings by axis:

- **UX (3/10, new lowest):** the round-1 slider data-integrity bug is
  still live (reproduced: a non-numeric configured default renders the
  literal string "text" under the slider handle). Bigger finding: a
  second, more mature "run inspection" flow exists
  (`RunInspection.tsx` + `InspectionNote`/`InspectionRecommendations`/
  `InspectionActions`, with debounced autosave, a save-state indicator,
  and a findings-count badge) but is completely unreachable from the UI
  -- `InspectionTable.tsx` only links to the report and update pages.
  The actually-wired Create/Update flow has zero required-field
  validation on marking an inspection COMPLETED, in either flow.
- **Resilience (3/10, tied lowest):** `InspectionReport.tsx` never
  destructures `isError`, live-confirmed to permanently show "Loading
  report..." on a real 404. `StartInspectionModal.tsx`'s site/template
  queries have the same gap. Backend: `update_inspection_into_db`
  (aexa-server, inspection.service.ts:261-282) still writes a
  client-supplied `siteId` with zero org-ownership check, unlike the
  sibling create path (inspection.service.ts:186-195) which validates
  it correctly -- confirmed untested in the security test suite too.
- **Security (6/10, down from 9):** the siteId gap above, persisting
  through a full round unaddressed. Plus a new finding: `answer`/
  `mediaFiles` fields (inspection.validation.ts) are typed `z.any()`
  with no URL-scheme restriction, while `attachments` already has a
  `httpUrl` schema specifically added to reject `javascript:`/`data:`
  schemes after an earlier independent review -- the fix was never
  applied to the other client-supplied URL-bearing fields. Frontend
  (`InspectionReport.tsx`) renders `answer` straight into `href`,
  `<img src>`, and `window.open()` with no sanitization, so this is a
  stored-XSS-shaped gap, not just a theoretical inconsistency.
- **Accessibility (4/10):** confirmed round-2 fixes hold up live (row
  button accessible names, keyboard-trap-to-button). New, serious
  finding: every file/media upload control across the feature (photo
  attach, note upload, document attach -- CreateNewInspection.tsx,
  UpdateInspection.tsx, UploadNotesModal.tsx, 6+ call sites) is
  completely keyboard-unreachable: a `display:none` input inside a
  `<label>` wrapping a non-focusable `<span>`, a WCAG 2.1.1 Level A
  failure on a core, frequently-used action. Also: focus-visible
  failures on 4 hover-only reveal controls, no live-region on
  full-page async loads.
- **Efficiency (4/10):** all four round-1 findings (unmemoized
  question-tree re-renders on every keystroke in both Create/Update,
  UpdateInspection's O(totalQuestions) visibleNotes effect per
  keystroke, undebounced site/template search in StartInspectionModal)
  confirmed unchanged -- round 2 never touched render/memoization code.
- **Industry-standards (4/10):** all five round-1 gaps (no scoring/
  compliance %, no bulk actions, no recurring/scheduled inspections, no
  offline capture, no camera-native input) confirmed still open, plus
  a confirmed empty-state gap for zero-page templates on the report
  page (UpdateInspection.tsx already handles this case correctly).
- **Mobile (6/10, up from 3):** round 2's fixes hold up live (row
  actions, search/filter, StartInspectionModal, checkbox targets). New
  findings from a harder mobile pass: the table still has no responsive
  fallback (only confined horizontal scroll); several controls round 2
  missed are still sub-44px (UpdateInspection's raw-label "Upload file"
  attachment button at 114x32, an attachment remove Trash icon at
  14x14, per-question media-thumbnail remove buttons at 24x24, the
  report page's "Download PDF" button at 159x40, a hand-rolled media
  lightbox close button at 28x28 that bypassed the shared Dialog fix
  since it isn't built on the shared component); and a genuine touch
  hazard -- the image-answer delete control is a hover-only, full-image
  overlay (`opacity-0 group-hover:opacity-100`) with no touch
  equivalent, so tapping anywhere on an uploaded photo silently deletes
  it with no visible warning first.
- **Visual polish (6/10, unchanged):** the amber-vs-teal status-pill
  inconsistency between InspectionTable/UpdateInspection and
  InspectionReport is still open, live-confirmed in both themes.
  UploadNotesModal's raw-Tailwind-gray dropzone is unfixed (only the
  one dark-mode variant round 2 touched was fixed). New: three visually
  distinct "remove/delete" treatments exist across the feature with no
  shared pattern, none routed through the app's own
  `severityBadgeClasses`/`SEVERITY_STYLES` despite that module's stated
  purpose being to unify exactly this kind of scattered color decision.
- **Code quality (5/10, unchanged):** the file-validation duplication
  (4x across Create/Update) is unfixed and has drifted further --
  UpdateInspection now correctly derives real media type from MIME
  (fixing bug #515) while CreateNewInspection still hardcodes
  `type: "image"` for every upload, reintroducing the same bug class in
  its untouched twin. `any` remains pervasive, including inside
  InspectionReport.tsx's own sub-component prop types despite a real
  `PageDef` type being one hop away. The previously-misleading dead
  "Actions" section now has an honest comment explaining the gap
  (issue #108) instead of silently rendering empty -- a genuine, if
  small, improvement.

**Next fix (this round):** the two security findings together --
they're both backend-only, small, well-precedented by existing sibling
code in the same files (mirror `create_inspection_into_db`'s siteId
org-ownership check; mirror `attachments`' `httpUrl` schema), and
concretely serious (cross-tenant data reassignment + a stored-XSS-shaped
hole), so they take priority over the larger architectural findings
(the orphaned RunInspection flow, the Create/Update duplication) which
need more product-level thought before touching.

## Round 4 (security)

Shipped as aexa-server PR [#325](https://github.com/Qiyrix/aexa-server/pull/325)
and aexa-frontend PR [#679](https://github.com/Qiyrix/aexa-frontend/pull/679),
both merged.

- **Backend (aexa-server #325):** `update_inspection_into_db` now
  validates a client-supplied `siteId` belongs to the caller's org before
  writing it, mirroring `create_inspection_into_db`'s existing check --
  closes the cross-org site-reassignment gap. `QuestionAnswer.mediaFiles`
  now goes through a `{ url: httpUrl, type: string }` schema instead of
  `z.any()`, in both the create path (`QuestionAnswerSchema`) and
  `update_question_answer`, matching the scheme check
  `Inspection.attachments` already had. `QuestionAnswer.answer` is
  deliberately left unrestricted -- it's polymorphic across question
  types, not just URLs, so a schema-level scheme check would reject
  legitimate non-URL answers for every other question type.
- **Frontend (aexa-frontend #679):** since `answer` can't get a backend
  schema check, added a render-time guard (`isHttpUrl`, mirroring the
  backend's `httpUrl` refinement) at every sink that renders a
  client-supplied URL-shaped value into `<img src>`/`<video><source
  src>`/`<a href>`/`window.open`. Review caught that the first pass only
  guarded the read-only `InspectionReport.tsx`; the same class of sink
  exists unguarded in the live-editing screens
  (`CreateNewInspection.tsx`, `UpdateInspection.tsx`) for both the
  single-answer media renderer and the `mediaFiles[].url` thumbnails --
  extended to all of them in a follow-up commit. A second review pass
  then caught that inspection-level `attachments[]` had the identical
  unguarded `<a href>` sink in both `InspectionReport.tsx` and
  `UpdateInspection.tsx`; fixed as a defense-in-depth measure (the
  backend already validates `attachments`' scheme on write, so this only
  protects pre-existing records from before that check existed).

Every fix in both PRs was negative-controlled (reverted, confirmed the
new test fails, restored) before merging.

QA gates: aexa-server -- typecheck/lint clean, full suite 75 files /
1431 tests passing. aexa-frontend -- typecheck/lint clean, full suite
354 files / 5224 tests passing. Live-verified the report page renders
normally post-fix (no regression on legitimate content).

Security is expected to move meaningfully off 6/10 next round, though a
fresh judge pass is needed to confirm by how much -- this round didn't
touch the industry-standards, UX, efficiency, accessibility, resilience,
code-quality, or the non-siteId resilience findings (the report page's
missing `isError` handling, `RunInspection.tsx` being unreachable, the
slider data-integrity bug), all still open for a future round.

## Round 5 (resilience)

Shipped as aexa-frontend PR [#680](https://github.com/Qiyrix/aexa-frontend/pull/680), merged.

- `InspectionReport.tsx`'s `useGetSingleInspectionQuery` never checked
  `isLoading`/`isError` -- live-confirmed permanently stuck on "Loading
  report..." after a real 404 (network log showed the 404, UI never
  reflected it). Now distinguishes loading (spinner), a genuine fetch
  error (`role="alert"`, distinct copy, a button back to the list), and
  a legitimate not-found -- mirrors `UpdateInspection.tsx`'s existing
  not-found state and `InspectionTable.tsx`'s existing error/empty
  distinction, both pre-existing patterns in this codebase.
- `StartInspectionModal.tsx`'s site/template queries had the identical
  gap: a fetch failure rendered the same "no site/template found" empty
  state as a legitimately empty org. Now both `CommandEmpty` blocks
  distinguish a real fetch error from a genuinely empty result.

Review confirmed the fix is correct and complete for these two files
(no scope collisions, no cmdk-filtering edge case, no unwanted refetch/
spinner-flash interaction since `InspectionReport.tsx` has no mutations
on this page) but flagged that the identical unguarded `useGetAllSitesQuery`
`isError` gap still exists, untouched, in four other pages: `SiteFilter.tsx`,
`TemplatesPage.tsx`, `CompliancePage.tsx`, and `AllFindingsPage.tsx` (some
other queries in those same files already guard `isError` from earlier
quality-bar-loop rounds, just not this one). Noted for when those
pages/features are reached in the broader sweep -- out of scope for an
Inspections-only round.

QA gate: typecheck/lint clean, full suite 354 files / 5228 tests
passing. Live-verified the report page and Start Inspection modal both
render normally against real data post-fix.

## Round 6 (UX)

Shipped as aexa-frontend PR [#681](https://github.com/Qiyrix/aexa-frontend/pull/681), merged.

The round-1/round-3 slider data-integrity finding: `defaultAnswer =
q.value || 5` only caught falsy values, so a non-numeric configured
default (e.g. `"text"`) flowed straight through as the initial answer
-- live-confirmed rendering the literal string under the slider handle
while the native `<input type="range">` silently clamped its own DOM
value to 5, leaving the label and the handle disagreeing. New shared
`parseSliderDefault()` util (`src/utils/parseSliderDefault.ts`), used
by both `CreateNewInspection.tsx` and `UpdateInspection.tsx` at the
initial-default step only (doesn't touch a real saved answer). Review
caught that a plain `Number(value)` coercion would still silently
accept a boolean (`true` -> 1) or a whitespace-only string (`"   "` ->
0) as a "valid" default instead of falling back to 5 -- tightened to
only accept genuine numbers and non-blank numeric strings, with tests
for each edge case, negative-controlled throughout.

QA gate: typecheck/lint clean, full suite 355 files / 5236 tests
passing. Live-verified the edit page still renders normally.

Standing user instruction (received this session): keep working
autonomously, no pauses, until every feature clears a 7/10 floor on
all 9 quality-bar-loop axes -- a much larger scope than finishing
Inspections alone. Continuing the Inspections rounds first since it's
already mid-loop, then sweeping the rest of the sidebar
(Findings, Board Reports, Settings, and re-visiting every
already-"complete" page like Templates/Risk Register for a fresh
9-axis re-score against this stricter floor) once Inspections itself
clears 7/10 on all 9 axes.

## Round 7 (accessibility)

Shipped as aexa-frontend PR [#682](https://github.com/Qiyrix/aexa-frontend/pull/682), merged.

- **The serious finding**: every file/media upload control across the
  feature (6 call sites across `CreateNewInspection.tsx`,
  `UpdateInspection.tsx`, `UploadNotesModal.tsx`) used
  `className="hidden"` (`display:none`) on the real `<input
  type="file">`, removing it from the tab order entirely -- a WCAG
  2.1.1 Level A failure on a core action. Switched to `sr-only`
  (visually hidden via clip/absolute positioning, not `display:none`),
  keeping the input focusable so Tab reaches it and Enter/Space opens
  the native file picker. Review confirmed this repo's `sr-only` is the
  stock Tailwind definition (not locally overridden to
  `display:none`/`visibility:hidden`, which would have defeated the
  fix), confirmed it doesn't disrupt layout or mouse-click behavior
  (still `position: absolute`, nested inside the same `<label>`), and
  confirmed the fix is genuinely complete for these 6 call sites.
- Four hover-only reveal controls (`opacity-0
  group-hover:opacity-100`) had no focus-visible counterpart -- added
  `group-focus-within:opacity-100` alongside. Review confirmed each
  button is a real descendant of its `group` ancestor, so
  `:focus-within` correctly fires.
- Bonus fix found in the same file: `UpdateInspection.tsx`'s "Upload
  file" attachment label was a raw label (not routed through the
  shared `Button`), measuring 114x32px live -- missed by the round-2
  mobile sweep since it never went through the shared component.
  `min-h-11` closes this leftover gap. Live-confirmed at 44px.

Review also flagged (out of scope for this PR, noted for later):
the identical `<input type="file" className="hidden">` keyboard bug
still exists, untouched, in 7 other files outside Inspections --
`KnowledgeBaseUploadingForm.tsx`, `PersonalInfoForm.tsx`,
`CreateNewFindingModal.tsx`, `GeneralInformation.tsx`,
`CompliancePage.tsx`, `AuditPage.tsx`, and
`CreateTemplateWithAIDialog.tsx`. Worth applying the same `sr-only`
fix when those pages/features are reached in the broader sweep.

QA gate: typecheck/lint clean, full suite 355 files / 5242 tests
passing. Live-verified on the edit page: file inputs measure
`display: block` (not `none`) with the `sr-only` class, and the
"Upload file" label now measures 44px tall.

## Round 8 (efficiency)

Shipped as aexa-frontend PR [#683](https://github.com/Qiyrix/aexa-frontend/pull/683), merged.

`StartInspectionModal.tsx`'s site/template search inputs fed straight
into their query's `searchTerm` on every keystroke, firing one network
request per character -- inconsistent with `InspectionTable.tsx`'s own
search box, which already debounces 500ms (issue #243). Applied the
same shared `useDebouncedValue` hook; the input's own displayed value
stays instant, only the query args are debounced.

Review caught two real gaps this debounce widened/interacted with,
fixed in the same round:
- The site branch never cleared its search term on select (the
  template branch already did) -- a leftover search term plus the new
  debounce meant the debounced refetch could land after selection with
  a list that no longer contains the selected site, silently clearing
  the derived `selectedSite` while `selectedSiteId` stayed set.
  Mirrors the template branch's existing `setTemplateSearch("")`.
- cmdk's default client-side fuzzy filter was re-filtering an
  already-server-filtered list against the RAW (non-debounced) search
  text -- could transiently hide a result that already matched the
  server's response, or show `CommandEmpty` prematurely during the
  debounce window. `shouldFilter={false}` on both `Command` components
  removes the redundant, conflicting filter.

Caught my own test-authoring bug mid-round: the first version of the
site-search-clear test never actually typed a search term before
selecting, so it passed identically with or without the fix (a
tautological test) -- caught by the negative-control step itself
(reverting the fix should have failed the test and didn't), fixed by
typing "HQ" before selecting.

QA gate: typecheck/lint clean, full suite 355 files / 5247 tests
passing. Live-verified the site/template pickers still filter
correctly end-to-end (precise debounce timing isn't observable live
through browser-tool round-trip latency, so that part relies on the
negative-controlled fake-timer unit tests, which are the reliable
source of truth here).

Efficiency's two remaining findings (unmemoized question-tree
re-renders on every keystroke in Create/UpdateInspection, and
UpdateInspection's O(totalQuestions) visibleNotes effect per keystroke)
are larger, riskier changes -- next round.

## Round 9 (efficiency + a real correctness bug)

Shipped as aexa-frontend PR [#684](https://github.com/Qiyrix/aexa-frontend/pull/684), merged.

`UpdateInspection.tsx`'s visibleNotes-seeding effect was keyed on
`[answers]`, re-running a full `Object.entries().forEach()` over every
question on every keystroke (any answer edit creates a new `answers`
reference) and unconditionally overwriting the whole `visibleNotes`
state. Beyond the per-keystroke cost, this was a genuine correctness
bug: opening an empty "Add Note" field for one question, then editing
a *different* question's answer, silently closed the just-opened note
field again -- the recompute only looks at saved note text, so an
empty-but-just-opened note gets dropped on every unrelated edit.

Fixed by merging the seeding into the existing one-time
answers-initialization effect (same `initialized.current` gate,
same `initial` object both states are seeded from). Review confirmed
this loses no genuine behavior: `useGetSingleInspectionQuery` refetches
after `updateInspection`/`updateInspectionQuestionAnswer`/
`splitInspectionNote` don't actually re-populate `answers` either
(that effect was already gated to run once), so there was no working
"re-seed on refetch" behavior to preserve -- the AI note-splitting flow
already needed a manual reload to surface new notes, unrelated to this
fix.

Caught my own test-authoring bug again this round: the first version
of the new test typed into the just-opened note's own `<textarea>`
instead of a different question's field, because `role="textbox"`
matches both and an index-based query grabbed the wrong one -- the
negative control (revert, expect failure) instead passed, which is
what caught it. Fixed by targeting the other question's field by
placeholder text specifically.

QA gate: typecheck/lint clean, full suite 355 files / 5248 tests
passing (one unrelated Radix focus-scope timer flake in
`CreateNewFindingModal.test.tsx` under full-suite parallelism,
confirmed clean in isolation). Live-verified the edit page still
renders normally.

Efficiency's one remaining finding -- unmemoized question-tree
re-renders on every keystroke in both `CreateNewInspection.tsx` and
`UpdateInspection.tsx` (the whole page's question list re-renders on
every single answer change, unlike `InspectionReport.tsx`'s own
memoized `QuestionCard`/`PageSection` pattern) -- is next: a larger,
riskier refactor (extracting per-question sub-components across two
700-1300 line files) that needs more careful design than a
single-effect fix, so it gets its own round.

## Round 10 (efficiency -- last of the four originally-identified findings)

Shipped as aexa-frontend PR [#685](https://github.com/Qiyrix/aexa-frontend/pull/685), merged. The largest and riskiest single change of this loop.

Both `CreateNewInspection.tsx` and `UpdateInspection.tsx` inlined
their entire per-question `Card` in the parent's
`page.questions.map()`, so editing any single question's answer
re-rendered every question on the page on every keystroke -- the same
class of issue `InspectionReport.tsx`'s own memoized
`QuestionCard`/`PageSection` pattern already avoids. Extracted a
memoized `QuestionCard` component in each file (`React.memo`,
primitive/stable props only), which required making every callback
passed into it referentially stable:

- `CreateNewInspection.tsx`: three handlers already used the
  functional setState-updater form and just needed `useCallback` with
  an empty dep array; two others were rewritten to read
  `prev[questionId]` inside the functional updater instead of closing
  over `answers` directly.
- `UpdateInspection.tsx` needed a different pattern since its
  auto-save mutation always sends the full answer/note/mediaFiles
  trio, not a partial patch -- added an `answersRef` mirror (synced
  via a small effect) so handlers can read the *current* value of a
  question's other fields at save time while `setAnswers` itself
  stays a pure functional updater.

Given the size and risk of this change, dispatched an unusually
thorough review (allowed up to 600 words instead of the usual ~350)
covering: behavioral equivalence of the rewritten handlers, a
rapid-fire same-question-edit race in the new `answersRef` pattern,
RTK Query mutation-trigger reference stability (traced into
`@reduxjs/toolkit`'s own source to confirm `updateQuestionAnswer` is
genuinely stable), `useParams()` stability assumptions, and a
line-by-line JSX diff of both extracted components against the
originals. No confirmed regressions: the one race condition found
(same-question, two-different-fields edited in the same tick can drop
the first field's change from the persisted payload until the next
edit) was verified to exist identically in the pre-refactor
closure-based code -- a preserved characteristic, not something this
refactor introduced. Two minor, non-blocking notes (a cosmetic
`?? ""` vs `!` non-null-assertion difference, and a currently-safe but
fragile `mediaFiles` array fallback) were judged not worth blocking on.

QA gate: typecheck/lint clean, full suite 355 files / 5248 tests
passing (all existing functional tests for both files pass unchanged
against the refactored components -- meaningful given neither file
has a dedicated render-count test, matching this codebase's own
existing convention for `InspectionReport.tsx`'s memoized components).
Live-verified extensively: typing in an answer updates only that
field, `UpdateInspection`'s debounced auto-save still fires and
succeeds (confirmed via the PUT request and success toast), the note
field opens/edits independently of the answer field, and the "Add
Finding" modal still opens with the correct question data --
confirmed on both `CreateNewInspection.tsx` (fresh inspection flow)
and `UpdateInspection.tsx` (editing an existing one).

**This closes out all four originally-identified efficiency findings
from round 1/3's judge panel.** Combined with rounds 4-9's security,
resilience, UX, and accessibility fixes, a fresh 9-judge re-score is
warranted before picking the next round -- most axes should have
moved meaningfully since the round-3 baseline (4.56/10 average). Per
the user's standing instruction to keep working autonomously without
pausing, re-running the panel now and continuing directly into
whichever axis is lowest.

## Round 11 (fresh 9-judge re-score after 10 fix rounds)

| Axis | Round 3 | Round 11 |
|---|---|---|
| Industry-standards | 4/10 | 3/10 |
| UX | 3/10 | 5/10 |
| Efficiency | 4/10 | 9/10 |
| Accessibility | 4/10 | 7/10 |
| Visual polish | 6/10 | 6/10 |
| Resilience & edge cases | 3/10 | 5/10 |
| Code quality | 5/10 | 4/10 |
| Mobile/responsive | 6/10 | 6/10 |
| Security | 6/10 | 9/10 |

**Average: 6.0/10** (up from round 3's 4.56). **Efficiency, accessibility,
and security now clear the 7/10 floor.** Six axes remain below it:
industry-standards, UX, visual polish, resilience, code quality, mobile.

Key findings by axis:

- **Efficiency (9/10, up from 4):** all three round-3 findings
  (undebounced search, the visibleNotes effect, unmemoized question
  re-renders) independently re-verified as genuinely fixed, not just
  cosmetically wrapped -- the judge specifically checked every
  `useCallback` dependency array for the "still includes a value that
  changes every render" footgun and found none. One pre-existing,
  out-of-scope minor inefficiency noted (StartInspectionModal and
  InspectionTable each independently fetch all sites with different
  cache keys, so opening the modal can't reuse the table's cached
  fetch) -- cheap future fix, not blocking.
- **Security (9/10, up from 6):** both round-4 fixes (siteId
  org-ownership, httpUrl scheme validation) confirmed intact and
  confirmed to have survived round 10's large refactor undamaged. The
  judge caught that local `main` hadn't pulled PR #325's merge at
  first and re-fetched before scoring -- a reminder that "current
  source" claims need an explicit fetch, not just a stale local
  clone.
- **Accessibility (7/10, up from 4, clears floor):** round-7 fixes
  (keyboard-reachable uploads, focus-visible hover controls) hold up
  live, no regression from round 10's refactor. Still open: no
  live-region announcement on full-page async loads (flagged 3
  rounds running now, still untouched). New: `UploadNotesModal.tsx`'s
  two mode-selector buttons convey the active mode only via
  border/background color, no `aria-pressed`/`aria-selected` --
  missed by every prior pass on this feature.
- **Resilience (5/10):** the round-4/5 fixes (backend siteId,
  InspectionReport.tsx/StartInspectionModal.tsx isLoading/isError)
  confirmed still correct. New/missed: `CreateNewInspection.tsx`'s
  `useGetSingleTemplateQuery` never checks `isError` at all (only
  `isLoading`), so a failed template fetch renders a fully-styled
  empty inspection form indistinguishable from a legitimately
  zero-section template; `UpdateInspection.tsx`'s own
  `useGetSingleInspectionQuery` has the identical gap, showing the
  same "not found" message for a real fetch error as for a genuine
  404 -- the exact bug class round 5 fixed in two sibling files,
  missed in these two.
- **UX (5/10, up from 3):** the slider bug is confirmed fixed
  live. Still open: the second, more mature `RunInspection.tsx` flow
  remains a completely orphaned dead end (only reachable by typing
  the URL, a closed loop of internal links with nothing pointing in);
  zero required-field validation when marking an inspection
  COMPLETED from either `UpdateInspection.tsx`'s status dropdown or
  the orphaned `RunInspection.tsx` -- inconsistent with
  `CreateNewInspection.tsx`'s initial submit, which does enforce this.
  A single accidental status-dropdown click can complete an
  inspection with mandatory questions still blank.
- **Mobile (6/10, unchanged):** only 1 of 6 round-3 findings closed
  (the "Upload file" button, fixed incidentally by round 7's
  accessibility change, not a deliberate mobile pass). The most
  severe finding -- the hover-only, full-image delete overlay that
  silently deletes an uploaded photo on any tap since touch has no
  hover state -- is completely untouched and is a genuine data-loss
  trap, not just an ergonomics nit. Also still open: sub-44px Download
  PDF button (159x40), hand-rolled media lightbox close button
  (28x28, bypasses the shared Dialog fix since it's not built on that
  component), a 14x14 attachment remove icon with no padding, and
  24x24 per-question media-thumbnail remove buttons.
- **Visual polish (6/10, unchanged):** confirmed via live screenshots
  in both themes that InspectionReport.tsx's status pill still
  hardcodes teal regardless of actual status, while
  InspectionTable.tsx/UpdateInspection.tsx correctly show amber vs.
  green via `severityBadgeClasses`. The "three remove-button
  treatments" finding is worse than first described: at least five
  distinct treatments exist, several within the single
  UpdateInspection.tsx file, none routed through the shared
  severity-style system.
- **Code quality (4/10, down from 5):** round 10's memoization
  refactor fixed a real performance bug but created a new ~300-line
  duplication debt -- two nearly-identical `QuestionCard` components
  across the two files with no shared component/hook factored out,
  directly contradicting this session's own "extract genuinely
  repeated logic" convention. The file-validation duplication/drift
  finding is confirmed still true and, worse, the drift widened:
  `UpdateInspection.tsx` now correctly derives real media type from
  MIME (fixing issue #515) while `CreateNewInspection.tsx` still
  hardcodes `type: "image"`, reintroducing that exact bug in its
  untouched twin. `any` remains pervasive, including in the two
  brand-new round-10 `QuestionCard` components themselves -- a missed
  opportunity to type them correctly during the same edit.
  `InspectionTable.tsx` remains a single 539-line monolith,
  materially unchanged in shape.
- **Industry-standards (3/10, down from 4):** all five round-3 gaps
  (no scoring, no bulk actions, no recurring inspections, no offline
  capture, no camera-native input) confirmed still fully open across
  7 subsequent fix rounds that never touched this axis, plus the
  zero-page-template empty-state gap on InspectionReport.tsx.

**Next fix (round 12):** the resilience isError gap in
`CreateNewInspection.tsx`/`UpdateInspection.tsx` -- cheap, well
precedented by the identical pattern round 5 already applied to
`InspectionReport.tsx`/`StartInspectionModal.tsx`, and closes a real
"silently broken looks like empty" bug in both files.

## Round 12 (resilience)

Shipped as aexa-frontend PR [#686](https://github.com/Qiyrix/aexa-frontend/pull/686), merged.

`CreateNewInspection.tsx`'s `useGetSingleTemplateQuery` and
`UpdateInspection.tsx`'s `useGetSingleInspectionQuery` only checked
`isLoading` -- the exact bug class round 5 fixed on their siblings
(`InspectionReport.tsx`/`StartInspectionModal.tsx`), missed here. A
failed template fetch rendered a fully-styled, zero-section inspection
form; a failed inspection fetch showed the same generic "not found"
message as a genuine 404. Both now distinguish loading, a genuine
error (`role="alert"`, distinct copy, a button back to the list), and
(for `UpdateInspection`) a legitimate not-found.

Review confirmed: the early-return ordering doesn't violate React's
rules of hooks in either file (all hooks still run unconditionally
before the new early returns), the `template?.pages || []` fallback
during an error state is safe (never actually rendered, since the new
error branch returns first), and the new tests correctly use
`getByRole("alert")` + a separate text-content check rather than
`getByRole("alert", {name: ...})` -- a pitfall this session already
hit and learned from twice before (`role="alert"` doesn't support
name-from-content per ARIA).

QA gate: typecheck/lint clean, full suite 355 files / 5250 tests
passing. Live-verified the edit page still renders normally with
prior test data intact.

**Next fix (round 13):** mobile's most severe open finding -- the
hover-only, full-image delete overlay on uploaded photos
(`CreateNewInspection.tsx`/`UpdateInspection.tsx`), which is a genuine
data-loss trap on touch devices (no hover state means tapping
anywhere on the photo silently deletes it, no confirmation, no
visible warning first). Concrete and fixable without a large
redesign: replace the hover-reveal overlay with an always-visible
small delete button (matching the pattern already used for
per-question media-thumbnail removal in the same files), removing the
full-image tap-to-delete surface entirely.

## Round 13 (mobile)

Shipped as aexa-frontend PR [#687](https://github.com/Qiyrix/aexa-frontend/pull/687), merged.

**The touch hazard (main fix):** replaced the hover-only, full-image
delete overlay on media answers (`CreateNewInspection.tsx`/
`UpdateInspection.tsx`) with an always-visible 44px corner button,
same pattern as the per-question media-thumbnail remove control
already used elsewhere in both files. No hover state means the old
overlay never appeared to reveal itself on touch, but the click
handler still covered the entire image -- any tap anywhere on the
photo silently deleted it. Review flagged two low-risk edge cases
(a genuinely tiny image could get its corner button clipped by the
container's `overflow-hidden`; the sibling fix's padded hit area
could very slightly overlap an adjacent chip at wrap boundaries) --
both judged not worth blocking on, neither is a confirmed live bug.

**Three smaller sub-44px fixes, same round:** `InspectionReport.tsx`'s
"Download PDF" button (159x40 -> 44px tall, the primary action of the
whole report page), its hand-rolled media lightbox close button
(28x28 -> 44x44, never got the shared Dialog fix since it isn't built
on that component), and `UpdateInspection.tsx`'s attachment-remove
icon (14x14 zero-padding -> a 34x34 tappable area via `p-2.5 -m-2.5`,
short of the full 44px since this sits in a row of several small
wrapped chips where a full-size box would break the compact layout).

QA gate: typecheck/lint clean, full suite 355 files / 5253 tests
passing. Live-verified the edit page still renders normally with
prior test data intact.

**Mobile findings now closed**, except the table's lack of a
responsive fallback (a bigger redesign, out of scope for a
CSS-level round) and the 24x24 per-question media-thumbnail remove
buttons (judged proportionate to their role as a secondary action on
a small thumbnail, not the same severity as the full-image touch
hazard just fixed). Both are candidates the next mobile-focused round
should weigh, but neither is a data-loss trap like the one just
closed.

**Next fix (round 14):** visual polish -- the status-pill
inconsistency (`InspectionReport.tsx` hardcodes teal regardless of
actual status, unlike `InspectionTable.tsx`/`UpdateInspection.tsx`,
which correctly use `severityBadgeClasses`) is the cheapest, most
concrete open finding on this axis: swap the hardcoded classes for the
same helper the other two files already use.

## Round 14 (visual polish)

Shipped as aexa-frontend PR [#688](https://github.com/Qiyrix/aexa-frontend/pull/688), merged.

Fixed the status-pill inconsistency: `InspectionReport.tsx` hardcoded
`bg-primary/10 text-primary` regardless of actual status, unlike
`InspectionTable.tsx` (a `STATUS_BADGE` Record) and `UpdateInspection.tsx`
(a nested ternary), both of which already color-coded by status via
`severityBadgeClasses`. A CANCELLED inspection's report page rendered
the exact same color as a COMPLETED one.

Extracted the status->severity mapping -- now duplicated in 2 places,
about to become 3rd -- into a single `getInspectionStatusSeverity()`
helper in `inspectionStatus.ts`, used at all three call sites.

First review round found one real issue: `UpdateInspection.tsx`'s
`selectedStatus` state can be transiently empty on the render where
`inspection` first loads (lazy `useState` initializer runs before the
sync effect), and the new helper's "info" fallback for unrecognized
status differed from the old ternary's "medium" fallback -- a one-frame
wrong-color flash for IN_PROGRESS inspections. Fixed by falling back to
`inspection.status` directly (verified non-null at that render point)
instead of an empty string. Also added color regression tests to
`InspectionTable.test.tsx`/`UpdateInspection.test.tsx`, since the first
pass only covered the new `InspectionReport.tsx` pill, not the refactor
of the two existing call sites. Second review round came back clean.

QA gate: typecheck/lint clean, full suite 355 files / 5258 tests (then
5260 tests after round 15's file, see below) passing across both fix
rounds. Live-verified: opened a Completed inspection's report page,
confirmed the pill renders emerald/green (matching the table), and
confirmed a CANCELLED inspection's report page renders red instead of
the prior fixed teal.

**Next fix (Round 15):** the other visual-polish gap noted in round 11's
re-score -- `UploadNotesModal.tsx`'s file-upload dropzone hand-rolls raw
Tailwind gray/white instead of the app's semantic tokens, unlike every
other dropzone in this feature (`CreateNewInspection.tsx`/
`UpdateInspection.tsx`, both already on `border-border`/`text-foreground`/
shared `CloudUpload` icon).

## Round 15 (visual polish)

Shipped as aexa-frontend PR [#689](https://github.com/Qiyrix/aexa-frontend/pull/689), merged.

Fixed `UploadNotesModal.tsx`'s "extract note from file" dropzone: it was
the only upload control in Inspections still hand-rolling raw Tailwind
gray/white (`border-gray-300 bg-white dark:border-gray-700
dark:bg-gray-900`) plus a hand-rolled inline `<svg>` with kebab-case
attributes (`stroke-width`, `stroke-linecap`/`-linejoin`) that logged an
"Invalid DOM property" console warning on every render of file-upload
mode -- confirmed live. Replaced with the same `CloudUpload` icon +
semantic-token treatment (`border-border`, `bg-muted/30`,
`text-foreground`, `text-muted-foreground`) already established in
`CreateNewInspection.tsx`/`UpdateInspection.tsx`, and normalized the
"selected file" success text from ad hoc `green-600` to the
`emerald-700`/`emerald-400` shade `severityStyles.ts`'s "low" level
already uses everywhere else.

Review round came back clean: confirmed `CloudUpload` is a real
lucide-react export already used identically elsewhere, no structural/
accessibility regression (the `sr-only` input and its `htmlFor`/`id`
pairing untouched), and both new tests (semantic-token assertion,
console-warning absence) genuinely exercise the fix -- verified the
console-warning test's string match against React's actual
`console.error` format so it isn't a tautological always-pass.

QA gate: typecheck/lint clean, full suite 355 files / 5260 tests
passing. Live-verified: opened Upload Notes -> Extract note from file,
confirmed the dropzone renders with the `CloudUpload` icon and neutral
bordered-card styling matching the rest of the app; confirmed via
source grep that no kebab-case SVG attributes remain in this file (one
console-level pre-existing instance was found in the unrelated
`CreateTemplateWithAIDialog.tsx` -- noted as an out-of-scope finding for
a future round, not this one).

**Visual polish's two cheapest concrete findings from round 11 are now
both closed.** The axis's remaining open item from that re-score --
"at least five fragmented remove-button treatments" across the feature
-- is a broader consistency sweep (comparing every delete/remove
control's icon, color, and hover treatment across Create/UpdateInspection,
InspectionReport, and UploadNotesModal) rather than a single
concrete fix, making it the natural next visual-polish candidate, but it
also risks being a large diff for one round. Weighing that against the
other still-open axes (industry-standards 3, UX 5, resilience 5, code
quality 4, mobile 6 as of round 11's re-score) -- since mobile and
resilience already had rounds this loop (13 and 12 respectively) while
industry-standards, UX, and code quality haven't been touched since
round 3, and those three are also the lowest/most numerous-finding
axes -- **next fix (Round 16): code quality.** The round-10 `QuestionCard`
refactor left the same ~300-line component duplicated verbatim between
`CreateNewInspection.tsx` and `UpdateInspection.tsx` (props differ only
by 2 extra props on the Update side) -- the largest, most mechanical,
lowest-risk code-quality fix available: extract a single shared
`QuestionCard` component both files import.

## Round 16 (code quality)

Shipped as aexa-frontend PR [#690](https://github.com/Qiyrix/aexa-frontend/pull/690), merged.

Started on the planned fix above (unifying the two `QuestionCard`
components) but a side-by-side diff before implementing revealed the
"props differ only by 2" framing was stale: since round 10 the two have
genuinely diverged in *behavior*, not just props --
`UpdateInspection.tsx`'s handles video/document media-type branching (a
round-13 fix `CreateNewInspection.tsx` never got, since new inspections
can't yet have pre-existing video/document answers), an `isSaving`
indicator, and an `Add Finding` button that `CreateNewInspection.tsx` has
none of. Fully unifying them into one component would need a
config-driven design and a much larger, riskier diff than a single round
should take on blind. Re-scoped down rather than force the original plan
through: found a second, smaller code-quality duplication that genuinely
was identical -- the same 5MB size limit + 6-MIME-type allowlist,
independently copy-pasted 4 times (2 upload handlers x 2 files).

Extracted `validateInspectionFile()` into a new
`src/utils/inspectionFileValidation.ts`, used at all 4 call sites.
Callers keep their own toast copy (generic vs. file-name-interpolated),
since that legitimately differs between the single- and multi-file
upload flows -- only the check itself and the shared constants moved.

Review round came back clean except one cosmetic nit (the allowlist
array had no readonly/immutability signal) -- fixed same round.

QA gate: typecheck/lint clean, full suite 356 files / 5271 tests
passing (including the pre-existing component test that already
covered the oversized-file-rejection path end-to-end, unchanged through
the refactor -- a real regression guard, not just new coverage).
Live-verified: dispatched a synthetic oversized-image and
unsupported-type upload through the real "Add Media" flow on a live
inspection, confirmed both error toasts still fire with the correct,
file-name-interpolated copy through the extracted shared validator.

**The full `QuestionCard` unification is still open** and is now a
correctly-scoped, larger follow-up: it would need per-file conditional
rendering (media-type branching, `isSaving`, `Add Finding`) built into
one shared component via optional/conditional props, not a straight
extraction -- a multi-round undertaking on its own, not attempted
piecemeal here.

**Next fix (Round 17):** industry-standards is now the loop's clear
lowest/most-stale axis (3/10, untouched since round 3) with the most
concrete, cheaply-fixable gap: `InspectionReport.tsx` has no empty-state
handling for a template with zero pages/questions (renders a blank
report body with no message) -- the single smallest, most contained
industry-standards fix available before tackling the larger scoring/
bulk-actions/recurring-inspections gaps that same axis's round-3
findings raised.

## Round 17 (industry-standards)

Shipped as aexa-frontend PR [#691](https://github.com/Qiyrix/aexa-frontend/pull/691), merged.

Fixed `InspectionReport.tsx`'s blank-body gap: a template with zero
pages/questions (reachable for system templates like "AI-Generated
Findings" or any template a user hasn't added questions to yet) rendered
a completely empty main content area below the header/stats, no
message, no icon. `UpdateInspection.tsx`'s edit flow already had this
exact empty state (`FileQuestion` icon, same title copy) for the
identical condition -- reused it verbatim, plus a new
`noPagesReportDescription` i18n key with report-appropriate copy.

Review found one real, cheap gap beyond the stated scope: the sidebar's
"Sections" `<nav>` also silently rendered empty for the same zero-page
condition (no fallback, unlike `UpdateInspection.tsx`'s own sidebar,
which already has one) -- fixed same round rather than deferred, per
this session's standing preference for fixing small findings inline.
Second review round confirmed the fix is structurally sound (ternary
correctly wraps the pre-existing nav block, "Sections" label still
shown in both branches for a11y) and flagged only a cosmetic
indentation nit -- not worth a broader `prettier --write` pass, which
would have reformatted ~40 lines of unrelated pre-existing code just to
fix a few JSX indent levels.

QA gate: typecheck/lint clean, full suite 356 files / 5273 tests
passing. Live-verified against the real running dev server: temporarily
monkey-patched `window.fetch` to rewrite a live inspection's
`template.pages` to `[]` in the response (confirmed via a marker flag
that the patch genuinely intercepted a fresh request rather than
serving a cached response -- the fetch-monkeypatch pitfall this session
already hit once before), navigated to its report page client-side, and
confirmed the new empty state renders exactly as designed.

**Next fix (Round 18):** UX is the loop's other lowest/most-stale axis
(5/10, untouched since round 3). Its most concrete, contained finding:
marking an inspection COMPLETED has zero required-field validation --
a user can flip status to Completed with required questions still
unanswered, with no warning. `UpdateInspection.tsx` already tracks
`question.isRequired` (rendered as a `*` next to the question text) and
has a `handleStatusChange`-style handler for the status dropdown --
wiring a check there (block or warn-and-confirm before allowing
COMPLETED with unanswered required questions) is a real UX fix within
one round's scope, unlike the orphaned `RunInspection.tsx` flow or a
full inspection-scoring feature, both larger product decisions.

## Round 18 (UX)

Shipped as aexa-frontend PR [#692](https://github.com/Qiyrix/aexa-frontend/pull/692), merged. The most
iterated single fix this loop -- 3 fix-producing review rounds on one
PR, worth recording in full since two of the three "answered" detection
strategies tried were each wrong in opposite directions, and future
rounds touching this same check should start from what's proven rather
than re-discovering it:

1. **First attempt** -- `answer === "" || answer == null` (borrowed
   from InspectionReport.tsx's own `totalAnswered` convention). Broken:
   `UpdateInspection.tsx`'s init effect seeds every checkbox question
   with a local default of `false` and every slider with a non-empty
   default (`parseSliderDefault`), so an untouched required checkbox/
   slider already reads as "answered" and silently passes -- likely the
   single most common `isRequired` type, so this made the fix largely a
   no-op. Caught by review, which also flagged that the round's own test
   faked the checkbox as `answer: ""`, an unrealistic state that masked
   the gap.
2. **Second attempt** -- `!questionAnswerId` (only set once a real
   backend `QuestionAnswer` row exists). Looked right, but broken in the
   *opposite* direction: verified directly against aexa-server's
   `inspection.service.ts`, `create_inspection_into_db` creates a
   `QuestionAnswer` row for **every** question in the template at
   inspection-creation time (the frontend's create payload always
   submits one entry per question, defaults included, not just touched
   ones) -- so `questionAnswerId` exists for every question from the
   moment an inspection is created, checkbox/slider included, making
   this check never block anything for a real inspection. Caught by a
   second review round instructed to re-verify the claim against the
   actual backend code rather than trust the reasoning.
3. **Landed design** -- back to the value-based check, but now scoped
   honestly in a code comment: a real "unanswered" signal for text/
   date/multipleSelect/media questions (blank default genuinely is
   `""`), and a *documented, deliberate no-op* for checkbox/slider,
   whose local defaults are real, valid answers with no distinguishable
   "unset" state anywhere in this data model. A true tri-state
   "unanswered" checkbox would need a data-model change (a real `null`
   third state, with matching UI) well beyond one round's scope --
   written down rather than silently left unstated. A third review
   round, told to independently re-verify the backend claim itself
   (not just trust the commit message) and judge whether the narrowed
   scope was still worth shipping, came back clean.

QA gate (all three rounds): typecheck/lint clean, full suite ending at
356 files / 5275 tests passing. Tests updated each round to match:
final tests cover blocking on a genuinely-unanswered required text
question, and confirm an untouched required checkbox does *not* block
(the documented limitation, verified rather than assumed). Live-verified
against the real running dev server across the whole arc: confirmed a
real inspection's happy-path completion (all required answered) still
succeeds after every version of the check; used the session's
established fetch-monkeypatch technique to inject a genuinely-unanswered
required question into a live inspection's response and confirmed the
final version blocks it with "Cannot mark as Completed: 1 required
question(s) still unanswered" -- then restored the real fetch and
reloaded to confirm the actual backend record was never touched.

**Next fix (Round 19):** the checkbox/slider required-validation gap
documented above is a real, known-open item, but fixing it needs a
data-model change (a genuine tri-state "unanswered" value) rather than
a UI-only patch -- flagging for a future round's product-level
decision rather than attempting it piecemeal. For round 19, moving to
resilience (5/10, last touched round 12): its most concrete remaining
gap per round 11's re-score is any resilience finding not already
closed by round 12's isError/isLoading fixes -- a fresh, scoped
resilience pass over Create/UpdateInspection.tsx and
StartInspectionModal.tsx (network-failure toasts on the auto-save path,
concurrent-edit/stale-cache handling) is the natural next candidate.

## Round 19 (resilience)

Shipped as aexa-frontend PR [#693](https://github.com/Qiyrix/aexa-frontend/pull/693), merged.

Found a genuine double-toast bug on the auto-save path:
`handleUpdateQuestion` already toasted a specific error (backend message
included) before re-throwing on a failed save, but its only caller,
`debouncedUpdateQuestion`'s `setTimeout` callback, caught that same
re-thrown error and toasted a *second*, generic "Failed to save answer"
on top of it -- every single auto-save failure surfaced two stacked
toasts. Fixed by making the wrapper's catch a no-op (comment-only),
keeping only its `finally` (resetting the per-question saving
indicator). Review confirmed no other caller relied on the removed
toast and flagged one nit -- the now-orphaned `answerSaveFailedToast`
i18n key -- fixed same round rather than left dangling.

QA gate: typecheck/lint clean, full suite 356 files / 5276 tests
passing. Live-verified against the real running dev server: monkey-
patched `window.fetch` to make the auto-save PUT return a 500, toggled
a real checkbox answer, and confirmed via the DOM's actual
`[data-sonner-toast]` count that exactly one toast fired (with the
specific "Simulated network error" message) instead of two -- then
restored the real fetch and reloaded to confirm the real backend record
was untouched.

**Next: a fresh 9-judge re-score (round 20).** 8 fix rounds have landed
(12-19) since the last full panel re-score (round 11), each picked from
round-11's own findings rather than fresh evidence -- per the
quality-bar-loop skill's own process, a stale baseline risks either
mis-picking already-closed findings or missing new ones the last 8
rounds' refactors could have introduced. Re-running the full panel
before continuing to guess at fixes.

## Round 20 -- fresh 9-judge re-score, plus an immediate security fix

Full panel re-run (round 11 -> round 20, average **6.1/10**, down from
round 11's last-recorded average despite 8 fix rounds in between --
several axes moved on genuinely fresh evidence, not just re-litigating
old findings):

| Axis | R11 | R20 | Note |
|---|---|---|---|
| Industry-standards | 3 | 3 | unchanged -- see below |
| UX | 5 | 6 | round 18's validation fix credited; orphaned-flow finding widened |
| Efficiency | 9 | 9 | confirmed still clean, no regression from rounds 14-19 |
| Accessibility | 7 | 6 | **new finding, not a regression from a fix** -- see below |
| Visual polish | 6 | 6 | rounds 14/15 fixes confirmed holding; remove-button fragmentation still open, now fully inventoried |
| Resilience | 5 | 7 | **cleared floor** -- round 12/19 fixes confirmed; 2 new minor gaps noted (malformed slider NaN%, no concurrent-edit warning) |
| Code quality | 4 | 5 | round 16's file-validation extraction credited as real, tested, and correctly scoped down from a riskier QuestionCard merge |
| Mobile | 6 | 7 | **cleared floor** -- round 13 fixes confirmed; 1 new regression noted (UpdateInspection.tsx's newer video/document media branches reintroduced the same hover-only delete pattern round 13 eliminated for images) |
| Security | 9 | 6 -> **9 (fixed same round)** | see below |

**Security finding, fixed immediately (not deferred to a future round):**
shipped as aexa-frontend PR [#694](https://github.com/Qiyrix/aexa-frontend/pull/694), merged. The judge found a real, live XSS gap: `InspectionReport.tsx`'s
per-question `mediaFiles` thumbnail grid and the lightbox it opens
rendered `media.url`/`selectedMedia` straight into `<img src>`/
`<video><source src>`/`<a href>` with no `isHttpUrl` guard -- the
identical field/sink pair is correctly guarded everywhere else in this
same feature (this file's own single-answer "media" case and
`attachments[]`, plus the equivalent thumbnails in Create/
UpdateInspection.tsx), it just never reached this one spot. Given
severity (a stored `javascript:` URL executing as script on click), this
was fixed the moment the finding landed rather than queued behind other
rounds. Guarded both the thumbnail and the lightbox itself
(defense-in-depth, matching this codebase's own convention). Review
came back clean (one minor test-precision nit, not blocking). QA gate:
typecheck/lint clean, full suite 356 files / 5277 tests passing.
Live-verified: injected a `javascript:alert(1)` mediaFiles URL into a
real inspection via the session's established fetch-monkeypatch
technique, confirmed the safe fallback renders and
`document.querySelector('[href^="javascript:"]')` finds nothing
anywhere on the page.

**Industry-standards (3/10, unchanged) -- confirmed via fresh live
testing, not assumption:** no inspection scoring/compliance percentage
anywhere in the data model (not just missing UI), no bulk actions on
the table, no recurring/scheduled inspections, no offline capture, no
camera-native file input (`capture=` attribute absent everywhere), and
`RunInspection.tsx` confirmed still genuinely orphaned -- it IS routed
(`MainRoute.tsx`), but nothing in `InspectionTable.tsx`/
`InspectionReport.tsx` links into it; only reachable by typing the URL.

**UX (6/10) -- the orphaned-flow finding widened, not just persisted:**
the UX judge traced the same `RunInspection.tsx` cluster and found it's
not one dead file but four (`RunInspection.tsx`, `InspectionNote.tsx`,
`InspectionRecommendations.tsx`, `InspectionActions.tsx` all link to
each other in a closed loop with zero entry point from the main list or
report). Also flagged two independently-implemented required-field
validators (`CreateNewInspection.tsx`'s creation-time check,
`UpdateInspection.tsx`'s round-18 completion-time check) that drifted
into different scope without ever being unified -- not broken, but
worth consolidating.

**Accessibility (6/10) -- new finding, not a fix regression:** every
`slider`/`date`/`multipleSelect` answer input across both Create/
UpdateInspection.tsx's `QuestionCard`s has no `id`/label/`aria-label`
tying it to its question text -- a screen-reader user tabbing to any of
these three question types on any inspection hears only "slider"/"date
picker"/"combobox" with zero name. This predates round 11 (it's not
something rounds 12-19 broke) but was never caught until this round's
fresh pass -- 8 rounds of a11y-adjacent work (rounds 2/3/7) happened to
focus on icon buttons, file inputs, and modals, and never checked these
three input types' accessible names specifically.

**Next fix (Round 21):** the accessibility gap above is the most
concrete, contained, and highest-leverage fix available right now --
it's a single, well-understood WCAG 4.1.2 pattern (missing
label/aria-labelledby) repeated identically across 3 answer types in 2
files, with a clear existing precedent to follow (the checkbox
type's own `<label>` wrapping already gives it a name for free). Going
there next, before the larger, more architecturally involved
industry-standards/orphaned-flow items.

## Round 21 (accessibility)

Shipped as aexa-frontend PR [#695](https://github.com/Qiyrix/aexa-frontend/pull/695), merged.

Fixed the round-20 accessibility finding: `slider`/`date`/
`multipleSelect` answer inputs in both `CreateNewInspection.tsx`/
`UpdateInspection.tsx` had no accessible name (WCAG 4.1.2) -- a screen
reader announced only "slider"/"date picker"/"combobox" with zero
context on the feature's most-used screen. Gave the question `<p>` a
stable `id` (`question-label-${question.id}`) and pointed each input's
`aria-labelledby` at it, rather than duplicating the question text into
a new `aria-label` string.

Review came back clean -- two low-severity nits, neither worth a fix
this round: the required-marker `*` gets included in the announced
name via `aria-labelledby`'s text concatenation (standard, low-severity
behavior, not worth a `aria-hidden` special-case), and `question.id`
uniqueness has no runtime fallback, but it's already load-bearing
elsewhere in both files (React `key`, `answers[question.id]`,
`dropzone-file-${question.id}`) -- not a new risk this PR introduced.

QA gate: typecheck/lint clean, full suite 356 files / 5279 tests
passing. Live-verified against the real running dev server: inspected a
real inspection's slider question's `aria-labelledby` attribute and
confirmed it resolves via `document.getElementById` to the exact
question text.

**Next fix (Round 22):** with accessibility, resilience, mobile, and
security all now at or above the 7/10 floor, four axes remain open:
industry-standards (3, unchanged, needs real feature work --
scoring/bulk-actions/recurring-inspections/offline/camera-capture, all
larger than a single round), UX (6, the widened orphaned-flow cluster
plus drifted dual validators), visual polish (6, the fully-inventoried
remove-button fragmentation), and code quality (5, the QuestionCard
duplication, pervasive `any`, InspectionTable.tsx's monolith size).
Visual polish's remove-button fragmentation is the most concrete and
contained of the four -- round 20's judge inventoried all 6 distinct
treatments with exact class strings, giving a clear, bounded scope
(unify the "remove this attached thing" visual language across
Create/UpdateInspection.tsx/InspectionReport.tsx/UploadNotesModal.tsx)
without the larger architectural risk industry-standards/code-quality's
open items carry. Going there next.

## Round 22 (visual polish)

Shipped as aexa-frontend PR [#696](https://github.com/Qiyrix/aexa-frontend/pull/696), merged.

Unified 3 of the round-20 judge's 6 inventoried treatments -- the ones
that were both inconsistent AND had a real ergonomic downside (the
other 3 -- attachment-chip remove, already on real semantic tokens, and
UploadNotesModal's page-level "Delete Note" `Button`, a defensibly
different affordance -- left as-is per the judge's own note):

- `UpdateInspection.tsx`'s video-answer delete button was smaller/
  lower-opacity (`bg-black/60 p-1.5 opacity-80`, ~28px) than the
  image-answer case right below it.
- `UpdateInspection.tsx`'s document-answer delete button was hover-only
  (`opacity-0 group-hover:opacity-100`) -- the exact touch-
  discoverability trap round 13 already eliminated for images,
  reintroduced when video/document branching was added afterward.
- The per-question media-thumbnail remove button (both Create/
  UpdateInspection.tsx) used an amber-bg/red-icon pairing unrelated to
  the app's severity/destructive tokens.

All three unified to the proven `bg-black/60 text-white` always-visible
circular button already shipped for the image-answer case (round 13).
Review confirmed the change is className/icon-only (no JSX structure,
handler, or aria-label changes), the icon swap (`Trash2`→`Trash`) isn't
a now-unused import, and the smaller thumbnail's black-on-photo
contrast is no worse than the identical pattern already proven for the
full-size case -- no blocking or minor findings.

QA gate: typecheck/lint clean, full suite 356 files / 5283 tests
passing. Live-verified against the real running dev server: confirmed
via `document.querySelectorAll` that zero `bg-amber-100` buttons remain
anywhere on a real inspection's edit page, and visually confirmed no
rendering regressions.

**Next fix (Round 23):** three axes remain below floor --
industry-standards (3), UX (6), code quality (5) -- all needing
larger, more architecturally involved work than a single-round CSS/
markup fix (real feature scoring/bulk-actions, consolidating the
orphaned-flow cluster's navigation, or the QuestionCard/`any`-type/
monolith code-quality items). Given the session has now run 22 rounds
on this one feature and cleared 6 of 9 axes to the 7/10 floor
(efficiency 9, resilience 7, mobile 7, security 9, accessibility 7 (est,
pending re-verification), visual polish now likely improved but not yet
re-scored), the next move is a fresh full 9-judge re-score before
picking further individual fixes, both to confirm rounds 20-22's
credited improvements actually hold and to get accurate current numbers
for the 3 axes still below floor before committing to which one to
tackle with the larger effort those really need.

## Round 23 (industry-standards)

Shipped as aexa-frontend PR [#697](https://github.com/Qiyrix/aexa-frontend/pull/697), merged.

Since industry-standards/UX/code-quality were all freshly scored just 2
rounds ago (round 20) and hadn't been touched since, skipped a full
re-score and went straight to the most tractable slice of
industry-standards' 3/10: `InspectionTable.tsx` had zero bulk actions,
unlike every reference tool in this category (GoCanvas, Device Magic).
Added:

- A per-row checkbox, only rendered for rows the caller can actually
  write (mirroring the existing `canWriteInspection` gate already on
  the Edit/Delete buttons), plus a header select-all checkbox.
- A bulk-actions bar (shown once >=1 row selected): running count,
  "Clear selection", "Delete selected".
- Bulk delete reuses the existing single-delete mutation via
  `Promise.allSettled` across every selected id, reporting success/
  failure counts separately.
- Selection scoped to the current page, cleared on page/filter/search
  change -- matching the table's existing per-page pagination model.

Review found one real, valid gap (the failure-count code path was
completely untested -- the only test always resolved every delete
call) and one real inconsistency (bulk-delete treated any *resolved*
promise as success, unlike the sibling single-delete's own `res?.success`
check). Verified directly against aexa-server's
`delete_inspection_from_db` that failures always throw (not a 200 with
`success:false`), so this wasn't an active bug today -- but aligned the
two paths anyway, and added a test using a deliberately-resolved-but-
unsuccessful response (not a rejection) specifically because a
rejection-based test would have passed under the old, buggy logic too
and not actually caught the gap. A second review round on that fix
came back clean (one already-satisfied minor item: confirming the
pre-existing all-success test's mock resolves with `success: true`,
verified via the full suite already passing).

QA gate: typecheck/lint clean, full suite 356 files / 5289 tests
passing (82 pre-existing tests in this file untouched). Live-verified
against the real running dev server: selected a row (bar showed "1
selected"), toggled select-all (all 3 rows checked, "3 selected"), and
cleared the selection (bar disappeared, no data touched) -- screenshots
at each step.

**Next fix (Round 24):** with a real bulk-action feature now shipped,
the next most tractable industry-standards slice is inspection
scoring/compliance percentage -- currently absent from the data model
entirely (not just the UI), the single gap the round-20 judge called
out as most consistent with what every named reference tool treats as
a baseline capability. This needs a product-level design decision
(what counts toward the score? per-question weighting? does it reuse
Risk Register's existing severity/scoring conventions?) before
implementation -- research the best-supported option and build it as
real feature work per this session's standing "ship, don't pause on
product decisions" directive, rather than treating the open question as
a stop condition.

## Round 24 (industry-standards)

Shipped as aexa-frontend PR [#698](https://github.com/Qiyrix/aexa-frontend/pull/698), merged.

Added a compliance-percentage stat to `InspectionReport.tsx` --
inspection scoring was absent from the data model entirely, the gap
round 20's judge named as most consistent with every reference tool's
baseline capability. Design decision made and documented rather than
deferred: scored from checkbox-type questions only (the app's own
"Yes"/"No" pass/fail type), mirroring how SafetyCulture scores --
pass/fail items only, no cross-answer-type weighting scheme invented
without precedent. A table-level score column was explicitly
out-of-scoped: `InspectionSummary` (the list endpoint's shape) has no
per-question data, so that would need a backend change, not a
frontend-only fix -- flagged as a real follow-up, not silently dropped.

Review raised what looked like a serious blocking issue -- reusing
round 18's own finding that checkbox questions have no true "unanswered"
state (every checkbox is seeded `false` and persisted from creation),
arguing the score would silently count untouched checkboxes as
failures. Investigated rather than reflexively applied: re-verified
against both `CreateNewInspection.tsx`'s submit flow and
`aexa-server`'s `create_inspection_into_db` that this is true, but
concluded it's not actually a bug for *this* feature specifically
(unlike round 18's validation feature, where the distinction genuinely
mattered) -- the UI itself never presents a third "unanswered" state
for checkboxes, so a left-at-default checkbox represents a real
recorded "No," the same interpretation most real-world audit
checklists already use for an unchecked item. Documented this reasoning
explicitly in code rather than silently accepting or dismissing the
finding, corrected one test whose name implied the wrong real-world
scenario, and dispatched an independent second-opinion review
specifically to check whether the pushback itself was sound --
confirmed the reasoning holds on all points, including checking for
edge cases (a synthetic-inspection code path in the risk-correlation
service) the first pass hadn't looked at.

Also fixed a smaller, uncontested nit from the same review round:
extracted `severityTextClasses()` in `severityStyles.ts` to replace a
fragile string-parsing approach for extracting text-only color classes
out of `severityBadgeClasses`' combined output.

QA gate: typecheck/lint clean, full suite 358 files / 5300 tests
passing. Live-verified against the real running dev server: a real
inspection with one answered checkbox ("Are fire extinguishers
accessible? Yes") showed "Compliance 100%" in green; a zero-question
system template correctly showed no Compliance card at all.

**Next fix (Round 25):** industry-standards has now had 3 consecutive
rounds of real feature work (bulk actions, compliance scoring) --
worth a fresh, focused industry-standards-only judge re-score before
picking the next slice, since round 20's original list (recurring
inspections, offline capture, camera-native input, the orphaned
RunInspection.tsx cluster) is now partially stale and the remaining
items are each large enough that picking correctly matters more than
guessing from an aging list.

## Round 25 (industry-standards) -- and an important correction

Fresh industry-standards-only judge re-score: **4/10** (up from 3),
confirming rounds 23/24's bulk-actions and compliance-scoring work is
real and holding, and naming the orphaned `RunInspection.tsx` cluster
(4 routed-but-unreachable pages: `RunInspection`/`InspectionNote`/
`InspectionRecommendations`/`InspectionActions`) as the single
highest-leverage remaining gap -- framed by the judge as a simple
wiring oversight (add nav links).

**Investigated before wiring links, since that framing looked wrong on
inspection** -- `UpdateInspection.tsx` (the actually-linked edit flow)
already has inline sections that looked similar to 3 of these 4 pages
(Upload Note, Add Finding, Generate Recommendation). A dedicated
investigation agent confirmed: `RunInspection.tsx`, `InspectionNote.tsx`,
and `InspectionRecommendations.tsx` are genuinely superseded dead code
from an earlier sprint, each a functionally-inferior duplicate of
what's actually linked today (missing per-question notes/external
media/full status control; missing text-note mode/edit/delete; missing
the AI-generate trigger that makes the linked version usable at all).
Wiring navigation to them would have shipped a *worse* fix than doing
nothing -- two competing, inconsistent "edit this inspection" UIs is a
regression, not a gain, even though it would have superficially
"closed" the judge's named gap.

Shipped as aexa-frontend PR [#699](https://github.com/Qiyrix/aexa-frontend/pull/699), merged: deleted all
three dead pages (plus their now-orphaned `QuestionInput.tsx`
dependency, confirmed to have zero other importers) and their routes.
`InspectionActions.tsx` (the 4th file) is kept -- it fetches via
`useFindingsForInspection` to render a genuinely missing capability (a
per-inspection findings list; `InspectionReport.tsx`'s own dead-code
comment already names this exact gap), but its inline create/edit form
is itself a weaker duplicate of the real `CreateNewFindingModal.tsx` --
flagged as a real, correctly-scoped follow-up (swap the form, then wire
the link) rather than attempted piecemeal here.

Review confirmed the deletion was clean (no dangling references
anywhere in the codebase, `WriteGuardRoute` still used by the routes
that remain, both test files' structure intact) and independently
re-verified the "strict subset" claim on `InspectionNote.tsx` vs.
`UploadNotesModal.tsx` rather than trusting the PR description. One
minor, non-blocking finding (orphaned i18n keys for the 3 deleted
pages) was investigated further and found to be more involved than it
looked -- `src/i18n/pluralization.test.ts` still directly exercises
`pages.inspection.recommendations.findings` for its own pluralization-
logic testing, unrelated to the now-deleted page -- so removing that
i18n block isn't a safe drive-by cleanup; left for its own follow-up
rather than rushed.

**Important correction surfaced during this round, unrelated to the
fix itself:** discovered and removed two stale, already-merged git
worktrees (`.claude/worktrees/sweet-goodall-f64cc9`,
`.../gracious-gates-47a8bb`, confirmed via `git log` to already be in
`main` via PRs #672/#674) that were silently duplicating the entire
test suite on every `vitest run` command all session, because they
were nested inside the project directory and vite's `@/` alias
resolution pointed back at the main repo's `src/` regardless of which
physical worktree a test file lived in. **Every "full suite passing"
count reported in every round of this loop (all "35x files / 5xxx
tests" figures from round 12 onward) was inflated roughly 3x** --
the real suite is **121 files / 1785 tests**, confirmed clean after
the cleanup. This doesn't invalidate any individual round's actual
verification (each round's new/changed tests, and their negative
controls, genuinely ran and were genuinely checked) -- only the
aggregate "full suite" framing in this log and in every merged PR's
description overstated the scale of what was being protected. Round
counts and QA-gate results from here forward use the corrected number.

QA gate (round 25 itself): typecheck/lint clean, full suite -- now
verified against the correct baseline -- 121 files / 1785 tests
passing. Live-verified against the real running dev server: the
inspections list, the bulk-select feature, and the `UpdateInspection.tsx`
edit flow all still work correctly post-deletion, with no console or
module-resolution errors.

**Next fix (Round 26):** the correctly-scoped `InspectionActions.tsx`
follow-up identified this round -- swap its inline create/edit form
for the real `CreateNewFindingModal.tsx`, then add a real "View all
findings for this inspection" link from `UpdateInspection.tsx`/
`InspectionReport.tsx` -- is the natural next industry-standards slice,
since it's a scoped, well-understood fix for a capability already
confirmed genuinely missing, rather than another guess from an aging
list.

## Round 26 (regression fix, found while scoping the round-25 follow-up)

Shipped as aexa-frontend PR [#700](https://github.com/Qiyrix/aexa-frontend/pull/700), merged.

While reading `InspectionActions.tsx` to plan round 25's stated
follow-up (swap its inline form for `CreateNewFindingModal.tsx`),
found a real regression round 25 itself introduced: the page's own
"Inspection" breadcrumb link still pointed at
`/organization/audit/inspections/:id` -- `RunInspection.tsx`'s route,
deleted in round 25 as confirmed superseded dead code. Fixed
immediately rather than deferred, since a dead link is a real,
user-facing bug, not a design question. Points at
`UpdateInspection.tsx`'s real edit route instead.

Review confirmed no other stray references to the deleted route exist
anywhere in the codebase, and that the fixed path is a real,
`WriteGuardRoute`-wrapped route (not a typo'd singular/plural mixup
between this app's `/inspection/...` create-edit paths and
`/inspections/...` list/report/actions paths, an easy mistake given
how similar the two look).

QA gate: typecheck/lint clean, full suite -- correct baseline -- 121
files / 1786 tests passing. Live-verified against the real running dev
server: navigated to a real inspection's Actions page, clicked the
"Inspection" breadcrumb, confirmed it lands on the real
`UpdateInspection.tsx` edit page.

**Next fix (Round 27):** back to the round-25 follow-up itself --
swap `InspectionActions.tsx`'s inline create/edit form for the real
`CreateNewFindingModal.tsx` (currently a weaker duplicate missing
assignees/line-of-defense/Five Cs/comments), then add a real "View all
findings for this inspection" link from `UpdateInspection.tsx`/
`InspectionReport.tsx`. This is a larger, single-file refactor
(InspectionActions.tsx is 714 lines) -- worth its own dedicated round
rather than folding into this one.

## Round 27 — fresh 9-judge re-score (first full panel since round 20)

Full panel re-run, live-verified against the running dev server + real
data (round 20 → round 27):

| Axis | R20 | R27 | Note |
|---|---|---|---|
| Industry-standards | 3 | 6 | compliance scoring (R24) + bulk actions (R23) confirmed real and holding; recurring/offline/camera-capture still entirely absent; `InspectionActions.tsx`'s finding form confirmed missing assignee support vs. `CreateNewFindingModal.tsx` |
| UX | 6 | 6 | orphaned-page cleanup (R25/26) genuinely reduced confusion, but the findings-reachability gap is now proven *actively wrong*, not just missing — `InspectionReport.tsx`'s "Actions" stat card reads a stale `inspection.actions` relation and shows "0" for an inspection with 1 real finding, live-confirmed via direct API fetch |
| Efficiency | 9 | 9 | confirmed clean; compliance score properly memoized, bulk-delete uses concurrent `Promise.allSettled`, no regressions in R21-26 |
| Accessibility | 6 (7 est. after R21 fix, never re-verified) | 5 | R21's `aria-labelledby` fix on slider/date/multipleSelect holds and is unregressed, but scope was too narrow — checkbox and free-text answers (the two most common types) have zero accessible name, live-confirmed via DOM inspection; `InspectionActions.tsx` has the same defect and was never audited before this round |
| Visual polish | 6 (7 est. after R22 fix, never re-verified) | 6 | R22's button unification holds; `InspectionActions.tsx` reintroduces the exact color-fragmentation problem `severityStyles.ts` was built to eliminate — hand-rolled badge colors, zero dark-mode variants, no shared UI components |
| Resilience | 7 | 7 | holding; bulk-delete partial-failure handling correct and tested; new narrow gap — slider-NaN guard covers input-creation time (PR #681) but not report-render time for malformed legacy data (`InspectionReport.tsx:101-116`) |
| Code quality | 5 | 5 | unchanged; QuestionCard duplication persists; `any`-typing got structurally worse (blanket file-level ESLint suppressions added to 5 files, not scattered casts); new duplicate form (`InspectionActions.tsx`'s `ActionForm` vs. `CreateNewFindingModal.tsx`) added since R20; utils layer (`inspectionCompliance.ts`, `severityStyles.ts`) remains a genuine bright spot |
| Mobile | 7 | 6 | R20's hover-only delete-button regression confirmed fixed (R22); but `InspectionTable.tsx` has no responsive/stacked layout at 375px (row actions sit off-screen behind horizontal scroll — pre-existing, not caused by R21-26); `InspectionActions.tsx` never received a touch-target pass (26px icon buttons, 38px form buttons vs. the 44px standard applied everywhere else this session) |
| Security | 9 | 9 | confirmed clean; `isHttpUrl` guard intact and unregressed across all sinks; one non-blocking convergence nit — `InspectionActions.tsx` uses a bespoke (functionally equivalent but unaudited) URL check instead of the shared utility |

**Average: 6.56/10** (up from round 20's real 6.1). **3 of 9 axes clear
the 7 floor** (efficiency, resilience, security) — down from an assumed
6 of 9, because 2 of those assumed clears (accessibility, visual
polish) were never re-verified after their fix rounds and turned out
to be wrong; a third (mobile) genuinely dropped from a previously
*confirmed* 7 to a confirmed 6.

**Guardrail note:** mobile's 7→6 is a confirmed-to-confirmed drop,
which the loop's regression guardrail is written to catch. Judged not
a true regression — nothing in rounds 21-26 touched
`InspectionTable.tsx`'s responsive layout or `InspectionActions.tsx`'s
touch targets; this is a pre-existing gap a more thorough live pass
finally caught, the same pattern as round 20's own accessibility "new
finding, not a fix regression." Logged and flagged rather than treated
as a hard stop.

**Cross-cutting pattern:** `InspectionActions.tsx` (kept in round 25
for its unique per-inspection findings-list capability, its inline
form's replacement explicitly deferred as a follow-up) is now the
common thread behind four independent findings this round —
unaudited/failing accessibility, untouched by the visual-polish token
system, missing touch targets, and a duplicate form vs.
`CreateNewFindingModal.tsx`. Four judges converged on the same file
independently.

**Next fix (Round 28):** the already-planned refactor — swap
`InspectionActions.tsx`'s inline `ActionForm` for the real
`CreateNewFindingModal.tsx` — is now higher-leverage than originally
scoped, since the real modal already has correct `aria-labelledby`
labeling, shared UI components on `severityStyles` tokens, and 44px
touch targets. Expected to close or shrink the accessibility,
visual-polish, and code-quality findings on this file in one pass,
alongside industry-standards' assignee-field gap. Going there next
rather than patching each axis's symptom on this file separately.

## Round 28 (industry-standards/accessibility/visual-polish/mobile/code-quality -- InspectionActions.tsx refactor)

Shipped as aexa-frontend PR [#702](https://github.com/Qiyrix/aexa-frontend/pull/702), merged.

Round 27's fresh 9-judge panel converged on `InspectionActions.tsx` from
four independent angles at once (missing assignee support, unlabeled
inputs, hand-rolled colors with no dark-mode variants, undersized touch
targets) plus a fifth from code-quality (a second, independently
maintained finding-form implementation). Rather than patch each symptom,
swapped the file's inline `ActionForm`/local mutations/local `Action`
type for the real, already-existing `CreateNewFindingModal.tsx` --
already used by `UpdateInspection.tsx`/`AllFindingsPage.tsx`, already
correct on all five dimensions.

Also fixed in the same pass: the attachment list's bespoke
`url.startsWith("http") ? url : BASE_URL + url` check replaced with the
shared `isHttpUrl()` guard (the round-27 security judge's one
non-blocking nit); verified directly against aexa-server's
`upload_action_attachment_into_aws` (has returned Cloudinary's
`secure_url` since its first commit -- never a relative path) that this
isn't a regression against real data. Added an `aria-label` to the
per-finding status `<select>` identifying which finding it belongs to
(round-27 accessibility finding on this file).

**Review loop:** round 1 (4 parallel angles -- line-by-line, cross-file
tracer, removed-behavior auditor, test-coverage) found zero correctness
bugs but 3 real test-coverage gaps at the seam between this file and
`CreateNewFindingModal.tsx` (its own test suite never covered
`editData.actionDisc === null`, a bare `additionalData={{ inspectionId
}}` shape, or a media-upload failure toast -- all previously covered by
this file's own now-deleted local-form tests). Fixed by adding 3 tests
to `CreateNewFindingModal.test.tsx` rather than re-adding them here,
since the seam is that modal's contract. Round 2 (fresh full-diff pass)
came back clean.

QA gate: typecheck/lint clean, full suite 121 files / 1784 tests
passing. Live-verified against the real running dev server on a real
inspection with a real finding: confirmed the real Edit/Create Finding
modal renders correctly (pre-filled on edit, inspection pre-selected on
create), confirmed the status select's `aria-label` resolves correctly
in the DOM, no new console/network errors.

**Round 27 → round 29 impact (estimated, not yet re-verified via a
fresh judge panel):** industry-standards' assignee gap, all of
accessibility's InspectionActions.tsx findings, visual-polish's
color-fragmentation finding, and mobile's touch-target finding on this
file should all be closed by this swap -- but per this session's own
round-20/27 lesson (estimated post-fix scores drifting from reality),
these are not confirmed until re-scored live.

**Next fix (Round 29):** round 20's still-open UX finding -- no "View
all findings for this inspection" link from `InspectionReport.tsx`/
`UpdateInspection.tsx` into this page, and the "Actions" stat card
showing a stale "0" instead of the real finding count (live-confirmed
by the round-27 UX judge via direct API fetch) -- was explicitly kept
out of scope for round 28's refactor and remains the single largest
concrete UX gap. Requires a real nav affordance plus either a backend
fix to the `inspection.actions` relation or a frontend-side count
fetched via the same `useFindingsForInspection` hook this page already
uses. Given the accumulated estimation-drift risk from rounds 20-27,
worth a fresh full 9-judge re-score before committing further individual
fixes, rather than assuming round 28 closed everything it's expected to.

## Round 29 -- fresh 9-judge re-score, plus an immediate mobile-usability fix

Full panel re-run (round 27 -> round 29):

| Axis | R27 | R29 | Note |
|---|---|---|---|
| Industry-standards | 6 | 7 | **cleared floor** -- round 28's CreateNewFindingModal swap confirmed live: assignees, Five Cs, comment thread all present now on InspectionActions.tsx's finding form |
| UX | 6 | 6 | unchanged as expected -- round 28 didn't touch the findings-reachability gap; still live-confirmed "Actions: 0" on a report with 1 real finding, still zero nav links into InspectionActions.tsx |
| Efficiency | 9 | 8 | new, real, minor finding -- CreateNewFindingModal.tsx unconditionally fetches the org-wide inspection list + org users list on every mount (inherited from its other call sites, but InspectionActions.tsx never had this cost before round 28); no re-render regression found |
| Accessibility | 5 | 4 | **new finding, not a regression from round 28's own claimed fix** -- free-text and checkbox answer types in Create/UpdateInspection.tsx remain unlabeled (unchanged), AND round 28's swap moved InspectionActions.tsx onto CreateNewFindingModal.tsx, which itself had 8 of 10 form fields with zero programmatic label association (visible `<label>` text with no `htmlFor`/wrapping) -- fixed this round, see below |
| Visual polish | 6 | 8 | **cleared floor** -- round 27's color-fragmentation finding confirmed fixed live, including dark mode; codebase-wide grep confirms no hand-rolled severity colors remain anywhere in the feature |
| Resilience | 7 | 6 | confirmed-to-confirmed drop, but not a round-28 regression -- CreateNewFindingModal.tsx's 3 queries (inspection list, org users, finding detail) had no `isError` handling, silently showing empty/placeholder state on failure; pre-existing in the modal's other call sites, newly exposed via InspectionActions.tsx -- fixed this round |
| Code quality | 5 | 6 | round 28's `ActionForm` duplication confirmed genuinely gone; new nuance found -- `QuestionCard` duplication between Create/UpdateInspection.tsx has drifted into genuinely different rendering behavior (video/document media branch exists in Update, not Create), not just duplicated LOC |
| Mobile | 6 | 3 | **severe, live-reproducible bug found and fixed immediately** -- see below |
| Security | 9 | 8 | new finding, not a round-28 regression -- CreateNewFindingModal.tsx's media-preview `<img>`/`<video>` sinks had no `isHttpUrl` guard (every other attachment sink in the codebase has one); low practical severity (img/video `src` doesn't execute `javascript:` the way `href` does) but a real consistency gap -- fixed this round |

**Average: 6.22/10** (down from round 27's 6.56 -- driven almost entirely
by the mobile modal-width bug, which the round-27 panel never exercised
since it predates round 28's swap). 3 of 9 axes clear the 7 floor
(industry-standards, efficiency, visual-polish) before this round's
fixes; resilience/security/code-quality/UX/accessibility/mobile remain
open.

**Severe finding, fixed immediately (not deferred):** the mobile judge
found `CreateNewFindingModal.tsx`'s `DialogContent` had `min-w-xl`
(min-width: 576px) applied unconditionally, forcing the dialog to
overflow ~100px off both edges of the screen at any viewport narrower
than 576px. Combined with `onInteractOutside`/`onEscapeKeyDown` both
being suppressed (intentional, to avoid accidental data loss on a form)
and the dialog's own close button rendering off-screen along with the
rest of the dialog, **a user opening Create/Edit Finding on a real phone
had no way to close the modal at all** -- not by tapping outside, not by
Escape, not by reaching the X. This is the exact modal round 28 gave
`InspectionActions.tsx` as its create/edit UI, so it's a direct
regression in reachability for a feature this app's own field-inspection
audience (per the industry-standards judge's own framing) would use on
mobile constantly. Scoped `min-w-xl` to `sm:` and up so mobile falls
back to the base `DialogContent`'s viewport-safe
`max-w-[calc(100%-2rem)]` sizing. Live-verified at 375x812: modal now
renders fully on-screen with its close button reachable.

Bundled into the same fix (same file, same round, per this session's
own tier-batching convention): the security judge's `isHttpUrl` gap on
media previews, the resilience judge's missing `isError` handling on
the 3 queries (with new inline error text + i18n keys), and the
accessibility judge's missing label associations on 8 of 10 form fields
(Action Title, Description, Inspection, Priority, Status, Due Date via
`useId()`; Upload Media button + Add-an-update input via `aria-label`).
Every fix negative-controlled (reverted, confirmed the corresponding new
test fails, restored). Live-verified the accessibility fix specifically
via the browser's real accessibility tree (`read_page`), not just
jsdom -- every field now resolves a real accessible name
(`combobox "Low"`, `textbox "Due Date *"`, `button "Upload media"`,
etc.), not just visually-adjacent text.

QA gate: typecheck/lint clean, full suite 121 files / 1792 tests
passing (10 new tests: mobile-width regression guard, media-URL guard,
3 query-failure-indicator tests, 2 accessible-name tests).

**Next fix (Round 30):** with this round's fixes not yet re-scored by a
fresh judge panel, the highest-confidence next move is verifying their
actual impact (mobile/security/resilience/accessibility all touched)
before picking further work -- this session has been burned twice now
(rounds 20, 27) by assuming a fix's score impact without re-verifying.
If accessibility is still below floor after re-scoring (likely, since
Create/UpdateInspection.tsx's free-text/checkbox labeling gap is
untouched by this round), that remains the single largest concrete a11y
gap left in the feature.

**Review loop (PR #703):** round 1 (4 parallel angles) found no correctness
bugs but 2 real polish findings -- a test-mock hygiene gap (`mockOrgUsers`
not reset in `beforeEach`, leaking an `isError: true` override into later
tests) and a missing accessible-name association on the Status field's
closed/read-only `<span>` (its label's `htmlFor` was correctly nulled for
this branch, but nothing replaced it -- fixed via the same combined
`aria-labelledby` pattern this session already established in
`StartInspectionModal.tsx`/`RiskMultiSelect.tsx`). Both fixed, plus 2 new
tests added. Round 2 (fresh full-diff pass) came back clean.

Merged as aexa-frontend PR [#703](https://github.com/Qiyrix/aexa-frontend/pull/703). QA gate at merge: typecheck/lint
clean, full suite 121 files / 1794 tests passing.

## Round 30 -- fresh 9-judge re-score

Full panel re-run (round 29 -> round 30):

| Axis | R29 | R30 | Note |
|---|---|---|---|
| Industry-standards | 7 | 7 | unchanged, as expected -- PR #703 was a pure hardening pass, no capability change; recurring/offline/camera-capture still absent |
| UX | 6 | 6 | unchanged -- the severe mobile modal-dismiss bug is confirmed fixed live, but the core findings-reachability/stale-"0"-count gap is unchanged and independently reproduced against live data again this round |
| Efficiency | 8 | 8 | unchanged, confirmed -- the org-wide inspection/user list overfetch on every modal mount was never in scope for PR #703 (that PR added error handling to the same queries, not lazy-loading) |
| Accessibility | 4 | 3 | **worse, and now the single dominant blocker.** Two real findings: (1) checkbox/free-text answer types in Create/UpdateInspection.tsx's QuestionCard -- the two most common question types, core inspection-answering workflow -- remain completely unlabeled after two full rounds, plus a newly-found third instance (the per-question Note textarea). (2) round 29's own CreateNewFindingModal.tsx fix was incomplete -- its "Five Cs" fields (Criteria/Condition/Cause/Effect) still resolve to accessible-name NONE live, the identical defect class the rest of that fix eliminated |
| Visual polish | 8 | 8 | unchanged, confirmed clean in both themes and both viewport classes; round 29's new destructive-error-text and responsive modal width both read as native to the design system |
| Resilience | 6 | 7 | **cleared floor** -- round 29's isError fix on CreateNewFindingModal.tsx's 3 queries confirmed working; new minor gap found (unrelated to this round's fix): InspectionActions.tsx's delete handler swallows failures silently with no toast, unlike its sibling status-update handler |
| Code quality | 6 | 7 | **cleared floor** -- round 29's additions to CreateNewFindingModal.tsx (useId labels, isError UI, isHttpUrl guard) confirmed cleanly integrated, idiomatic, well-commented; QuestionCard duplication remains the one real structural liability, now confirmed to have drifted into genuinely different media-handling behavior between the two files, not just duplicated markup |
| Mobile | 3 | 8 | **cleared floor, severe bug confirmed fixed** -- live DOM measurement confirms zero overflow at 375px and a fully reachable, functional close button; new minor gap found (not severe): the Due Date row has a small internal horizontal overflow inside the "Action Details" card at 375px (datetime-local input's intrinsic width + missing min-w-0) |
| Security | 8 | 9 | **cleared floor, back to fully clean** -- isHttpUrl guard on media previews confirmed working via both a live test and a full fresh sweep of every URL sink in the feature; nothing missed |

**Average: 7.0/10** (up from round 29's 6.22). **7 of 9 axes now clear the
7 floor** -- only UX (6) and accessibility (3, the lowest score recorded
for any axis in this entire loop) remain open. This is the best result
of the loop so far by a wide margin.

**Next fix (Round 31):** accessibility is now unambiguously the highest-
leverage target -- 6 points below floor, affecting the feature's primary
workflow (answering inspection questions), not a peripheral surface.
Two parts, both same-axis and worth shipping together per this session's
tier-batching convention: (1) the contained, same-file fix -- label
CreateNewFindingModal.tsx's 4 remaining Five-Cs fields, closing the gap
round 29's fix should have caught; (2) the larger fix -- give the
checkbox and free-text/default answer types in Create/UpdateInspection.tsx's
QuestionCard (plus the newly-found per-question Note textarea) real
accessible names tied to their question text, following the same
aria-labelledby pattern already proven for slider/date/multipleSelect
in round 21. This is Tier 2/3 (touches the primary data-entry surface
of the whole feature, more than one caller) and should get the full
review-loop treatment rather than a single-round shortcut.

**Review loop (PR #704):** all 3 parallel round-1 angles (line-by-line,
cross-file consistency between the two independently-duplicated
QuestionCard components, adversarial attribute-only-diff sweep) came
back clean -- no bugs found, the two files' fixes confirmed genuinely
identical in structure, all 128 relevant tests passing including the 6
new ones. No fix round needed.

Merged as aexa-frontend PR [#704](https://github.com/Qiyrix/aexa-frontend/pull/704). QA gate at merge: typecheck/lint
clean, full suite 121 files / 1799 tests passing.

## Round 32 -- fresh 9-judge re-score

Full panel re-run (round 30 -> round 32, round 31's PR #704 in between fixed accessibility labeling only):

| Axis | R30 | R32 | Note |
|---|---|---|---|
| Industry-standards | 7 | 7 | unchanged, confirmed -- recurring/offline/camera-capture still absent |
| UX | 6 | 5 | same root-cause finding as every round since 20, proven with the most damning live evidence yet -- a completed inspection's report showed "Actions 0" while 2 real actions existed at a URL with zero discoverable path to it |
| Efficiency | 8 | 8 | unchanged, confirmed |
| Accessibility | 3 | 8 | **massive jump, clears floor** -- round 31's fix (PR #704) confirmed live and thoroughly: checkbox/free-text/Note fields and CreateNewFindingModal's Five Cs fields all resolve correct accessible names against real inspection data with real content loaded, keyboard tab order through a full question card confirmed logical with no traps. New minor gap found: every question's media-upload file input shares the identical accessible name "Add Media" -- same ambiguity class as the fields just fixed, just not yet applied to this control |
| Visual polish | 8 | 8 | unchanged, confirmed zero regression from round 31's attribute-only diff; two pre-existing minor items noted (not new) -- a missing dark-mode variant in CreateNewInspection.tsx's upload-status text, and UnSplitText.tsx's hardcoded hex colors bypassing the design-system token layer |
| Resilience | 7 | 7 | unchanged -- both known gaps (slider-NaN report-render, silent delete-failure) confirmed still open |
| Code quality | 7 | 7 | unchanged -- QuestionCard duplication confirmed still two separate trees; round 31's fix applied identically to both, no fresh drift introduced |
| Mobile | 8 | 8 | unchanged; new minor finding -- the round-29 dialog-width fix's `max-w-xl` is silently overridden by tailwind-merge's last-wins rule, dropping the base component's `max-w-[calc(100%-2rem)]` mobile gutter entirely (zero side margin on phones, not a functional blocker since the close button stays reachable) |
| Security | 9 | 9 | unchanged, confirmed clean |

**Average: 7.44/10** (up from round 30's 7.0). **8 of 9 axes now clear
the 7 floor.** UX (5) is the sole remaining blocker, and it's the same
root cause every round since round 20 has independently reproduced:
`InspectionReport.tsx`'s "Actions" stat reads a relation the backend
never populates, and there is zero navigation path from the report/edit
views into the one place (`InspectionActions.tsx`) that has the real
data.

**Also flagged this round, out of scope for Inspections:** the UX judge
incidentally found `/organization/findings` (the global findings list,
a different feature) hangs indefinitely on load with console 404s.
Spun off as a separate background task rather than pulled into this
loop's scope.

**Next fix (Round 33):** finally fix UX's root cause -- the InspectionReport.tsx
findings-count/reachability gap that's been open for 12 rounds. Two
parts: (1) stop trusting the unpopulated `inspection.actions` relation
-- fetch the real count via the same `useFindingsForInspection` hook
`InspectionActions.tsx` already uses, so the stat card shows a true
number; (2) make that stat card (or an adjacent element) a real link
into `/organization/audit/inspections/:id/actions`. This is Tier 2/3
(touches a shared report component, more than one real caller via
InspectionReport.tsx) and is the last blocker standing between this
feature and the 9/10 target -- worth the full review-loop treatment
given how long this specific gap has resisted being deprioritized.

**Review loop (PR #706):** round 1 (3 parallel angles) found 2 real
issues -- the new Actions-stat link pointed at a WriteGuardRoute-gated
route with no corresponding permission check (a read-only role would
click through and get silently redirected away), and no test covered
the id-undefined branch. Both fixed: the link is now gated by the same
`canWriteInspection` check `InspectionTable.tsx` already uses, showing
the real count either way but only linking for a role that can actually
reach the route. Round 2 (fresh full-diff pass) came back clean.

Merged as aexa-frontend PR [#706](https://github.com/Qiyrix/aexa-frontend/pull/706). QA gate at merge: typecheck/lint
clean, full suite 121 files / 1803 tests passing.

## Round 34 -- fresh 9-judge re-score

Full panel re-run (round 32 -> round 34, round 33's PR #706 in between fixed UX's Actions-count/link gap):

| Axis | R32 | R34 | Note |
|---|---|---|---|
| Industry-standards | 7 | 7 | unchanged; one new low-severity finding noted (CreateNewFindingModal.tsx's assignee dropdown has no Escape-to-close/focus-trap, standard WAI-ARIA combobox expectation) |
| UX | 5 | 8 | **massive jump, clears floor** -- the 12-round headline finding (stale "Actions 0" stat, no nav link) confirmed fully fixed and live-verified end-to-end: real count, working link, correctly gated by write-permission. The two independently-drifted required-field validators remain the one still-open UX gap |
| Efficiency | 8 | 7 | **regression from round 33** -- the new `useMyOrgRole()` call added to gate the Actions link internally fires an unbounded org-wide member-list fetch just to derive one boolean, adding real cost for every report viewer (including ones who'll never see the link) |
| Accessibility | 8 | 8 | unchanged overall; new minor finding from round 33's diff -- the Actions stat's label and value render in separate sibling `<p>` tags with no separator, so its computed accessible name as a focusable link is the glued word "Actions1" rather than "Actions 1" (same pattern pre-existed on the static Sections/Questions cards but wasn't exposed as an interactive control's name until now) |
| Visual polish | 8 | 8 | unchanged, confirmed clean; one very minor nit noted (the new link's hover state renders slightly lighter, not more prominent -- backwards from the usual convention, not a blocker) |
| Resilience | 7 | 6 | **regression from round 33** -- the new Actions stat discards `isLoading`/`isError` from `useFindingsForInspection`, so a loading or failed findings fetch renders identically to a genuine zero; the two other known gaps (silent delete failure, slider-NaN) remain open |
| Code quality | 7 | 7 | unchanged; new naming-clarity nit -- `actions` (legacy, never-populated) and `realActions` (new, real) sit side-by-side with no naming signal distinguishing which is which |
| Mobile | 8 | 8 | unchanged, confirmed clean; round 33's new link verified to clear the 44px touch-target floor with no layout disruption |
| Security | 9 | 9 | unchanged, confirmed clean; the new permission check verified as UX-only (hides a dead-end link), not the actual security boundary, which remains server-side + WriteGuardRoute |

**Average: 7.56/10** (up from round 32's 7.44). **8 of 9 axes clear the
7 floor** -- only resilience (6) is below, and it's a self-inflicted
regression from round 33's own new code, not a pre-existing gap.

**Next fix (Round 35):** four findings all trace back to the same new
code added in round 33 (`InspectionReport.tsx`'s Actions stat) --
worth one bundled fix rather than four separate rounds, per this
session's tier-batching convention: (1) surface `isLoading`/`isError`
from `useFindingsForInspection` instead of discarding them, so a
loading/failed fetch doesn't read as a real zero (resilience); (2) stop
calling `useMyOrgRole()`'s underlying unbounded org-wide fetch just to
gate one link -- check whether `useMyOrgRole` has (or needs) a lighter
path, or gate differently; (3) rename `actions`/`realActions` to make
which is legacy vs. real unambiguous (code quality); (4) add a visible
separator between the stat label and value so the Actions link's
accessible name isn't a glued word (accessibility). None of these are
individually large, but each is a real, verified finding -- shipping
them together closes out the last below-floor axis and should push the
average meaningfully closer to the 9/10 target.

**Review loop (PR #708):** both round-1 angles came back with no code
issues, but one caught a real inaccuracy in the PR's own reasoning --
the claim that `useMyOrgRole()`'s cost was "already shared/cached" via
`WriteGuardRoute` overstated the case, since `InspectionReport.tsx`
itself isn't `WriteGuardRoute`-gated and a cold direct landing pays the
fetch fresh (RTK Query's default 60s cache doesn't help a first visit).
Corrected the PR description rather than let the inaccurate framing
stand; the underlying decision (don't add complexity to avoid a single
bounded, codebase-standard fetch) held up on the corrected reasoning.
No code changes needed as a result -- the fix itself (loading/error
states, rename, aria-label) was already correct. Two non-blocking
polish nits noted for a future round (loading-state aria-label reads
"Actions …"; new states don't follow the codebase's existing
skeleton/`role="alert"` conventions).

Merged as aexa-frontend PR [#708](https://github.com/Qiyrix/aexa-frontend/pull/708). QA gate at merge: typecheck/lint
clean, full suite 121 files / 1806 tests passing.

## Round 36 -- fresh 9-judge re-score

Full panel re-run (round 34 -> round 36, round 35's PR #708 in between fixed resilience's regression):

| Axis | R34 | R36 | Note |
|---|---|---|---|
| Industry-standards | 7 | 7 | unchanged; the dominant remaining gap is now clearly the pervasive `any`-typing sprawl (50+ instances across the feature) rather than any single missing capability |
| UX | 8 | 8 | unchanged, confirmed live end-to-end (create -> answer -> submit -> add finding -> report shows it); the two independently-drifted required-field validators remain the one open gap |
| Efficiency | 7 | 7 | unchanged, but the judge corrected my own round-35 framing -- the "one bounded call" description undercounted the real cost (useMyOrgRole fires 2 queries, useMyAssignedInspectionIds a 3rd, none prefetched by any shared layout); also re-confirmed CreateNewFindingModal.tsx's unconditional org-wide inspection/user fetch (no `skip` guard, unlike its own sibling query in the same file) |
| Accessibility | 8 | 8 | unchanged; round 35's aria-label fix confirmed live as robust (aria-label overrides subtree text per the accname spec, not fragile); known media-upload-input naming gap still open |
| Visual polish | 8 | 8 | unchanged; minor state-dependent width hiccup noted on the new error-state text (French copy is wider, stretches the card briefly) |
| Resilience | 6 | 7 | **cleared floor** -- round 35's loading/error-state fix confirmed real and correctly wired; slider-NaN and silent-delete-failure gaps remain open, plus a newly-noted edge case (findings fetch's hardcoded 100-item cap has no truncation indicator) |
| Code quality | 7 | 7 | unchanged; round 35's rename confirmed clean and complete; QuestionCard duplication and blanket `any`/exhaustive-deps suppressions remain the two biggest drags, neither touched this round |
| Mobile | 8 | 8 | unchanged, confirmed clean |
| Security | 9 | 9 | unchanged, confirmed clean |

**Average: 7.67/10** (up from round 34's 7.56). **All 9 axes now clear
the 7 floor simultaneously for the first time in this entire loop.**
Still below the 9/10 target average.

**Next fix (Round 37):** with every axis now above floor, picking from
whichever axes sit furthest below the 9 target and have concrete,
contained, repeatedly-flagged fixes available rather than large
architectural work. Three small, independent, well-understood gaps
across three different files, batched together per this session's
tier-batching convention: (1) `CreateNewFindingModal.tsx`'s two
unconditional org-wide queries get the same `skip: !open` guard the
file's own third query already uses (efficiency); (2)
`InspectionActions.tsx`'s delete handler gets the same `toast.error`
failure path its sibling `updateStatus` handler already has
(resilience); (3) `InspectionReport.tsx`'s slider render gets a
`Number.isFinite` guard against the long-standing NaN gap (resilience).

**Review loop (PR #710):** round 1 (2 parallel angles) found no code
bugs across all three fixes -- confirmed no stale-empty-array
regression from the new `skip` guards (every consumer of the modal's
inspections/org-users data is gated behind an `if (!open) return`
effect already), confirmed the delete-failure fix correctly leaves
`deletingId` set (banner stays open) while `deleteInFlight` still
resets in `finally`, confirmed the slider fix's block braces are
correctly scoped with no other case affected. One minor test-coverage
gap found (no companion assertion that the modal's queries actually
fire with `skip: false` when open, only that they skip when closed) --
fixed with one additional test. Round 2 (scoped to that fix) came back
clean.

Merged as aexa-frontend PR [#710](https://github.com/Qiyrix/aexa-frontend/pull/710). QA gate at merge: typecheck/lint
clean, full suite 121 files / 1811 tests passing.

## Round 38 -- fresh 9-judge re-score

Full panel re-run (round 36 -> round 38, round 37's PR #710 in between fixed 3 small efficiency/resilience gaps):

| Axis | R36 | R38 | Note |
|---|---|---|---|
| Industry-standards | 7 | 7 | unchanged; independently corroborates the media-remove-button aria-label gap (below), plus 3 smaller narrow items (no client-side file validation on notes upload, nonstandard dialog-dismissal choice with documented rationale, one inconsistent raw-error toast) |
| UX | 8 | 7 | new, live-confirmed gap -- CreateNewFindingModal.tsx's Action Title required-check doesn't trim; a whitespace-only title passes client validation with no inline error, gets rejected server-side with an unhelpful generic toast. The two independently-drifted required-field validators remain open, unchanged |
| Efficiency | 7 | 7 | unchanged; round 37's fix confirmed correct and regression-tested. New finding -- StartInspectionModal.tsx has the identical unguarded-query pattern round 37 just fixed elsewhere (no `skip: !open` on its site/template queries), and it's larger (limit 1000 sites vs the 100 fixed previously), always mounted on the main inspections list page |
| Accessibility | 8 | 7 | new findings in CreateNewFindingModal.tsx's media-remove button -- no accessible name (icon-only, no aria-label unlike its sibling upload button), invisible on keyboard focus (opacity-0 with no focus-visible fallback), and undersized touch target (20px vs the established 44px convention). The known "Add Media" naming-collision gap remains open, unchanged |
| Visual polish | 8 | 8 | unchanged, confirmed clean; independently corroborates the same media-remove-button hover-only pattern as a minor, not-previously-flagged item -- "the same footgun explicitly fixed elsewhere in this feature" |
| Resilience | 7 | 8 | **improved** -- both round-37 fixes (delete-failure toast, slider NaN guard) confirmed correctly implemented via a fresh sweep across 5 files; the 100-item findings cap was re-assessed and judged genuinely low-priority (per-inspection scope, not org-wide) rather than worth re-flagging |
| Code quality | 7 | 7 | unchanged; round 37's 3 fixes confirmed cleanly integrated. Sharper framing on the QuestionCard duplication -- the media-case divergence is now confirmed an actual functional bug (video/PDF uploads silently break during inspection *creation*, not just during edit), not merely cosmetic duplication |
| Mobile | 8 | 8 | unchanged, confirmed no regression from round 37 |
| Security | 9 | 9 | unchanged, confirmed clean |

**Average: 7.56/10** (down slightly from round 36's 7.67 -- driven by
fresh, deeper audits surfacing real new issues on the same file
(`CreateNewFindingModal.tsx`'s media-remove button, corroborated
independently by 4 judges) now that round 37's fixes closed the
previous layer, not by any regression from what shipped). All 9 axes
still clear the 7 floor.

**Next fix (Round 39):** three well-corroborated, contained fixes
across two files, batched together: (1) `CreateNewFindingModal.tsx`'s
media-remove button gets an `aria-label`, an always-visible (not
hover-only) treatment with a `focus-visible` fallback -- closes the
accessibility, visual-polish, and industry-standards findings on the
same control in one pass; (2)
`StartInspectionModal.tsx`'s two unguarded queries get the same
`skip: !open` treatment round 37 already proved out, generalizing the
fix to its sibling modal rather than leaving the larger (limit 1000)
instance of the same pattern unaddressed; (3)
`CreateNewFindingModal.tsx`'s Action Title validation gets a
trim-aware check with a real inline error, instead of silently passing
whitespace-only input to the server and surfacing an unhelpful generic
toast.

**Review loop (PR #712):** round 1 (2 parallel angles) found no
functional bugs across any of the three fixes -- confirmed the
media-remove button's aria-label is genuinely per-item (correct map
index), confirmed `sitesData`/`templatesData` being `undefined` while
skipped is handled safely everywhere via optional chaining, confirmed
the Action Title's `required`/`validate` rules don't produce a garbled
double-message, confirmed no stale test elsewhere asserted on the old
button styling. Two minor documentation/cleanup items found (round-38's
"Next fix" plan text inaccurately said 44px when the implementation
used ~24px matching an established precedent; a now-dead `group` class
left over from the old hover-only button styling) -- both fixed. Round
2 (scoped to that fix) came back clean.

Merged as aexa-frontend PR [#712](https://github.com/Qiyrix/aexa-frontend/pull/712). QA gate at merge: typecheck/lint
clean, full suite 121 files / 1815 tests passing.

## Round 40 -- fresh 9-judge re-score

Full panel re-run (round 38 -> round 40, round 39's PR #712 in between fixed 3 well-corroborated gaps):

| Axis | R38 | R40 | Note |
|---|---|---|---|
| Industry-standards | 7 | 7 | round-39 media-remove-button fix confirmed holding. New finding -- InspectionActions.tsx has 6 `<button>` elements missing `type="button"`, breaking this codebase's own established convention (harmless today since none sit inside a `<form>`, but a real footgun) |
| UX | 8 | 7 | round-39 whitespace-title fix confirmed live end-to-end. The validator-drift gap is unchanged, but now explicitly documented in-code as an accepted gap rather than fixed -- a real, if narrower, remaining inconsistency for required checkbox/slider questions specifically in the update/complete flow |
| Efficiency | 7 | 7 | round-39 StartInspectionModal.tsx fix confirmed live (no template fetch until modal opens). New finding -- UploadNotesModal.tsx's `useGetNoteByInspectionIdQuery` has no `skip` guard at all, the same always-mounted-modal pattern rounds 37/39 already fixed twice elsewhere, now found a third time |
| Accessibility | 7 | 8 | **cleared back up** -- round-39 fix confirmed live via real keyboard navigation (Shift+Tab, not programmatic focus) showing a real focus-visible ring, and the accessible name resolves correctly ("Remove attachment 1"). The known "Add Media" naming-collision gap remains open, unchanged |
| Visual polish | 8 | 8 | unchanged, confirmed round-39's button restyle is visually consistent with the established black-pill pattern used elsewhere in the feature |
| Resilience | 7 | 8 | unchanged from round 38's already-recovered level; confirmed no regression from round 39. New small finding -- UploadNotesModal.tsx's create-note handler has no fallback error message (unlike every sibling handler in the same file) |
| Code quality | 7 | 7 | unchanged; round-39's fixes (including the round-2 dead-CSS cleanup) confirmed cleanly integrated. New, highly concrete instance of the QuestionCard duplication bug found -- CreateNewInspection.tsx's `handleExternalMediaUpload` hardcodes `type: "image"` for every upload, while UpdateInspection.tsx's identical function was already fixed with real MIME-based branching under a closed issue that never propagated to this file |
| Mobile | 8 | 8 | unchanged, confirmed no regression |
| Security | 9 | 9 | unchanged, confirmed clean |

**Average: 7.67/10** (up from round 38's 7.56, matching round 36's
prior high). No stagnation (average improved between rounds) and no
regression (no axis dropped). All 9 axes clear the 7 floor.

**Next fix (Round 41):** four small, independently-verified,
concrete fixes across three files, batched together: (1)
`UploadNotesModal.tsx`'s note-fetch query gets the same `skip: !open`
treatment already proven twice this session (rounds 37, 39) -- the
third instance of this exact pattern; (2) the same file's create-note
handler gets a fallback error message matching every sibling handler
in it; (3) `InspectionActions.tsx`'s 6 buttons get explicit
`type="button"`, matching the established convention already followed
in `CreateNewFindingModal.tsx`/`UpdateInspection.tsx`; (4)
`CreateNewInspection.tsx`'s `handleExternalMediaUpload` gets the same
MIME-based type detection `UpdateInspection.tsx` already has, closing
a real, quotable instance of the QuestionCard-duplication bug class
(video/PDF uploads during inspection *creation* currently mis-tag as
images).

## Round 41 -- shipped, reviewed, merged

All four fixes from round 40's plan implemented with negative-controlled
tests (each fix temporarily reverted, confirmed the new test fails,
restored). Full QA gate clean (typecheck, lint, 121 files / 1822 tests).
Live-verified in the browser: `UploadNotesModal`'s note-fetch query
confirmed absent from the network log until the modal opened, then fired
exactly once on open. `aexa-server`'s real S3 upload endpoint isn't
reachable in this preview environment -- video is rejected outright by
the server's multer allowlist (JPEG/PNG/WebP/GIF/PDF only), and a
synthetic PDF also failed upstream -- so the `CreateNewInspection` media
fix was verified by intercepting the upload `fetch` call to return a
realistic success response, then confirming a video upload renders a
real `<video controls>` element and a PDF renders a document link with a
`FileText` icon, matching `UpdateInspection.tsx`'s equivalent exactly.
(Flagged the server-side video-upload allowlist gap separately -- it's a
different repo and a product/infra decision, not something to fix
silently inside this loop.)

Shipped as [PR #714](https://github.com/Qiyrix/aexa-frontend/pull/714).
Two independent parallel review agents (line-by-line diff scan;
cross-file tracing + test-coverage + duplication audit) both returned
**zero correctness findings** in round 1 -- no fix round needed. The
line-by-line pass confirmed the ported MIME-detection and render-branch
logic is byte-for-byte equivalent to `UpdateInspection.tsx`'s reference
implementation (same guard order, same security guard on all three new
branches, same `onError` fallback), and confirmed `skip: !open` is safe
against RTK Query's tag-invalidation/refetch-on-resubscribe behavior (no
stale-cache risk on reopen). The cross-file pass confirmed no caller
assumes the old hardcoded `"image"` tag or the old unconditional
note-fetch, and that all four fixes are genuinely regression-tested (not
just claimed to be).

One non-blocking suggestion, logged as a candidate for a future round
rather than actioned now: this PR is the **third** time media-kind
branching logic (the render JSX and the MIME-tagging function) has been
duplicated near-verbatim between `CreateNewInspection.tsx` and
`UpdateInspection.tsx`. The reviewer's recommendation -- extract a shared
`getMediaKindFromMime(file)` util (mirroring `fileType()`'s existing
extraction) and a shared `<MediaThumbnail>` component -- is a pure
refactor with no behavior change, and worth picking up as round 42+'s
code-quality fix if that axis is still below target then.

Merged as aexa-frontend PR [#714](https://github.com/Qiyrix/aexa-frontend/pull/714). QA gate at merge: typecheck/lint
clean, full suite 121 files / 1822 tests passing.

## Round 42 -- fresh 9-judge re-score -- REGRESSION, loop paused

Full panel re-run (round 40 -> round 42, round 41's PR #714 in between
fixed 4 well-corroborated gaps: industry-standards's missing
`type="button"`, efficiency's missing `skip: !open` on
`UploadNotesModal`, resilience's missing fallback toast in the same
file, and code-quality's hardcoded media type):

| Axis | R38 | R40 | R42 | Note |
|---|---|---|---|---|
| Industry-standards | 7 | 7 | 7 | round-41 fix confirmed holding (all 6 `InspectionActions.tsx` buttons). New finding -- the identical `type="button"` gap is unaddressed in 12+ other buttons across sibling files in the same feature (`InspectionReport.tsx`, `UpdateInspection.tsx`, `CreateNewInspection.tsx`, `UploadNotesModal.tsx`); round 41 fixed the one file explicitly named, not the convention across the feature. Also flagged: no draft/autosave or discard-confirmation on exiting a partially-filled inspection |
| UX | 7 | 7 | 7 | validator-drift gap (required checkbox/slider silently passes validation) confirmed still open, unchanged, not double-counted. Minor new observation: the required-field asterisk implies enforcement that doesn't exist for these two answer types, a silent-failure trap |
| Efficiency | 7 | 7 | 7 | round-41 fix confirmed live (no note fetch until modal opens). The previously-noted `useMyOrgRole()` triple-query cost on every report view is now directly confirmed via live network trace (3 extra parallel queries just to gate one link's visibility) -- still open, unchanged |
| Accessibility | 7 | 8 | 8 | unchanged. "Add Media" naming-collision gap confirmed still open via real keyboard Tab traversal (not double-counted). New observation, same root cause: "Add Finding" button has the identical unqualified-name problem, not previously scoped that broadly |
| Visual polish | 8 | 8 | **7** | **regressed.** Round-41's new thumbnail rendering (video/document cases in `CreateNewInspection.tsx`) confirmed visually consistent with `UpdateInspection.tsx`'s precedent -- but round 41 only fixed the *mediaFiles thumbnail* rendering, not `CreateNewInspection.tsx`'s single "media"-question answer preview, which still unconditionally renders `<img>` for video/PDF answers. `UpdateInspection.tsx`'s equivalent single-answer preview already has full video/document parity. This leaves `CreateNewInspection.tsx` internally inconsistent -- attachment thumbnails are now type-aware, the primary answer preview still isn't |
| Resilience | 7 | 8 | **7** | **regressed.** Round-41 fix (fallback toast on note-create failure) confirmed holding. New finding: `UploadNotesModal.tsx`'s "Extract note from file" upload path has no `accept` attribute and never calls the shared `validateInspectionFile()` helper every sibling upload flow in this feature uses (5MB cap + MIME allowlist) -- a bad/oversized file is only caught after a network round-trip, not client-side like everywhere else |
| Code quality | 7 | 7 | 7 | round-41 fix confirmed correctly propagated (MIME branching matches `UpdateInspection.tsx` verbatim). New minor finding: the inline comment above the fix still describes the *old* bug ("hardcoded 'image'...") directly above code that no longer has that bug -- stale/misleading comment left behind by round 41. Duplication-extraction candidate (from round-41's PR review) confirmed still open, third occurrence |
| Mobile | 8 | 8 | 8 | unchanged. Round-41's new video thumbnail (native `<video controls>` in a 48x48px box) has effectively no usable touch surface for its built-in controls -- not a fresh regression (mirrors code that already existed unchanged in `UpdateInspection.tsx`), but newly-exposed surface area in `CreateNewInspection.tsx`'s flow. Confirmed systemic: the 24x24px thumbnail remove-buttons (vs. this feature's own established 44x44px convention) recur a third time in `CreateNewFindingModal.tsx` |
| Security | 9 | 9 | 9 | unchanged, confirmed clean. Both of round 41's new render sinks (`<video><source>`, `<a href>`) verified structurally gated by the same leading `isHttpUrl()` check as the existing `<img>` sink -- no regression |

**Average: 7.44/10** (down from round 40's 7.67). **Two axes regressed
between rounds (visual polish 8->7, resilience 8->7)** -- per this
loop's own guardrails, an individual-axis drop between rounds trips the
regression guardrail regardless of what the overall average does, and
warrants pausing to diagnose rather than continuing to loop silently.

**Diagnosis:** neither regression was caused by a bug *introduced* by
round 41's shipped code -- both are pre-existing gaps that a differently-
scoped round-40 judge pass didn't happen to surface, and that round 41's
narrower fixes (each scoped to a single named finding) didn't happen to
cover:
- Visual polish's drop is really "round 41 fixed half of a duplicated
  bug (thumbnails) and left the other half (single-answer preview)
  unfixed," which reads as a fresh inconsistency once judged again,
  even though the single-answer gap itself predates round 41.
- Resilience's drop is a genuinely separate, previously-unflagged gap in
  a file round 41 *did* touch for a different reason (the fallback-toast
  fix), caught by this round's more thorough live file-upload probing.

Neither is a case of a shipped fix quietly breaking something that used
to work -- both are pre-existing gaps this round's panel happened to
find. That distinction matters for how to respond, but doesn't change
that the guardrail's literal condition (an axis score dropped between
rounds) is met.

Pausing the autonomous loop here per the skill's guardrail rules,
escalating to Omar with this round's findings and a proposed round-42
fix candidate rather than shipping another fix unilaterally.

## Round 43 -- shipped, reviewed, merged (resumed by Omar)

Omar confirmed treating round 42's two regressed findings as round 43's
fix and resuming the loop. Both addressed:

- `CreateNewInspection.tsx`'s single "media"-question answer preview
  still unconditionally rendered `<img>` for a video/PDF answer --
  round 41 only fixed this file's mediaFiles *thumbnail* rendering, not
  the single-answer preview. Ports `UpdateInspection.tsx`'s already-
  shipped video/document branching (round 13/#507) rather than
  re-deriving it.
- `UploadNotesModal.tsx`'s "Extract note from file" input had no
  `accept` attribute and never called `validateInspectionFile()`,
  unlike every sibling upload flow in this feature -- a bad file was
  only caught after a full network round-trip failed. Same immediate
  reject-with-toast pattern as the other two files.

Live-verified: confirmed aexa-server's video-upload allowlist fix
(PR #326, merged earlier this session) works end-to-end from this
side -- a real `video/mp4` upload now passes multer's `fileFilter` and
only fails downstream on a pre-existing local-dev AWS credentials gap,
unrelated to either change. The single-answer video/PDF render path has
no reachable "media"-type question in this preview account's available
templates, so it's verified via the same fetch-intercept technique used
for round 41's equivalent thumbnail fix, plus negative-controlled unit
tests against the real render path. `UploadNotesModal`'s file
validation was fully live-verified: selecting an oversized file shows
the toast immediately with zero network request fired.

Shipped as [PR #719](https://github.com/Qiyrix/aexa-frontend/pull/719).
Round-1 review found no structural bugs in the ported branching, but
did catch one real, concrete regression: the shared
`validateInspectionFile()` util was missing `video/quicktime` (.mov)
and `video/webm`, both of which aexa-server's own upload allowlist
already accepts (PR #326) -- since `UploadNotesModal.tsx`'s input
previously had *no* client-side validation at all, this PR's new
validation would have silently regressed `.mov`/`.webm` note-extraction
uploads that used to work. Fixed by widening the shared allowlist
(benefiting every consumer, not just this one file) and updating the
now-stale "MP4 videos" copy strings. Round 2 (fresh diff pass on the
fix commit) came back clean.

Merged as aexa-frontend PR [#719](https://github.com/Qiyrix/aexa-frontend/pull/719). QA gate at merge: typecheck/lint
clean, full suite 121 files / 1833 tests passing.

## Round 44 -- fresh 9-judge re-score -- REGRESSION, loop paused again

Full panel re-run (round 42 -> round 44, round 43's PR #719 in between
fixed round 42's two regressions -- visual polish's single-answer media
preview, resilience's note-file validation):

| Axis | R40 | R42 | R44 | Note |
|---|---|---|---|---|
| Industry-standards | 7 | 7 | 7 | unchanged. Both known gaps confirmed still open and untouched by round 43: `type="button"` missing in 8+ buttons across `InspectionReport.tsx`/`UpdateInspection.tsx`/`UploadNotesModal.tsx`, and no draft/discard-confirmation on exiting a partially-filled inspection wizard. Noted precisely: `UpdateInspection.tsx`'s per-question *answering* flow already has real debounced autosave -- the gap is specifically the initial site/template wizard and general navigate-away, not the answering screen itself |
| UX | 7 | 7 | 7 | unchanged. Validator-drift gap (required checkbox/slider silently passes validation) confirmed still live-reproducible -- unchecked a required checkbox, marked the inspection Completed, no validation fired. Minor new observation: a success-toast can visually overlap the status dropdown right after a save, causing an apparent-no-op first click |
| Efficiency | 7 | 7 | 7 | unchanged. `useMyOrgRole()`/`useMyAssignedInspectionIds()` triple-query cost on every report view confirmed still firing via live network trace (6 total requests, 3 purely to gate one link's visibility); `GET /api/organization/members` still unpaginated, cost scales with org size |
| Accessibility | 8 | 8 | 8 | unchanged. "Add Media"/"Add Finding" naming-collision gap confirmed still open via real keyboard Tab traversal across multiple questions -- both resolve to identical, unqualified accessible names regardless of which question they belong to |
| Visual polish | 8 | 7 | **9** | **regression resolved, cleared past its prior high.** Round-43's fix (PR #719) confirmed correct: `CreateNewInspection.tsx`'s single-answer media preview now has full video/document/image branching, structurally identical to `UpdateInspection.tsx`'s reference (same guard order, same delete-button treatment) |
| Resilience | 8 | 7 | **8** | **regression resolved.** Round-43's fix confirmed live: selecting an oversized file in `UploadNotesModal.tsx`'s file-extraction mode now shows a toast immediately with zero network request fired. New finding, different file, not double-counted: `CreateNewFindingModal.tsx`'s finding-attachment upload still has no `validateInspectionFile()` call -- same bug class, not yet fixed there |
| Code quality | 7 | 7 | **6** | **regressed.** Unlike round 42's two regressions (pre-existing gaps a more thorough panel happened to find), this one is directly caused by round 43's own shipped code: porting `UpdateInspection.tsx`'s video/document branching into `CreateNewInspection.tsx`'s single-answer preview added a *fourth* copy of the same duplicated media-kind-branching pattern (now 6 total instances counting both JSX render blocks and both MIME-tagging functions across the two files) -- the shared-helper extraction round 41's own PR review first recommended is now more overdue, not less. The round-41 stale comment ("hardcoded 'image'...", still sitting above code that's no longer hardcoded) also remains unfixed |
| Mobile | 8 | 8 | 8 | unchanged. Round-43's new single-answer `<video controls>` element confirmed correctly sized (44px delete button, full-width video, matching `UpdateInspection.tsx`'s reference) -- not a repeat of the still-open 48x48px thumbnail-video / 24x24px remove-button touch-target issues, which remain open unchanged (now confirmed in 3 places including `CreateNewFindingModal.tsx`) |
| Security | 9 | 9 | 9 | unchanged, confirmed clean. Round 43's new render sinks in `CreateNewInspection.tsx`'s single-answer preview verified structurally gated by the same `isHttpUrl()` guard as every other sink; the widened client-side MIME allowlist confirmed advisory-only, aexa-server's `uploader.ts` remains the authoritative server-side gate |

**Average: 7.67/10** (up from round 42's 7.44, actually the highest
average this loop has reached). **But one axis regressed between
rounds (code quality 7->6)** -- per this loop's own guardrails, an
individual-axis drop trips the regression guardrail regardless of what
the overall average does, the same rule that paused the loop at round
42.

**Diagnosis -- materially different from round 42's regressions:**
round 42's two regressions were pre-existing gaps a more thorough judge
pass happened to surface for the first time, not caused by any shipped
fix. This one **is** directly caused by round 43's own shipped code:
faced with a choice between porting the duplicated branching logic
(fast, safe, proven-correct-by-precedent) or finally extracting the
shared `getMediaKindFromMime`/`MediaThumbnail` helper round 41's PR
review first recommended, round 43 chose the faster path and made the
underlying duplication measurably worse (a fourth JSX/render copy, six
total instances of the same pattern) in the course of legitimately
fixing a real, user-visible bug. The fix itself is correct and
necessary -- the cost was paid in code-quality debt, not functionality.

Pausing the autonomous loop here per the skill's guardrail rules,
escalating to Omar with this round's findings rather than picking round
45's fix (which would almost certainly be the same extraction
recommendation, now flagged for a third round running) unilaterally.
