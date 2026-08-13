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
