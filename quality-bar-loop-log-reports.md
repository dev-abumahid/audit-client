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
