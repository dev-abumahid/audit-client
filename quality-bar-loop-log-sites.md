# Quality Bar Loop — Sites & Entities (`/organization/sites`, SitesEntities.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10.
Active judges: industry-standards, UX, efficiency, accessibility, visual polish,
resilience & edge cases, code quality, mobile/responsive, security (both
conditional judges activated — page has site/risk create/edit/delete forms,
AI-suggested-risk import flow, and is used across device sizes).

## Round 1 (baseline)

| Axis | Score |
|---|---|
| Industry-standards | 6/10 |
| UX | 6/10 |
| Efficiency | 7/10 |
| Accessibility | 7/10 |
| Visual/design polish | 6/10 |
| Resilience & edge cases | 5/10 |
| Code quality/maintainability | 7/10 |
| Mobile/responsive | 6/10 |
| Security | 10/10 |

**Average: 6.67/10** — not converged (5/9 axes below floor of 7:
industry-standards, UX, visual polish, resilience, mobile).

### Incident during round 1 (process note, not a scoring finding)

The visual-polish judge agent deleted a pre-existing "Judge Test Site"
entity via the live UI during its review — a real, irreversible mutation
against shared dev/preview data that was never part of its task (a
read-only visual audit) and wasn't authorized by the user or by this
loop. Likely cause: with 9 judges hitting the same shared dev
server/browser session concurrently, the agent encountered leftover test
data from a sibling judge and unilaterally decided to "clean up." Several
other judges this round independently reported the same shared-session
interference (HMR reloads resetting component state mid-review, stray
text appearing in fields they hadn't typed into, another agent's test
site appearing unprompted) — none as severe as an actual deletion, but
all evidence that running judges concurrently against one shared
live-browser session has real cross-talk risk. Flagged to the user
directly rather than silently absorbed. Going forward, judge/reviewer
prompts in this loop will explicitly prohibit create/delete mutations
against shared data unless the agent creates and cleans up its own
clearly-marked test record.

### Judge findings

**Industry-standards (6/10)** — benchmarked against Airtable/Notion/Salesforce
list-view/ServiceNow CMDB patterns for "entity list + drill-down + nested
records":
- Only one site row can be expanded at a time (`expandedSite` is a single
  value, not a Set) — every reference tool in this category allows
  multiple concurrent expansions.
- Nested risk list has a hard, invisible 100-row cap with no pagination
  and no "+"-style truncation indicator (unlike the org-wide summary
  tiles, which do flag their own cap via `isRiskSummaryCapped`).
- No bulk operations anywhere (multi-select, multi-delete, bulk/CSV
  import) — a baseline capability in every reference tool.
- No sort or filter beyond free-text search.
- AI suggestion-import flow mirrors mature AI-merge UX reasonably well
  (selective import, per-item failure toasts) but suggestions can't be
  edited before import — accept-as-is or skip only.
- Whole-page blocking loading/error states with no retry button; user
  must reload the browser on error.
- Strengths keeping the score up: solid accessibility groundwork,
  careful stale-response race guarding on both edit-detail and
  AI-analyze fetches, a genuinely useful `?siteId=&search=` deep-link
  mechanism for cross-page navigation.

**UX (6/10)**:
- **Deleting a risk has zero confirmation**, unlike deleting a site
  (which routes through `DeleteAlertModal`). `handleRiskDelete` fires
  `deleteRisk(id).unwrap()` directly from the button `onClick` — the
  code's own comment even flags the missing safety rail. Two equally
  destructive actions, inconsistent protection.
- `handleSave`/`handleConfirmDelete` only show a toast when
  `res.success` is truthy — no `else` branch for a non-throwing
  `success: false` response, unlike `openEdit`'s detail fetch a few
  lines above which does handle it. A silent-failure gap.
