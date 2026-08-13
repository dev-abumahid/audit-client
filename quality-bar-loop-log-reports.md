# Quality Bar Loop — Board Reports feature

**Target:** average 8/10 (lowered from the usual 9 per explicit user instruction —
"you can stop after you've reached 8 to 8.5"), per-axis floor 7/10, no
max-round cap. Stop as soon as average >= 8 AND every axis >= 7 (the
skill's own convergence check, just with a lower target ceiling this
time).
**Feature files:**
- `src/dashboard/organization/reports/ReportsPage.tsx` (341 lines — the entire feature, no sub-components)
- `src/redux/apis/organization/report.api.ts` (RTK Query slice: useGetAllReportsQuery, useGenerateReportMutation, usePublishReportMutation)
- `src/dashboard/organization/reports/ReportsPage.test.tsx` (existing, 494 lines, 23 `it()` blocks)

**What it does:** org-scoped page where ADMIN/LEAD_AUDITOR can generate
AI-written PDF board reports from live risk data (report type dropdown,
only "BOARD" enabled today, others shown disabled as "coming soon").
Generated reports render as cards (title, date, ref number, AI badge,
status badge) in a grid; while any report is GENERATING the page polls
every 5s. Ready/Published reports can be Previewed (new tab) or
Downloaded (temp `<a download>` link, filename-sanitized). ADMIN-only
gets a Publish action on Ready reports.

**Conditional judges:** Mobile/Responsive and Security both ON — same
reasoning as the Findings loop (board-level reports are sensitive,
plausibly reviewed on tablets; the feature constructs download/preview
URLs from server data, worth the same attachment-URL-class scrutiny
Findings needed).
**Standing merge authorization:** carried over — merge automatically
once a fix's review loop clears, no per-PR re-ask.
**Per-axis floor rationale:** kept at 7 (not the skill's default
target-2=6) to hold the same "not actually broken" bar the Findings
loop used, even though the target ceiling is lower this time.

## Round 1 — fresh 9-judge panel

