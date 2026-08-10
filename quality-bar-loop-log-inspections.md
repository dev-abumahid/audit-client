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