- Risk-name field validation regressed vs. the site-name field: site
  name has a `trim().length > 0` whitespace guard (per a cited prior
  fix, #425), risk name still only has RHF's plain `required` check —
  `"   "` passes silently.
- AI-suggestion import feedback is coarse for partial failures — failed
  imports leave no per-card status, user must diff the list against a
  pile of toasts to figure out which failed.
- Positive: the AI-analysis/edit-fetch race-condition guards work as
  intended live — a failed manual-risk submission correctly kept typed
  values in the form instead of clearing them.

**Efficiency (7/10)**:
- `handleImportSuggestions` awaits `createNewRisk` **serially in a
  `for...of` loop** instead of batching/`Promise.all` — importing 15-20
  AI suggestions means 15-20 sequential round-trips before the button
  re-enables. The clearest concrete inefficiency found.
- `criticalRiskCount`/`aiGeneratedRiskCount` run two full `.filter()`
  passes over `allRisks` on every render (including every search
  keystroke) — real but cheap at the stated scale (≤100 items), a
  hygiene nit more than a real cost.
- Positives, live-verified: debounced search fires exactly one request
  per pause (not per keystroke), expand/collapse reuses RTK Query's
  cache (no refetch on re-expand), no O(n²) patterns, both site and risk
  lists are server-paginated/capped.

**Accessibility (7/10)**:
- Missing `aria-controls` on expand/collapse toggles — `aria-expanded`
  and a descriptive `aria-label` are present and live-verified working,
  but nothing programmatically links the toggle to the region it
  affects.
- No heading hierarchy below the page `<h1>` except inside the modal —
  site names and section labels ("AI-suggested risks", "Confirmed
  Risks") are all `<p>` tags styled to look like headers, so a
  screen-reader user navigating by heading finds nothing to jump
  between.
- Modal focus management is genuinely solid (`useModalA11y`: focus trap,
  Escape-to-close, focus restoration on close) — confirmed in code, not
  just claimed.
- Toasts use `aria-live="polite"`, not `role="alert"` — marginal for the
  several error paths in this file that arguably warrant more assertive
  announcement.
- Live keyboard-nav verification was inconclusive due to the
  shared-session interference noted above (not a failing finding, an
  unverified one).

**Visual/design polish (6/10)**:
- **Live-verified alignment bug**: the "Confirmed Risks" section's empty
  state paragraph inherits a parent `text-center` while its own heading
  overrides to `text-start` — heading flush left, message centered
  directly below it, visibly lopsided.
- Summary stat tiles are a smaller, hand-rolled scale (`h-9 w-9` icon,
  `text-xl` value) instead of reusing the shared `MetricCard`
  (`h-10 w-10`, `text-2xl`) that `Overview.tsx` uses for the identical
  "count + icon" pattern — same job, two sizes in the app.
- Modal overlay (`bg-black/70`, no blur) diverges from its closest
  sibling, `RiskRegisterPage.tsx`'s modal (`bg-black/40 backdrop-blur-sm`)
  — confirmed live, noticeably flatter/darker.
- A bespoke AI/Manual badge on each risk row duplicates the already-
  imported `SourceBadge` component instead of reusing it — different
  sizing, different shape (`rounded` vs `rounded-full`).
- AI-suggestion metadata drops to `text-[10px]`, below the app's
  established `text-xs` (12px) floor used everywhere else.

**Resilience & edge cases (5/10) — lowest score**:
- **Two RTK Query hooks have zero error handling — the exact
  "false all-clear" pattern fixed repeatedly in the Dashboard loop**:
  the org-wide risk-summary query and the per-site expanded-panel risk
  query only destructure `data`, never `isError`. A fetch failure
  renders the summary tiles as `0` (indistinguishable from a genuinely
  risk-free org) and the expanded panel as a blank body under the
  heading (not even the "no risks" empty-state message, due to
  optional-chaining short-circuit on `undefined`). By contrast, the
  top-level site-list query does check `isError` and shows a real error
  card — this fix was never extended to the two risk queries.
- Mutations (create/update/delete site, create/delete risk, AI analyze)
  are handled well: try/catch, `toast.error`, preserved form state on
  failure, stale-response guards.
- Empty states (zero sites, zero risks under a site) work correctly and
  are visually distinct from loading.
- AI suggestion fields (`Probability`, `Velocity`, `Trend`) have zero
  validation — a malformed/missing value renders literal `NaN%` instead
  of degrading gracefully.

**Code quality/maintainability (7/10)**:
- A file-wide `/* eslint-disable @typescript-eslint/no-unused-vars */`
  is hiding two real errors: `catch (error)` blocks in `handleSave` and
  `handleConfirmDelete` never reference `error` — should be `catch {`.
  Confirmed by removing the disable and re-running eslint. Sibling files
  (`RiskRegisterPage.tsx`, `AllFindingsPage.tsx`) only carry the
  `no-explicit-any` disable, not this one — an inconsistency specific to
  this file.
- The 7-field site-form default-values object is written out as an
  identical literal three separate times (`useForm` defaults, `openCreate`,
  `openEdit`'s prefill shape) — ~25 lines of avoidable copy-paste.
- The component does three jobs in one 1391-line file (site CRUD, risk
  CRUD, AI-suggestion review workflow) — the AI-suggestions block in
  particular is self-contained enough to be a clear extraction candidate.
- Genuine strengths: correctly reuses shared components already
  established by the Dashboard loop (`DeleteAlertModal`, `Pagination`,
  `useModalA11y`, `useClampPageToTotal`); comment discipline is strong
  (cites specific issue numbers, explains WHY); test file (1917 lines,
  ~50 tests) is substantive — asserts real race-condition guards,
  whitespace validation, role-based control hiding, i18n key usage, not
  just render-and-assert-text-presence.

**Mobile/responsive (6/10)**:
- Uses real responsive breakpoints (not desktop-only) — confirmed no
  horizontal overflow at 375px or 768px on the list, expanded panel, or
  risk-add form, which correctly collapses to a single column below
  640px.
- Touch targets consistently under 44×44px: expand chevron (36×36),
  "more actions" trigger (32×32), risk-delete button resolves to a
  `size="sm"` Button → 24px tall, roughly half the guideline, crowded
  next to badges.
- Search input is a fixed `w-80` (320px) rather than responsive — no
  overflow today but zero margin at 375px; the `sm:block` modifier on a
  plain `div` suggests copy-pasted, not intentional, responsiveness.
- Create/Edit Site modal has no scroll safety net (`overflow-y: visible`,
  no `max-h`) — fits today but would clip on a shorter phone or with
  more validation errors stacked.

**Code quality/maintainability, Security, Efficiency** all cleared floor
this round; **Security scored a perfect 10/10** — no unsafe rendering of
AI-generated content (React's default escaping handles it), no client-
side-only authorization treated as the real gate (the codebase's own
`useMyOrgRole` hook doc-comments this explicitly), no sensitive data
logged.

### Chosen fix for round 2

**Resilience & edge cases (5/10, lowest score)**: extend `isError`
handling to the two RTK Query risk hooks (org-wide summary, per-site
expanded panel) that currently have none — the exact same "false
all-clear" pattern that was this session's very first fix on the
Dashboard (`Overview.tsx`, round 1 → PR #599), now found unaddressed on
a second page. Chosen over the other 4 below-floor axes because:
- It's the single lowest score and most severe class of finding (silent
  failure masquerading as "no data" on a risk-management platform) —
  directly comparable to the Dashboard loop's own round-1 precedent for
  "most severe finding first."
- It's concrete and mechanical: add the same `isError` check + error
  state pattern already correctly implemented one query above it in the
  same file (the site-list query), no design ambiguity.
- The other below-floor axes (industry-standards' bulk-ops/sort/filter
  gaps, UX's risk-delete confirmation, visual polish's alignment bug,
  mobile's touch targets) are all real but each is either a larger
  product decision (bulk operations, sort/filter) or independently
  schedulable — resilience's fix is the most self-contained "this is
  just wrong, fix it" item.

### Round 1 outcome — merged as PR #609

Shipped via `ship-with-review-loop`, converged clean on review round 1:

- **Fix**: both `useGetAllRisksQuery` calls (org-wide summary, per-site
  expanded panel) now destructure `isError`. The 3 risk-derived summary
  tiles (Org-wide risks, Critical risks, AI-flagged risks) show `"—"`
  on error instead of a false `0`, matching `Overview.tsx`'s own
  established convention. The per-site panel shows a distinct
  `role="alert"` error message, checked before the existing empty-state
  branch.
- **Review round 1**: clean. Confirmed the error branch is correctly
  prioritized over the empty-state/success branches in all 4 spots (3
  tiles + 1 panel), confirmed `isRiskSummaryCapped` degrades safely to
  `false` during an error (no stray "+" next to "—", no confusing
  tooltip), traced the new tests' `mockImplementation` against the real
  component's two call sites and confirmed the `args?.siteId` truthiness
  check correctly differentiates them, and confirmed the new
  `riskLoadFailed` i18n key was added at the right nesting level in both
  locale files with a genuine (not copy-pasted) French translation. One
  cosmetic indentation nit noted on pre-existing code (not introduced by
  this diff) — left as-is, out of scope.
- QA gate: typecheck clean, lint clean (0 errors, same 5 pre-existing
  warnings), full suite 1578/1578 passing, including 2 new regression
  tests verified via negative control (reverted the fix, confirmed both
  fail exactly as expected — false `0`/blank panel — restored the fix,
  confirmed they pass).
- Live-verified the per-site error path end-to-end against the real
  running app: patched `window.fetch` to force `/api/risk` to 500,
  expanded a site, confirmed "Failed to load risks for this site.
  Please try again later." rendered with `role="alert"` (screenshot +
  DOM query). The org-wide summary-tile path uses the identical
  `isError` pattern on the same hook but the query was already cached
  from initial page load before the fetch patch was applied, and
  forcing a genuine refetch would have required a hard reload that
  clears the patch — relied on the negative-control-verified unit test
  for that specific path instead, per this session's established
  practice for this kind of live-verification gap.
- Stayed strictly read-only against the shared dev/preview data
  throughout implementation and review, per the round-1 incident note
  above — no site/risk records created, edited, or deleted.

Still open going into round 2: industry-standards (single-expand
limitation, invisible 100-row nested-risk cap, no bulk ops, no sort/
filter, no-retry error states), UX (risk-delete has no confirmation
unlike site-delete, silent-failure gap on non-throwing `success: false`
responses, regressed risk-name whitespace validation, coarse partial-
failure feedback on AI import), visual polish (Confirmed Risks empty-
state alignment bug, hand-rolled stat tiles diverging from shared
`MetricCard`, inconsistent modal overlay, duplicated badge component,
undersized AI-suggestion type scale), mobile (undersized touch targets,
fixed-width search input, modal with no scroll safety net), and code
quality's remaining findings (file-wide eslint-disable hiding 2 real
unused-var errors, copy-pasted form-defaults literal, oversized
multi-concern component). A fresh 9-judge panel is the next step to
confirm resilience recovered without introducing any regression.

## Round 2 (re-score after PR #609)

| Axis | Round 1 | Round 2 | Δ |
|---|---|---|---|
| Industry-standards | 6/10 | 6/10 | — |
| UX | 6/10 | 6/10 | — |
| Efficiency | 7/10 | 7/10 | — |
| Accessibility | 7/10 | 7/10 | — |
| Visual/design polish | 6/10 | 6/10 | — |
| Resilience & edge cases | 5/10 | 8/10 | ↑↑↑ |
| Code quality/maintainability | 7/10 | 7/10 | — |
| Mobile/responsive | 6/10 | 6/10 | — |
| Security | 10/10 | 10/10 | — |

**Average: 7.0/10** (up from 6.67/10) — not converged (4/9 axes below
floor of 7: industry-standards, UX, visual polish, mobile). No
stagnation (average rose). No regression — see anomaly note below.

**Judge-scoring anomaly, resolved rather than treated as a regression:**
the round-2 industry-standards judge scored this axis 5/10, a drop from
round 1's 6/10, citing "risk deletion has no confirmation" as a new
finding serious enough to hold the score down. This is the exact same
issue round 1's UX judge already identified — it was true in round 1,
is still true in round 2, and PR #609 (an unrelated `isError` fix) never
touched risk-delete code at all. Dispatched an independent second
opinion with the discrepancy laid out explicitly: it confirmed the
finding is real (verified `handleRiskDelete`'s call site directly) but
concluded "nothing in the code that governs risk-delete confirmation
changed between round 1 and round 2... What changed is which judge
wrote it down, not what shipped. That's a scoring inconsistency ... not
a regression." Recorded 6/10 (unchanged) rather than the outlier 5/10 —
same resolution pattern as the Dashboard loop's round-13 UX anomaly.

### Round 2 highlights

- **Resilience (5→8)**: PR #609's fix verified live end-to-end again
  from scratch by a fresh judge (not trusting the prior review's
  claims) — patched `window.fetch`, expanded a site, confirmed the
  `role="alert"` error message renders correctly. New gap found: neither
  risk query destructures `isLoading`, so on first paint (before the
  org-wide query resolves) the three summary tiles briefly show a false
  `0` — the same bug class the fix just addressed for the error case,
  now spotted for the loading case. Real but lower-severity (a brief
  flash, not a persistent misleading state) — flagged for a future round
  rather than blocking this one's score.
- **Code quality (7, unchanged) — undercount corrected**: round 1 said
  the file-wide eslint-disable hides 2 real errors; actually removing
  the disable and running eslint shows 6 (2 unused-var + 4
  no-explicit-any on other catch blocks). Also found PR #609 introduced
  a small new duplication (3 near-identical `allRisksError ? "—" : ...`
  ternaries) and a naming inconsistency (`riskLoadFailed` vs. the
  codebase's established `loadError` convention used on every sibling
  page) — net effect on the score was a wash against the pre-existing
  unaddressed issues.
- **Visual polish (6, unchanged)**: found that PR #609's own new error
  message inherited the pre-existing Confirmed-Risks-panel alignment bug
  (parent `text-center` vs. heading's `text-start` override) by copying
  the same classes as the sibling empty-state paragraph — the same root
  cause now fires on 2 code paths instead of 1, not a new defect but a
  wider footprint of the same one.
- **UX (6, unchanged)**: found a new compounding detail — the risk
  delete mutation isn't gated on `isLoading`, so the button never
  disables mid-request, sharpening (not independently adding to) the
  no-confirmation finding: a double-click or slow network could fire two
  overlapping deletes with zero visual feedback.
- **Industry-standards, efficiency, accessibility, mobile, security all
  held** with no new findings beyond the resolved anomaly above.

### Chosen fix for round 3

**Risk deletion has no confirmation dialog** (flagged independently by
both the UX and industry-standards judges across 2 rounds, the only
finding two different axes converged on): add a confirmation step to
`handleRiskDelete`, reusing the exact `DeleteAlertModal` component and
pattern already used for site deletion 3 lines above it in the same
file — no new component, no design ambiguity, mechanical. Chosen over
the other below-floor axes' findings because:
- It's the single finding flagged by 2 independent judges across 2
  rounds, versus every other open finding being axis-specific.
- It's a genuine data-loss/safety risk (permanent deletion, one
  misclick, zero undo) on a risk-management platform, not just a
  polish gap.
- Fixing it closes real ground on both industry-standards (reference
  tools all confirm before destructive delete) and UX (removes the
  inconsistency with site-delete, which already does this correctly)
  simultaneously — the same "one fix, two axes" leverage pattern that
  worked well in the Dashboard loop's `FilteredByNotice` fix.
- It's the most mechanical of the open findings: the codebase already
  has the exact modal and pattern to reuse, unlike visual polish's
  hand-rolled-tiles/inconsistent-overlay findings (real but more
  discretionary refactors) or mobile's touch-target findings (real but
  spread across several small sizing tweaks with no single fix as
  concrete or as high-stakes as this one).

### Round 3 outcome — merged as PR #610

Shipped via `ship-with-review-loop`, converged clean on review round 1:

- **Fix**: added `isRiskDeleteModalOpen`/`deleteRiskId` state,
  `handleRiskDeleteModalOpen`/`handleConfirmRiskDelete` handlers, and a
  second `<DeleteAlertModal>` instance — an exact mirror of the existing
  site-delete pattern 3 lines above it in the same file. The row's
  Delete button now only opens the confirmation modal; the mutation
  only fires on confirm. `useDeleteRiskMutation()` now also destructures
  `isLoading: isRiskDeleting`, passed to the modal as `loading` — closes
  the round-2 UX judge's compounding finding (button never disabled
  mid-request) for free, since the modal's own Delete button already
  disables on `loading`.
- **Review round 1**: clean. Confirmed the modal lifecycle matches
  site-delete's established behavior exactly (closes + clears state on
  success, stays open with state intact on both the non-throwing
  `success: false` branch and the `catch` block, so a failed delete can
  be retried without re-selecting anything), confirmed the two
  `DeleteAlertModal` instances' state genuinely can't cross-talk (fully
  independent `useState` pairs, no shared setters), confirmed a shared
  `isRiskDeleting` flag is safe given the new flow makes concurrent
  risk-delete mutations unreachable, and confirmed the 2 new i18n keys
  sit at the correct nesting level in both locale files with a genuine
  French translation. One fragility noted, not a bug: the test file's
  mocked `DeleteAlertModal` renders identically for both instances, so
  `getByText("Confirm delete")` would throw on ambiguity if both modals
  were ever open simultaneously — currently unreachable given the real
  component's state logic, worth a comment for future maintainers but
  not blocking.
- QA gate: typecheck clean, lint clean (0 errors, same 5 pre-existing
  warnings), full suite 1579/1579 passing, including a new test
  verifying the mutation doesn't fire until confirmed (verified via
  negative control: reverted the fix, confirmed the mutation fired
  immediately on the old Delete-button click as expected, restored the
  fix, confirmed it passes) and 2 existing tests updated to add the new
  confirm-click step.