| Axis | R1 | Note |
|---|---|---|
| Industry-standards | 6 | Publish is a genuine ADMIN-only maker-checker gate (real strength, matches Diligent/BoardEffect). But: the `Report` model already carries `version`/`generated_by`/`reviewed_by`/`reviewed_at` server-side, yet none of it renders in the UI -- no audit-trail/provenance visible on cards, no version linkage between successive generations of "the same" report, no status/type filter for a growing library, no scheduling, PDF-only export. |
| UX | 6 | Live-reproduced: a genuine list-fetch failure renders the identical "No reports yet" empty state as zero real reports -- misleading. Generation is synchronous and can be slow (code references a prior #220 504 timeout issue) with only a bare spinner, no progress/stage/ETA. Failed cards have no one-click retry (user must scroll back to the generator). No confirmation step before an ADMIN's Publish action, despite it being effectively irreversible. |
| Efficiency | 8 | Polling correctly uses RTK Query's native `pollingInterval` (not hand-rolled), reactively derived from `hasGenerating`, cleans up automatically on unmount. One codebase-wide (not feature-specific) gap: `setupListeners` is never called anywhere in the app, so polling can't pause on an unfocused tab. |
| Accessibility | 7 | At floor. Status never color-only (real text always present), disabled dropdown options explain why via their own accessible name. Real gap: the 5s poll's GENERATING->READY/FAILED transition is never announced (`aria-live`) -- a screen-reader user who starts generation and waits gets no cue their report finished. |
| Visual polish | 8 | Cards/badges correctly reuse the shared design system (`rounded-xl border bg-card`, `severityBadgeClasses`) matching Templates/Inspections conventions. One real inconsistency: `STATUS_STYLES.FAILED` is hardcoded (`bg-destructive/10 text-destructive`) instead of routing through `severityBadgeClasses("critical")` like every other status in the same map -- visibly lower-contrast than a real critical chip elsewhere in the app. |
| Resilience | 6 | Below floor. `useGetAllReportsQuery`'s result is destructured without `isError`/`error` -- the exact bug class already fixed in `FindingDetails.tsx` this session. Live-reproduced by briefly stopping the backend: the list silently falls back to the same empty-state UI as zero real reports, with no distinct error state and no manual retry (only the generating-poll's own refetch, which doesn't run at all if nothing is mid-generation). |
| Code quality | 8 | 341-line single-component page is appropriately sized, not gratuitous; a `ReportCard` extraction is a reasonable future call but not a current tax. Comments are unusually good and load-bearing (explain *why*, cite real prior issues). No `any` usage. Existing 23-test suite is substantive, not shallow -- asserts on actual mutation call args, real filename-sanitization edge cases, the live `pollingInterval` value. |
| Mobile | 8 | Card grid correctly reflows to a single column at 375px; generate form stacks correctly. Card action buttons measure ~34px tall -- above the WCAG 2.5.8 legal floor (24px) but under the 44px comfort target for primary actions like Publish. Judge couldn't directly observe the Preview/Download/Publish button row live since every report in the preview account happened to be in a FAILED state (a data-availability gap in this run, not a code issue). |
| Security | 5 | Below floor. `openPdf`'s `window.open(report.file_url, "_blank", "noopener")` and `downloadReport`'s `link.href = report.file_url` both take a server-returned URL straight into a sink with zero scheme guard -- the exact bug class `src/utils/isHttpUrl.ts` exists to prevent, already applied to 6 other files in this codebase (`FindingDetails.tsx`, `MediaThumbnail.tsx`, `InspectionReport.tsx`, `CreateNewFindingModal.tsx`, `InspectionActions.tsx`, `UpdateInspection.tsx`) but never imported here. `noopener` is present (blocks reverse-tabnabbing) but that's a different protection than a scheme guard. |

**Average: 6.89/10** ((6+6+8+7+8+6+8+8+5)/9). **Four axes below floor**
(industry-standards 6, UX 6, resilience 6, security 5) -- not
converged (target 8), loop continues.

**Round 2 selection**: security (5) is the lowest score and a real,
concrete `security`-tagged finding at/below floor -- wins outright per
selection rule 5c.1 regardless of any streak computation (this is
round 1, no streak history exists yet). Resilience's finding is a
second, independently real, below-floor bug -- both live in the exact
same file (`ReportsPage.tsx`) and are small, well-diagnosed, Tier 1/2
fixes, so fixing both in the same round's diff (one file, one
continuous change) rather than artificially splitting them across
rounds, following the same reasoning already used in the Findings loop
for rounds 9/10 (same-round, same-file, not a batching-different-
sources conflict since it's one authored diff, not two independently-
developed branches).

**Fix scope**: (1) import `isHttpUrl` and guard both `openPdf`'s
`window.open` call and `downloadReport`'s `link.href` assignment,
matching `FindingDetails.tsx`'s established pattern exactly; (2) add
`isError`/`refetch` handling to `useGetAllReportsQuery`, rendering a
distinct load-error state instead of the empty-state fallthrough,
mirroring `FindingDetails.tsx`'s round-12 fix.

## Round 2 outcome

Shipped both fixes selected in round 1 (PR #758).

1. **`isHttpUrl()` guard** added to `openPdf` (`window.open`) and
   `downloadReport` (`link.href`), matching the pattern already used
   in 6 other files across the codebase.
2. **Load-error state**: `useGetAllReportsQuery` now destructures
   `isError`/`refetch`; a distinct `role="alert"` error block with a
   Retry button renders before the empty-state fallthrough.

**QA**: typecheck/eslint clean. Full suite: 1975/1975 passing. 7 new
regression tests with a verified negative control (5/7 failed without
the fix, 2 correctly-passing control cases).

**Live verification**: the load-error fix fully confirmed end-to-end
(stopped the backend, saw the distinct error state, restarted, Retry
recovered the list without a reload). The URL-guard fix could not be
live-click-tested on a real READY report -- this preview environment's
report generation has a 100% failure rate (confirmed via a fresh
generation attempt during this verification, unrelated to the fix,
likely a missing AI-service credential in this account) -- relied on
the unit tests' verified negative control instead, documented rather
than silently skipped.

**Review**: two parallel angles (correctness, security-completeness).
Both came back clean -- correctness confirmed mutually-exclusive JSX
branches and sound polling interaction; security-completeness
independently re-traced every field on the `Report` type and confirmed
no third URL sink was missed, and confirmed the guard won't block real
Cloudinary-backed report URLs.

## Round 3 — fresh 9-judge panel

Round 2's diff touched real logic in one file (isHttpUrl guard, isError
handling) -- not eligible for the scoped shortcut, full panel re-run.

| Axis | R1 | R3 | Note |
|---|---|---|---|
| Industry-standards | 6 | **5** | Live-confirmed the provenance gap unchanged: `Report` carries `version`/`generated_by`/`reviewed_by`/`reviewed_at` server-side, still never rendered on any card. No status/type filter despite `searchTerm` already being accepted by the API. No version linkage between generations, no scheduling, PDF-only export. Scored slightly stricter this round given generation's ongoing 100% failure rate compounds the missing audit trail (a reviewer can't see who attempted generation or why it failed). |
| UX | 6 | **7** | Round 2's load-error fix confirmed genuinely working live (distinct state, working Retry, clean recovery after a real backend outage). Three round-1 findings unchanged: no per-card retry on a FAILED report (especially painful right now since 100% of this org's reports are FAILED), no generation progress indicator, no Publish confirmation step. |
| Efficiency | 8 | 8 | Polling still correctly implemented, no change. New minor finding: the round-2 Retry button has no `isFetching`-based guard against rapid double-clicks (unlike Publish/Generate, which both guard re-entrancy) -- low severity, bounded/user-paced, not a real regression. |
| Accessibility | 7 | 7 | Round 2's new `role="alert"` confirmed correctly implemented and live-verified to announce properly. Both round-1 findings unchanged: no `aria-live` on the GENERATING->READY/FAILED poll transition, `generatingHint` text not wired via `aria-describedby` to the Generate button. |
| Visual polish | 8 | 8 | Both round-1 findings (hardcoded FAILED badge bypassing the audited `severityBadgeClasses` contrast, AI-badge/status-pill shape mismatch) confirmed still present via a fresh live screenshot. Round 2's new error-state block assessed as a clean, well-executed visual match to the existing empty-state pattern. |
| Resilience | 6 | **8** | Round 2's fix independently reconfirmed live for a third time this session (stop backend -> distinct error state -> restart -> Retry recovers). Generation-failure handling and dual transport-vs-logical-failure error paths assessed as genuinely well done. New minor finding: `Report.error_message` exists on the type and presumably carries the real backend failure reason, but is never read/rendered -- every FAILED card shows the same generic hint regardless of cause. |
| Code quality | 8 | 8 | Round 2's diff assessed clean and consistent with the file's existing style. One minor nit: the `isHttpUrl` guard is duplicated verbatim (inverted) across `openPdf`/`downloadReport` rather than factored into a one-line helper -- cheap, not currently worth a dedicated round. File grew 341->376 lines, still not clearly past the point where extraction is warranted. |
| Mobile | 8 | 8 | Grid reflow and form stacking confirmed correct, unchanged. Card action buttons still ~34px tall (above the WCAG floor, under the comfort target) -- still unverifiable live since every report in this org remains FAILED. Round 2's error-state block structurally matches the already-mobile-verified empty-state pattern; judge was blocked from directly triggering it live this round by a sandbox restriction on stopping the shared backend process, so this is a code-read assessment, not a fresh live one. |
| Security | 5 | **9** | Round 2's fix independently re-verified complete for a second time this session (correct guard order at both sinks, no TOCTOU gap, no second URL-shaped field on the `Report` type missed, no other injection surface in the file). |

**Average: 7.56/10** ((5+7+8+7+8+8+8+8+9)/9). **One axis below floor**
(industry-standards, 5) -- not converged (target 8), loop continues.