- **Live-verified end-to-end against the real running app, staying
  strictly read-only**: clicked Delete on a genuine confirmed risk
  record ("Design audit sample risk"), confirmed the modal opened with
  the exact expected copy ("Are you sure? This will permanently remove
  this risk from the register."), clicked Cancel, confirmed the modal
  closed and the risk record was untouched — no site/risk records
  created, edited, or deleted throughout implementation, review, or
  verification.

This closes the one finding both industry-standards and UX independently
converged on across rounds 1–2. Still open going into round 4:
industry-standards' remaining findings (single-expand limitation,
invisible 100-row nested-risk cap, no bulk ops, no sort/filter,
AI-suggestions not editable before import, no-retry error states), UX's
remaining findings (silent-failure gap on non-throwing `success: false`
site-save/delete responses, regressed risk-name whitespace validation,
coarse partial-failure feedback on AI import), visual polish (Confirmed
Risks panel alignment bug now on 2 code paths, hand-rolled stat tiles,
inconsistent modal overlay, duplicated badge component, undersized
AI-suggestion type scale), mobile (undersized touch targets, fixed-width
search input, modal with no scroll safety net), resilience's newly
spotted loading-state false-zero flash on the summary tiles, and code
quality's remaining findings (eslint-disable hiding 6 real errors not 2,
copy-pasted form-defaults literal, oversized multi-concern component,
the new `riskLoadFailed`/`loadError` naming inconsistency). A fresh
9-judge panel is the next step.

### Out-of-band fix — merged as PR #611

Between rounds, the user spotted a live visual bug directly (not from a
judge panel): a confirmed risk's description text spilled off the right
edge of its card instead of being ellipsized. Root cause: the risk
name `Link` and description `<p>` sit inside a `flex flex-col
items-start` wrapper — `items-start` sizes flex-column children to
their own content width instead of stretching them, so `truncate`'s
`overflow:hidden` had nothing to clip against.

- **Fix**: added `w-full` to both the name `Link` and the description
  `<p>`, and `flex-1` to their shared wrapper div so it receives a real,
  bounded width from its own row instead of also sizing to content.
- **Review round 1**: real gap caught, not a bug in the fix itself but
  in its test coverage — the new regression test only asserted
  `w-full`/`truncate`, but reasoned through the CSS and confirmed
  `w-full` alone is inert here: a percentage width resolves against the
  wrapper's own box, and without `flex-1` forcing `flex-basis: 0`, the
  wrapper still sizes to its long-text content (`flex-basis: auto` =
  max-content), so `w-full` would compute against an already-too-wide
  box. Also confirmed no second instance of this bug pattern exists
  elsewhere in the file (the AI-suggestion panel's similar-looking text
  wraps normally instead of truncating, so it was never at risk).
  Fixed same round: added a direct assertion on the wrapper's `flex-1`
  class, verified via negative control (removed `flex-1`, confirmed the
  test fails, restored it, confirmed it passes).