**Round 4 selection**: industry-standards is the only axis at/below
floor -- wins automatically, no stuck_streak tiebreak needed. Within
its findings, checked feasibility before committing (same discipline
the Findings loop used for its own industry-standards gaps): the
provenance/audit-trail finding (`generated_by`/`reviewed_by`) is
**not** cleanly frontend-fixable -- those fields are raw account IDs
with no joined name/profile data returned by the backend, so rendering
them as-is would replace no-information with worse information (a raw
UUID), not a real improvement. Status/type filtering also needs
backend work: confirmed via a fresh check against the sibling
`aexa-server` repo that `status`/`type` are accepted by neither the
route's (nonexistent) query validator nor `get_all_report_from_db`'s
`whereCondition` construction.

**What IS cleanly frontend-fixable**: `searchTerm` is already fully
implemented server-side (`get_all_report_from_db` builds a real,
case-insensitive Prisma `OR` match against `title`/`reference`) --
`ReportsPage.tsx` just hardcodes `searchTerm: ""` and never exposes a
search box. This directly addresses part of the "no way to narrow a
growing library" finding without any backend change. Selected as round
4's fix: add a debounced search input, matching the established
`useDebouncedValue` pattern already used across the Findings loop and
elsewhere in this codebase.

## Round 4 outcome

Shipped via PR #760 (merged), across two commits:

1. **Search box**: added a debounced (`useDebouncedValue`, 300ms) text
   input wired to the existing `searchTerm` query param, with a
   distinct "no results" empty-state message that stays in sync with
   the debounced (not raw) search value.
2. **Review-fix follow-up**: an independent review pass caught a real
   interaction bug the initial implementation missed -- `hasGenerating`
   (the flag that turns GENERATING-report polling on/off) was derived
   from the same *searched/filtered* report list rendered in the UI,
   so an active search term that filtered out the one GENERATING
   report would incorrectly stop polling, even though generation was
   still running server-side. Fixed by adding a second, always-unfiltered
   `useGetAllReportsQuery` probe (`searchTerm: ""` always) to drive
   `hasGenerating` independently of the search. RTK Query's default
   `serializeQueryArgs` dedupes this against the main query into a
   single request/cache entry whenever no search is active (verified:
   no `serializeQueryArgs`/`keepUnusedDataFor` override anywhere in the
   API slice or base API) -- no extra network cost in the common case;
   while a search *is* active, two independent 5s-interval polling
   queries run concurrently, an accepted bounded tradeoff, not a defect.

**QA**: typecheck/eslint clean on this branch (a pre-existing,
unrelated TS2556 typecheck failure on `main` in three Findings test
files was investigated, confirmed unrelated to this work via isolated
checkout, and flagged separately rather than fixed here). Full suite:
1979/1979 passing, including a corrected regression test for the
polling/search interaction bug.

**Negative control discipline paid off here**: the first version of
the polling regression test passed even against the genuinely buggy
pre-fix code, because it never actually simulated a user typing into
the search box. Traced to a second, subtler bug in the test itself
once the search *was* simulated -- the final assertion ran
synchronously right after the debounced UI update, racing ahead of the
`hasGenerating` `useEffect`'s own re-render and reading a stale
`pollingInterval` value. Wrapping the final assertion in `waitFor`
fixed the race; re-verified the test now genuinely fails against the
pre-fix intermediate source and passes against the fix.

**Review**: one scoped angle on the follow-up commit (RTK Query dedup
correctness, race/stale-closure check, regression-test soundness).
Came back clean -- no real bugs, the double-polling-while-searching
tradeoff explicitly assessed as acceptable rather than a defect.

## Round 5 -- fresh 9-judge panel

Round 4's diff touched real logic (search feature + a follow-up
polling-derivation fix) in one file -- not eligible for the scoped
shortcut, full panel re-run.