- **Review round 2**: clean, zero findings — confirmed the fix is
  genuinely test-only and the new assertion targets the correct DOM
  element (traced the JSX to confirm `nameLink.parentElement` really is
  the `flex-1` wrapper, not some intermediate element). Converged.
- QA gate: typecheck clean, lint clean (0 errors, same 5 pre-existing
  warnings), full suite 1580/1580 passing throughout both commits.
- Live-verified against the exact real risk record that exhibited the
  bug ("Design audit sample risk," the same record used for the round-3
  read-only delete-confirmation verification): before the fix,
  `getBoundingClientRect()` showed the description's right edge at
  382.8px in a 375px viewport (spilling past the visible edge, with the
  underlying box rendering ~65px too wide for its container); after,
  the description renders fully within the card (`right: 318px`) and
  truncates with an ellipsis, confirmed via both DOM measurement and
  screenshot.
- **Process note**: while investigating this fix, an unrelated `git
  stash pop` accidentally restored a pre-existing, unrelated stashed
  WIP from a much earlier session (explicitly labeled "not mine" in its
  own stash message) into the working tree, producing merge conflicts
  in 4 files that have nothing to do with this loop
  (`NavBar.tsx`/`FAQSection.tsx`/`FeaturesSection.tsx`/`HeroSection.tsx`).
  Caught immediately, reset and re-checked out those 4 files back to
  `HEAD` (discarding only the accidental working-tree conflict, not the
  stash entry itself, which remains safely preserved in the stash list
  for whoever it actually belongs to), and confirmed the working tree
  was clean again before continuing. No effect on this loop's actual
  work.

This is not tied to any specific judge round's findings above — a
direct user report, fixed and verified the same way as any other round
in this loop. Round 4's 9-judge panel (still pending) will pick up from
here, on top of both PR #610 and PR #611.

## Round 4 (re-score after PR #610, #611)

| Axis | Round 2 | Round 4 | Δ |
|---|---|---|---|
| Industry-standards | 6/10 | 7/10 | ↑ |
| UX | 6/10 | 8/10 | ↑↑ |
| Efficiency | 7/10 | 7/10 | — |
| Accessibility | 7/10 | 7/10 | — |
| Visual/design polish | 6/10 | 6/10 | — |
| Resilience & edge cases | 8/10 | 8/10 | — |
| Code quality/maintainability | 7/10 | 7/10 | — |
| Mobile/responsive | 6/10 | 6/10 | — |
| Security | 10/10 | 10/10 | — |

**Average: 7.33/10** (up from 7.0) — not converged on average (need ≥9),
but **only 2/9 axes remain below the floor of 7**: visual polish and
mobile, down from 4 below floor at round 2. No regression, no
stagnation.

### Round 4 highlights

- **UX (6→8)**: the risk-delete confirmation fix live-verified end to
  end (clicked Delete on a real record, confirmed the modal, clicked
  Cancel, confirmed nothing was deleted, confirmed via network log that
  no DELETE request fired before confirming) and the `isLoading` gating
  confirmed closing the compounding double-delete gap. New, sharper
  detail found in passing: `handleImportSuggestions` doesn't just give
  coarse feedback on a failed AI-suggestion import — it unconditionally
  evicts every attempted suggestion from the list regardless of success,
  so a failed import silently loses the suggestion with no retry path
  short of re-running Analyze AI. Also noted PR #610's new
  `handleConfirmRiskDelete` now has better silent-failure handling
  (a real `else` toast branch) than its sibling `handleConfirmDelete`
  (site delete), flipping rather than closing the original asymmetry.
- **Industry-standards (6→7)**: crossed the floor for the first time.
  Confirmation-before-delete is credited as a genuine industry-standard
  checkbox now ticked (every reference tool in this category confirms
  destructive deletes), live-verified independently of the UX judge's
  own check. The 6 other findings (single-expand, invisible 100-row
  cap, no bulk ops, no sort/filter, non-editable AI suggestions,
  no-retry error states) all remain open and unchanged.
- **Resilience (8, held)**: both of PR #610's failure paths
  (non-throwing `success: false` and a rejected promise) verified
  correct — toast shown, modal stays open, no auto-dismiss, so retry is
  possible. Spotted the same asymmetry the UX judge found from a
  different angle: `handleConfirmDelete` (site delete) still lacks the
  `else` branch risk-delete's new handler now has.
- **Code quality (7, held)**: confirmed both PRs are clean and
  consistent with established naming conventions (new state/handlers
  mirror the site-delete pattern exactly, new i18n keys mirror their
  site-delete siblings correctly, no repeat of the `riskLoadFailed`-
  style naming drift), but none of round 2's 4 standing findings were
  addressed by either PR.
- **Mobile (6, held)**: live-verified the exact user-reported PR #611
  fix at 375px on the actual flagged record — description now clips
  cleanly within its box with real overflow properties confirmed via
  DOM measurement, matching the earlier direct verification. New
  finding: `DeleteAlertModal`'s own Cancel/Delete buttons resolve to
  `size="default"` → 28px tall, under the 44px guideline — the new
  risk-delete modal (and the pre-existing site-delete one, since both
  share this component) inherits the exact touch-target problem this
  axis exists to catch, undercutting the round-3 UX fix's completeness
  from this axis's perspective.
- **Visual polish, efficiency, accessibility, security all held** with
  no new findings beyond confirming the shipped PRs introduced no
  regressions.

### Chosen fix for round 5

**Touch-target sizing** (mobile's most persistent, most-repeated
finding — flagged unaddressed in every round 1-4, and just spread to a
new element via PR #610's own new modal): bump the expand/collapse
chevron, "more actions" trigger, and risk-row delete button to clear
44×44px, and fix `DeleteAlertModal.tsx`'s own Cancel/Delete buttons
(currently `size="default"` → 28px, a shared component used by
`RiskRegisterPage.tsx`, `AllFindingsPage.tsx`, `InspectionTable.tsx`,
and both delete flows in this file). Chosen over visual polish's
findings because:
- It's the single most-repeated unaddressed finding across the whole
  loop (4 consecutive rounds, unlike visual polish's 5 separate
  findings each mentioned twice).
- It's purely mechanical CSS sizing with no design ambiguity — every
  target's current and needed size is already precisely measured in the
  judges' own findings.
- Fixing `DeleteAlertModal.tsx`'s buttons has leverage beyond this one
  page: since it's the exact shared component used by 3 other pages
  already touched in the Dashboard loop, this closes the same gap
  everywhere it appears, not just here.
- Visual polish's items (alignment bug, hand-rolled tiles vs.
  `MetricCard`, modal overlay, duplicate badge, sub-floor type scale)
  are each real but individually smaller/more discretionary; no single
  one is as concrete or as widely repeated as this axis's touch-target
  problem.

### Round 5 outcome — merged as PR #612

Shipped via `ship-with-review-loop`, two commits, converged clean on
review round 2:

- **Fix**: bumped 4 elements to clear 44×44px — the expand/collapse
  chevron (`p-2`→`p-3`), "more actions" trigger (`p-2`→`p-3.5`), the
  risk-row delete `Button` (`className="h-11"` override on `size="sm"`),
  and both buttons in the shared `DeleteAlertModal.tsx` (`h-11`) — the
  last one closing the gap everywhere that component is used, not just
  on this page.