| Axis | R1 | R3 | R5 | Note |
|---|---|---|---|---|
| Industry-standards | 6 | 5 | **7*** | *Corrected -- see false-positive note below. Search box (round 4) confirmed genuinely narrowing the report library, closing part of the long-standing "no way to narrow a growing library" gap. Provenance/audit-trail and status/type filtering re-confirmed still backend-blocked (not re-investigated further per standing note). Round 2's isHttpUrl guard, the round-4 real `<a download>` anchor (vs. just reopening the PDF), the ADMIN-only Publish gate, and disabled-type tooltips all independently re-confirmed as solid, still-standing improvements. |
| UX | 6 | 7 | **7** | Unchanged, at floor -- same three highest-friction gaps as R3 (no per-card retry on a FAILED report, no Publish confirmation step, indicator granularity). Search itself assessed as smooth and well-debounced (2 requests for a multi-char typed string, not one per keystroke) with two new minor frictions of its own: no clear/x button, no in-flight loading indicator while a search is debouncing/fetching (component reads `isLoading`, not `isFetching`). |
| Efficiency | 8 | 8 | **8** | Live-verified (not just read) both halves of round 4's dedup claim: a single matched request pair when the search box is empty, and two independent concurrent polling queries while a search *is* active -- confirmed negligible at this feature's realistic scale (limit=100, 5s interval, only while something is simultaneously GENERATING and searched). Debounce confirmed genuinely working via live network capture. |
| Accessibility | 7 | 7 | **7** | Unchanged, at floor, third consecutive round -- the same two round-1 findings (no aria-live on the poll transition, generatingHint not wired via aria-describedby) plus two new ones from round 4's search: the input has no accessible label (placeholder-only isn't WCAG-conforming per 1.3.1/3.3.2 -- confirmed via DOM inspection, `ariaLabel: null`), and the "no results" message change is silent to screen readers (no aria-live/role="status", confirmed via DOM). |
| Visual polish | 8 | 8 | **8** | Unchanged. Round 4's search input assessed live as a clean, well-integrated addition (matching height/radius/border/focus-ring tokens of the existing type-select, correct icon centering, no layout awkwardness). The two round-3 findings (hardcoded FAILED badge bypassing severityBadgeClasses, AI-badge/status-pill shape mismatch) both reconfirmed still open via a fresh live screenshot. |
| Resilience | 6 | 8 | **8** | Round 4's polling fix independently re-verified live via network trace (single deduped request with no search active, confirming the dedup claim end-to-end, not just by reading code). No other "derived from the filtered list" bugs found elsewhere in the file. Empty-vs-no-results distinction confirmed correct and debounce-safe. Round-3's minor open item (`Report.error_message` never rendered) reconfirmed unchanged, now open three rounds running. |
| Code quality | 8 | 8 | **8** | The new two-query pattern (`reportData`/`pollProbeData`) assessed as deliberate and well-commented, not confusing duplication -- the comment gives the causal "why," not just a description. File now 425 lines; report-card JSX and the generate-section JSX are each large enough to be worth extracting into subcomponents, though not yet forcing a score drop. Round-3's `isHttpUrl` duplication finding reconfirmed unchanged, still cheap. |
| Mobile | 8 | 8 | **8** | Live-verified at 375px: round 4's search input fits cleanly with no clipping, correct icon/placeholder rendering, and a correctly distinct no-results empty state. Round-3's card-button-height finding remains unverifiable live (every report in this org's preview stays FAILED). A fresh attempt to force a real live error state via a post-load `fetch` monkey-patch was correctly recognized as the known dedicated pitfall (RTK Query's `fetchBaseQuery` captures its own reference before a patch can apply) and abandoned in favor of not risking the shared dev server other judges were using concurrently -- unchanged from R3, code-read-verified only. |
| Security | 5 | 9 | **9** | Re-confirmed: no `dangerouslySetInnerHTML` anywhere, the search term is only ever used as a controlled input value and a boolean condition, transported to the backend via `URLSearchParams` (no client-side injection surface), and round 2's `isHttpUrl` guard on both URL sinks is untouched by round 4's diff. |