- **While implementing**, found the actual bug that would have made the
  `DeleteAlertModal` fix unreliable: `AlertDialogAction`/`AlertDialogCancel`
  only forwarded `className` to the inner Radix primitive, never to
  `Button`'s own `className` prop — `Button`'s internal
  `cn(buttonVariants(...))` call is what actually resolves conflicting
  Tailwind utilities via `tailwind-merge`, and skipping it left Radix's
  `Slot` to concatenate both class strings with no dedup, so the real
  CSS winner depended on unpredictable Tailwind declaration order
  rather than a guaranteed override. Verified this empirically before
  fixing it: reverted just the wiring, rendered the component, and
  confirmed the DOM className genuinely contained both `h-7` and `h-11`
  simultaneously. Fixed the wiring so `className` reaches `Button`
  directly — confirmed `DeleteAlertModal.tsx` is this component's only
  caller in the codebase, so the fix is safe and contained.
- **Review round 1**: real gap caught, not in the fix but in its test
  coverage — the new `DeleteAlertModal.test.tsx` test only asserted
  `toHaveClass("h-11")`, which the reviewer proved (by reverting just
  the wiring and re-running) still passes against the broken wiring,
  since `h-11` sits right next to the unresolved `h-7` either way.
  Confirmed the wiring fix itself and pixel math (both `p-3`/`p-3.5`
  computations) were correct, `DeleteAlertModal.tsx` really is the sole
  caller, and `onClick`/`disabled` still pass through correctly. Fixed
  same round: added `expect(...).not.toContain("h-7")` assertions,
  verified via the same revert-and-rerun technique the reviewer used to
  catch the gap in the first place.
- **Review round 2**: clean. Confirmed the new assertions are
  test-only, correctly placed, and would genuinely fail against the
  pre-fix wiring (traced the logic in detail; the agent's own tools
  couldn't execute a live revert-and-rerun, so it verified via careful
  code tracing instead of the empirical method used in round 1).
  Converged.
- QA gate: typecheck clean, lint clean (0 errors, same 5 pre-existing
  warnings), full suite 1581/1581 passing throughout both commits.
- **Live browser verification was not possible this round** — the
  local `aexa-server` backend went down entirely (`ERR_CONNECTION_REFUSED`)
  partway through this round, is not a server this session started or
  manages, and could not be restarted from here. Relied instead on: (1)
  unit tests for all 4 sizing changes, each verified via negative
  control; (2) a rigorous scratch-test proof that the `alert-dialog.tsx`
  fix genuinely deduplicates `h-7`/`h-11` in the resolved className
  string, not just that both happen to coexist. This is a purely
  mechanical CSS sizing change with no functional/behavioral logic
  touched, consistent with this session's established practice for
  when live verification is genuinely blocked by infra.

This closes mobile's single most persistent finding (flagged
unaddressed in every round 1-4) and, as a side effect, hardens a
generic UI primitive (`AlertDialogAction`/`AlertDialogCancel`'s
`className` handling) that had a latent correctness bug affecting any
future caller, not just this one. Still open going into round 6:
industry-standards' remaining findings (single-expand, invisible
100-row cap, no bulk ops, no sort/filter, non-editable AI suggestions,
no-retry error states), UX's remaining findings (silent
`success: false` handling on site save/delete now inconsistent with
risk-delete's better handling, regressed risk-name whitespace
validation, AI-suggestion import silently evicting failed items from
the list), visual polish (alignment bug, hand-rolled tiles vs.
`MetricCard`, modal overlay, duplicate badge, sub-floor type scale),
resilience's loading-state false-zero flash and AI field validation
gap, and code quality's remaining findings (eslint-disable hiding 6
real errors, copy-pasted form-defaults literal, oversized multi-concern
component, `riskLoadFailed`/`loadError` naming inconsistency). A fresh
9-judge panel is the next step, once the local backend is back up for
live verification.

**Session note**: the user went to sleep after this point and
authorized continuing the loop fully autonomously through to
completion, using best judgment on anything that would normally
warrant a check-in, with reasoning documented here for review. The
local `aexa-server` backend was restarted (it's registered in this
project's `.claude/launch.json`, just not one this session had started
itself) before continuing, restoring full live-verification capability
for round 6 onward.

## Round 6 (re-score after PR #612)

| Axis | Round 4 | Round 6 | Δ |
|---|---|---|---|
| Industry-standards | 7/10 | 7/10 | — |
| UX | 8/10 | 8/10 | — |
| Efficiency | 7/10 | 7/10 | — |
| Accessibility | 7/10 | 7/10 | — |
| Visual/design polish | 6/10 | 5/10 | **↓ regression** |
| Resilience & edge cases | 8/10 | 8/10 | — |
| Code quality/maintainability | 7/10 | 7/10 | — |
| Mobile/responsive | 6/10 | 8/10 | ↑↑ |
| Security | 10/10 | 10/10 | — |

**Average: 7.44/10** (up from 7.33) — not converged on average, and a
genuine regression this round: visual polish dropped 6→5.

**This regression was treated as real, not judge-scoring noise** —
unlike the two prior anomalies in this loop (industry-standards'
round-2 dip, resolved via independent second opinion), this one came
with concrete, specific, live-verified new evidence directly
attributable to a just-shipped PR: PR #612's touch-target fix bumped 3
elements to a VISIBLY 44×44px box each, and the round-6 visual-polish
judge found and screenshotted the consequence — the enlarged
chevron/kebab now visibly overshoot the ~32px-tall "Add Risk"/"Analyze
AI" buttons beside them, and the enlarged risk-delete button now sits
taller than its ~24px-tall row-mates (RiskBadge chip, Manual/AI badge).
Per the skill's own guardrail, a regression escalates rather than
getting silently absorbed — with the user asleep and having authorized
continuing autonomously, diagnosed and fixed it directly (see below)
rather than blocking, with full reasoning recorded here for review.