**Average (corrected): 7.78/10** ((7+7+8+7+8+8+8+8+9)/9). **No axis
below floor** -- all nine axes are now at or above the 7 floor for the
first time this loop. Not yet converged (target 8), loop continues.

**False-positive investigation (industry-standards judge's initial
6/10 -- corrected to 7/10 above):** the dispatched industry-standards
judge reported a "regression": typing a non-matching search term
correctly hit the backend (confirmed via its own network capture,
`GET .../report?searchTerm=nomatch12345` returning `{"data":[]}`) but
claimed the UI kept showing all 6 unfiltered report cards, with no
"no results" state ever appearing. This directly contradicted three
other judges (mobile, accessibility, and UX) who each independently
live-verified the exact same no-results state rendering correctly.
Per the skill's own guidance to verify anything "surprising,
high-stakes, or contradicting your own understanding" before
forwarding an agent's claim, reproduced this myself: the failure
*did* initially reproduce in a long-lived, heavily-reused browser tab
(the same one several prior rounds' live-verification work had run
through, evidenced by a stray Vite HMR module-reload request in its
network log) -- but immediately stopped reproducing in a genuinely
fresh tab, where the backend request, the empty response, and the
correct "No reports match your search." text all confirmed clean.
This is exactly the known "long-running dev server accumulates
hot-reload module-state corruption" pitfall the panel's own judge
prompts warn about, just caught here on the judge side rather than
the app side. Industry-standards' score corrected from the judge's
reported 6 to 7, reflecting its otherwise-accurate assessment (the
search genuinely does close part of the "no way to narrow" gap; the
other backend-blocked findings and prior improvements are all
accurately characterized) with the false regression removed.

**Round 6 selection**: no `data-correctness`/`security` finding at or
below floor. Highest `stuck_streak`: accessibility, unchanged at
exactly its floor score (7) for 3 consecutive full-panel rounds (R1,
R3, R5) -- wins selection. UX is close behind (streak 2, R3/R5 both
7) but accessibility's longer streak takes priority per the
mechanical tiebreak. Selected fix: close all four open accessibility
findings on this axis in one round (same file, no cross-file batching
concern) -- an `aria-live`/`role="status"` region for the
GENERATING->READY/FAILED poll transition and the no-results-state
change, `aria-describedby` wiring `generatingHint` to the Generate
button, and a proper accessible label (not just a placeholder) on the
search input.

## Round 6 outcome

Shipped via PR #762 (merged), across four commits -- the most review
iteration any single round has needed so far in this loop, each pass
catching a real, progressively subtler bug:

1. **Initial fix**: search input `aria-label`, `role="status"` on the
   no-results/empty-state text, `aria-describedby` wiring
   `generatingHint` to the Generate button, and `aria-live="polite"`
   on every report card's status badge.