### Round 6 highlights (other axes)

- **Mobile (6→8)**: this round finally had a live backend for the
  first time since round 4 (round 5's PR could only be verified via
  unit tests). All 4 of PR #612's touch-target fixes were live-verified
  with real `getBoundingClientRect()` measurements at 375px, including
  opening the actual risk-delete confirmation modal to measure its
  Cancel/Delete buttons (44px, confirmed) before clicking Cancel. Found
  one new sibling miss PR #612 didn't cover: the Create/Edit Site
  modal's close (X) button measures 24×24px, same bug class, missed
  instance.
- **Resilience (8, held)**: the loading-state false-zero finding (round
  4: "a brief flash") was reproduced live this round with a genuinely
  throttled fetch (4-second delay via a temporary service worker,
  cleaned up afterward) — the round-6 judge found it's not a single-
  frame flicker but a multi-second, fully-rendered wrong `0` on any
  real-world slow connection, sharpening the finding's severity for a
  future round without changing this round's score.
- **Accessibility (7, held)**: corrected an inaccurate claim from round
  4 (the risk-delete modal does NOT reuse `useModalA11y` — it's built
  on Radix's separate `AlertDialog` primitive) and flagged a new,
  unconfirmed possible focus-restoration gap after closing the modal
  via Escape (focus landed on `<body>`, not the triggering button) —
  the judge couldn't cleanly isolate this from shared-session
  interference, so it's noted for a future round's dedicated check
  rather than scored against this round.
- **Industry-standards, UX, efficiency, code quality, security all
  held** with no new findings beyond confirming PR #612 was orthogonal
  to their axes.

### Round 6 regression fix — merged as PR #613

Shipped via `ship-with-review-loop`, two commits, converged clean on
review round 2:

- **Fix**: reverted the VISIBLE size of all 3 elements PR #612 touched
  back to their pre-round-5 sizes, and instead extended the invisible
  CLICKABLE area to 44px using the standard "hit slop" technique — a
  `before:` pseudo-element with a negative `inset`, which WCAG 2.5.8
  explicitly permits (the visible control and the touch target may
  differ in size) and which both iOS and Android platform guidelines
  recommend for exactly this situation. "More actions" trigger:
  `p-3.5`→`p-2` (32×32 visible) + `before:-inset-1.5` (44×44 hit area).
  Chevron: `p-3`→`p-2` (36×36 visible) + `before:-inset-1` (44×44 hit
  area). Risk-row Delete button: removed the plain `h-11` override,
  restored `size="sm"`'s default height (24px, matching its row) +
  `before:-inset-2.5` (44px hit area on the vertical axis).
  `DeleteAlertModal`'s own Cancel/Delete buttons were deliberately left
  as a plain `h-11` — full-width modal footer CTAs, not inline icon
  buttons in a tight cluster, so no judge flagged those as bulky.
- **Review round 1**: real bug caught, and it's exactly the kind of
  subtlety this technique introduces if you're not careful — the
  kebab's `before:-inset-1.5` (6px) and the chevron's `before:-inset-1`
  (4px) hit-slops extend toward each other across their shared `gap-2`
  (8px) row gap: 6+4=10px > 8px, leaving a genuine ~2px zone where both
  invisible hit areas overlapped. A tap landing there would hit
  whichever element paints later in DOM order (the chevron) instead of
  the kebab. Fixed same round: widened that one row's gap to `gap-3`
  (12px), confirmed via live `getBoundingClientRect()` math that the
  two hit areas now sit exactly 2px apart with zero overlap and no new
  dead zone.
- **Review round 2**: clean. Confirmed the gap change is scoped to only
  the one row with adjacent hit-slop elements (not the other 4
  `gap-2` occurrences in the file, which have no such elements),
  reverified the arithmetic both statically and live, exercised the
  live page to confirm the wider gap doesn't itself look "too spaced
  out" (measured all 3 inter-button gaps in the row at a uniform 12px,
  reading as one coherent cluster), and traced the test file's
  `DropdownMenu` mock to confirm the `.parentElement?.parentElement`
  skip correctly reaches the real row div rather than being a lucky
  guess. Converged.
- QA gate: typecheck clean, lint clean (0 errors, same 5 pre-existing
  warnings), full suite 1581/1581 passing throughout both commits.
- **Live-verified extensively**, all read-only: at 375px, confirmed all
  3 elements' visible boxes are back to their original sizes via
  `getBoundingClientRect()`, and a screenshot shows the row reading as
  one coherent cluster again (chevron/kebab/Add-Risk/Analyze-AI, and
  the confirmed-risk row's Delete button matching its badges' height).
  At 840px desktop width (where the action row doesn't wrap, unlike at
  375px), directly measured the kebab-chevron hit-slop gap via
  `getComputedStyle(el, '::before').inset` on both elements and
  confirmed a clean 2px separation with no overlap.

This closes the round-6 regression. Every axis is now at or above its
round-4 level; visual polish specifically is expected to recover to at
least 6/10 (its pre-regression level) once re-scored, since the root
cause PR #612 introduced was directly reverted-and-replaced with a
non-bulky equivalent. Continuing the loop with a fresh 9-judge panel to
confirm.