2. **Review pass 1 finding (real)**: the blanket `aria-live` on every
   badge (not just the transitioning one) turns every report into a
   permanent live region and risks announcing unrelated re-renders --
   scoped to `aria-live={isGen ? "polite" : undefined}`, and
   `role="status"` scoped to only the `debouncedSearch` branch (the
   static empty-org message isn't a state change worth announcing).
3. **Review pass 2 finding (real, subtler)**: the `isGen`-gated
   `aria-live` from pass 1 still had a race -- `isGen` flips `false`
   in the *same commit* that changes the status text, so some screen
   readers evaluate "is this node still live" at mutation-processing
   time and can silently swallow the exact announcement it exists for.
   Replaced with the standard pattern: a single, always-present
   `sr-only` live region whose `aria-live`/`role` never toggle, only
   its text -- updated a render *after* the transition via its own
   effect that diffs each report's current vs. previous status.
   `reports` was memoized (a lint warning caught an unstable array
   reference that would've made the effect re-diff every render).
4. **Review pass 3 (clean, minor note)**: confirmed the race is
   genuinely fixed, the mount-guard logic is correct (`undefined ===
   "GENERATING"` is false, so a report's first appearance never
   spuriously announces), and the tests correctly exercise the
   two-render transition via `rerender()`. One minor, explicitly
   accepted limitation flagged and documented rather than fixed: if
   two reports transition out of GENERATING in the same update, only
   the last is announced -- not worth a queue's complexity given
   generation is one-at-a-time in this app (single Generate button, no
   bulk-generate).

**QA**: lint clean, typecheck clean (same pre-existing, unrelated
TS2556 failure on `main`, not re-investigated). Full suite:
1987/1987 passing, including 8 new accessibility regression tests
(the final 3, covering the live-region fix, replaced 2 tests from
pass 1 that no longer applied once the per-badge approach was
replaced). Every fix in every pass had a genuine negative control
-- reverted, confirmed the relevant tests failed, restored.

**Live verification**: all fixes confirmed in a fresh browser tab
(avoiding the round-5 stale-tab pitfall) against the running dev
server -- the search input's accessible name via the a11y tree, the
`role="status"` no-results announcement by typing a non-matching
search term, the live region's presence/emptiness on load, and (for
the final fix) a real generate-and-fail cycle correctly *not*
spuriously announcing, since generation is synchronous in this app
(a report never appears as GENERATING in the list at all) -- the
polling-recovery transition this region exists for is covered by the
unit tests instead, since this preview environment has no way to
trigger it live.

## Round 7 -- fresh 9-judge panel

Round 6's diff (the 3-pass accessibility fix) touched real logic
(a new effect, a memo) in one file -- not eligible for the scoped
shortcut, full panel re-run.

| Axis | R1 | R3 | R5 | R7 | Note |
|---|---|---|---|---|---|
| Industry-standards | 6 | 5 | 7* | **7** | Search (round 4) re-confirmed correct at the API level (direct `searchTerm=` calls verified 200/0-results). Status/type filtering and provenance display re-confirmed still backend-blocked. New minor note: `generated_by` is captured server-side and typed on the frontend but never rendered -- same backend-data-quality gap as the already-known provenance finding (still just a raw ID, not a joined name), not treated as newly frontend-fixable. |
| UX | 6 | 7 | 7 | **7** | Unchanged, 3rd consecutive round at floor. Same 4 friction items: no per-card retry on FAILED (the judge called this "the single worst friction point" given this org's 8/8 FAILED reports), no Publish confirmation, indeterminate generation indicator, no search clear/x button. |
| Efficiency | 8 | 8 | 8 | **8** | Round 6's new status-diffing effect assessed as genuinely negligible at scale (single O(n) loop, cheap object construction). The `useMemo([reportData])` dependency (vs. `[reportData?.data]`) re-executes the memo body more often than strictly needed, but RTK Query's structural sharing keeps the *output* array reference stable regardless -- imprecise, not a functional or measurable-perf regression. |
| Accessibility | 7 | 7 | 7 | **8** | First move off the floor since the loop started. All 4 round-6 fixes independently re-verified live (accessible name via the a11y tree, scoped `role="status"`, `aria-describedby` timing around a real Generate click, the live-region's mount-safe diffing logic). One new, narrow edge case found and accepted at floor-ding severity rather than a blocking finding: if a report is GENERATING while filtered out of view by an active search term, and resolves while still filtered out, the diffing effect (which only iterates the *searched* `reports` list) drops its id from the ref with no announcement ever firing for that transition -- same spirit as the already-documented "simultaneous transitions" limitation. |
| Visual polish | 8 | 8 | 8 | **8** | Both R3 findings (hardcoded FAILED badge, AI-badge/status-pill shape mismatch) reconfirmed unchanged. Round 6's sr-only live region independently confirmed visually inert (standard Tailwind `sr-only`, outside the flex/grid flow, no layout shift observed live). |
| Resilience | 6 | 8 | 8 | **8** | Round 6's `previousStatusesRef` checked for unbounded growth/staleness -- confirmed bounded and the staleness is actually beneficial (a report hidden then reappearing still triggers correctly). Round 2's error/retry path confirmed untouched by round 6's diff. `Report.error_message` still never rendered -- now open 4+ consecutive rounds (R3-R7). |
| Code quality | 8 | 8 | 8 | **8** | Round 6's final state assessed as clean despite its 4-commit/3-review-pass history -- the accepted limitation's reasoning is explicitly commented, not left implicit. File now 477 lines; the report-card JSX block (~105 lines) is now assessed as a real should-fix for subcomponent extraction, not just "worth considering" as in R5. `isHttpUrl` duplication still open, unchanged. |
| Mobile | 8 | 8 | 8 | **8** | Round 6's diff independently confirmed layout-inert via `getBoundingClientRect()` on the live region (1x1px, absolute, overflow hidden -- the standard sr-only footprint). Search/no-results and Generate-section stacking reconfirmed correct at 375px. Card-button-height finding remains unverifiable live (org still 100% FAILED). |
| Security | 5 | 9 | 9 | **9** | Round 6's new `t()` interpolation of `report.title` into the live region confirmed safe -- rendered as React text content (never `dangerouslySetInnerHTML`), i18next's `escapeValue: false` is the standard/correct React config since React itself escapes text children. Round 2's `isHttpUrl` guard reconfirmed untouched. |

**Average: 7.89/10** ((7+7+8+8+8+8+8+8+9)/9). **No axis below floor**
-- 2nd consecutive round with everything at/above the 7 floor. Not
yet at the user's 8-8.5 target band, but within 0.11 of it -- the
closest this loop has come.

**Round 8 selection**: no `data-correctness`/`security` finding at or
below floor. Highest `stuck_streak`: UX, unchanged at exactly its
floor score (7) for 3 consecutive full-panel rounds (R3, R5, R7) --
wins selection outright now that accessibility (previously tied at a
2-round streak) moved to 8 this round. Selected fix: the judge's own
explicit ranking calls per-card FAILED retry "the single worst
friction point" for this org's current data (8/8 FAILED) -- paired
with a Publish confirmation step (same file, same tier, no overlap
risk), both Tier 2 (contained interaction logic, no new page/route),
batched into one round per the batching rule.

## Round 8 outcome

Shipped via PR #764 (merged), across two commits:

1. **Per-card Retry**: `handleGenerate`'s logic was extracted into a
   shared `runGenerate(type)`, called by both the top Generate button
   (`selectedType`) and a new Retry button shown on every FAILED card
   for write-capable roles, using that report's own `type`. No more
   scrolling back to the shared control and re-selecting the type by
   hand.
2. **Publish confirmation dialog**: a shared `AlertDialog` (the same
   shadcn/Radix primitive used elsewhere in the codebase, e.g.
   `DeleteAlertModal.tsx`) now gates the publish mutation behind an
   explicit confirm/cancel instead of firing directly on click.
3. **Review-fix**: a review pass caught two real issues in the first
   commit -- (a) every FAILED card's Retry icon spun together whenever
   a generation was in flight (the shared global `isGenerating` flag),
   with no indication of which card was actually clicked; fixed with a
   `retryingId` tracking just the clicked card, while correctly
   leaving the shared-disable behavior alone (generation really is
   one-at-a-time server-side). (b) The original regression test used a
   FAILED report with the same type as `selectedType`'s own default,
   so it would have passed even against a broken implementation that
   retried with the wrong type -- fixed by using a distinguishing type.
   A second review pass confirmed the fix clean.

**QA**: lint clean, typecheck clean (same pre-existing, unrelated
TS2556 failure on `main`). Full suite: 1991/1991 passing, including 5
new/updated regression tests, each with a genuine negative control.

**Live verification**: Retry confirmed end-to-end against the real
backend -- clicked Retry on a FAILED card, confirmed a real
`POST /api/report/generate` fired with the report's own type. Publish
confirmation could not be live-click-tested against a real READY
report -- this preview environment's report generation still has a
~100% failure rate (the same pre-existing, unrelated limitation noted
in earlier rounds) -- relied on the unit tests instead, documented
rather than silently skipped.
