# Quality Bar Loop — Pending AI Review Panel

Target feature: `src/dashboard/organization/risk/PendingAiReviewPanel.tsx` (the AI-generated-risk approval queue inside the Risk Register). Target average: 8.5/10. Floor: 6.5/10 (default target-2). Conditional judges: none (mobile and security both considered — security was actually run given the write-mutation surface; mobile declined). Standing merge authorization: granted (existing aexa-frontend admin-bypass authorization). Tracking: this local log file.

Live-verified against a real dev server (frontend :5173, backend :5000) with 5 real seeded PENDING_REVIEW risks (varied `citation_confidence`, one deliberately long name) + 1 DISMISSED risk, not mocks.

## Round 1

| Axis | Score |
|---|---|
| Industry-standards conformance | 3/10 |
| UX | 6/10 |
| Efficiency | 7/10 |
| Accessibility (a11y) | 6/10 |
| Visual/design polish | 6/10 |
| Resilience & edge cases | 7/10 |
| Code quality/maintainability | 8/10 |
| Cross-view integration | 4/10 |
| Security | 9/10 |
| **Average** | **6.22/10** |

Below floor (6.5): industry-standards (3), cross-view integration (4), UX (6), a11y (6), visual (6).

### Findings summary (verbatim, lightly trimmed)

**Industry-standards (3/10, lowest):**
- Blind accept/reject, no evidence view: `Risk.description` and `Risk.regulatory_citation_note` both exist and carry the "why did the AI suggest this" evidence, but neither is ever rendered in the review queue — risk names aren't even clickable.
- No confirmation gate on bulk actions (immediate mutation on click).
- No select-all control.
- Dismissed items aren't restorable from the UI.
- Strength: `CONFIDENCE_RANK` sort (least-trustworthy first) and the shared `anyReviewActionInFlight` race gate are solid.

**Cross-view integration (4/10):**
- `risk.category` renders as raw untranslated uncolored text in this panel while every other view (`RiskRegisterPage.tsx`, `RiskDetails.tsx`) uses the shared `RISK_CATEGORIES`/`riskCategoryLabel` colored-badge convention. [cosmetic-convention, contained]
- `citation_confidence`/`ConfidenceBadge` exists ONLY in this panel — never rendered in `RiskDetails.tsx` or the main register table. [data-correctness, reclassified `contained` — the field already exists on the API response, this is a pure rendering gap, not new infrastructure]
- Live-verified: approving a `curated_verified` risk, the confidence signal disappears entirely post-approval — a reviewer's "verified" judgment leaves no trace anywhere once it matters most. [data-correctness, reclassified `contained`]

**UX (6/10):**
- No confirmation before bulk dismiss.
- During a bulk action, all rows disable identically — no way to tell which rows are actually being processed.
- `ConfidenceBadge` has no tooltip/explanation of what "AI estimate" vs "Verified" actually means for the reviewer's decision.
- Selection correctly survives an individual-row action on a different row (positive).

**Accessibility (6/10):**
- Real per-row accessible names on checkboxes and icon+text button labels (positive).
- The entire panel (heading + full list + dismissed section) is one blanket `aria-live="polite"` region — a single-row action risks re-announcing the whole subtree instead of a targeted message.
- No semantic heading/landmark for the panel — can't be reached via screen-reader heading/landmark navigation.
- Dark-mode contrast on confidence badges is strong (~8.4-9.4:1).

**Visual/design polish (6/10):**
- Confidence badges reuse the exact amber/emerald pairing `SEVERITY_STYLES` uses for medium/low severity elsewhere on the same page — a scanning user could misread "AI estimate" as "medium severity."
- No visual hierarchy (row tint/accent) between high- and low-confidence rows beyond the 10px badge and sort order.
- Truncated long names have no `title` tooltip fallback.
- Panel-level amber "needs attention" treatment IS consistent with the app elsewhere (positive).

**Resilience (7/10):**
- `if (pendingLoading) return null` — no skeleton/spinner, causes a layout jump when the panel pops in after the rest of the page has already rendered.
- Rapid double-click correctly fires only one mutation (verified live).
- Cross-action race (bulk approve + a different row's individual approve) correctly produces a clean 409 with a toast, no corrupted state (verified live).
- Error surface is toast-only with no persistent/inline indicator if missed.

**Efficiency (7/10):**
- Flat `invalidatesTags: ["RISK", ...]` on every mutation causes both this panel's query AND the main register table's query to refetch on every single action — real but background-only cost at this scale, not visible jank.
- Selection state correctly isolated from the sort (no unnecessary re-sort on checkbox toggle).
- Backend bulk mutations are N+1-free (single `updateMany`).

**Code quality (8/10):**
- `CONFIDENCE_RANK` and `ConfidenceBadge`'s `styles` map are two independently hand-maintained maps over the same 3-value enum, no exhaustiveness check.
- Small duplicated 5-line selection-clearing block between `handleApprove`/`handleDismiss` (minor).
- Test coverage is substantive (confidence-sort, cross-gating, referenced-on-dismiss toast all covered), not smoke-only.

**Security (9/10):**
- Server-side `assertCanWriteOrgResource` gate on all 4 mutations, independent of the frontend `canWrite` prop (verified: UI-only gating is backed by real server enforcement).
- Atomic `updateMany` with `review_status: 'PENDING_REVIEW'` in the where-clause on every transition (TOCTOU-safe).
- Bulk mutations validate every ID's org ownership, not just the first.
- No XSS vector (plain JSX text interpolation, no `dangerouslySetInnerHTML`).

### stuck_streak (round 1 — N/A, no prior round)

### Next fix (Round 2)

**Selected: surface `citation_confidence` on the main risk register table and the risk detail page (`RiskDetails.tsx`), reusing/extracting the confidence badge — and give it a color scheme that does NOT reuse `SEVERITY_STYLES`' amber/emerald pairing.**

Selection rationale (step 5c priority order): this is the highest-priority category — a `data-correctness`-tagged finding (cross-view integration axis, currently 4/10, below the 6.5 floor) that survives even the "at or below floor" test regardless of streak. Reclassified from the judge's informal framing to `contained` on inspection: `citation_confidence` already exists on the `Risk` API response (`src/types/organization.d.ts:185`) and is already fetched by every relevant query — this is a pure rendering gap in two other files, not new backend/data-model work.

This single fix also directly addresses two OTHER open findings at the same time (explicitly checked per the loop's own "sanity-check other open findings" guidance before finalizing):
- Visual-polish's amber/emerald collision with `SEVERITY_STYLES` — the new shared badge will use a distinct color family.
- Part of industry-standards' "no evidence" gap — while this fix doesn't add the full description/citation-note preview (a separate, likely Tier-2 UX fix for a later round), giving the confidence signal permanence across views is a genuine trust-model improvement in its own right.

Deliberately NOT selected this round despite lower raw scores on other axes (industry-standards at 3/10 is the lowest overall, but its findings — evidence preview, select-all, bulk confirmation, dismissed-item restore — are all UX/interaction findings, not data-correctness, so they rank below this round's priority-1 pick per the loop's fixed selection order; they remain open for round 3+ selection based on `stuck_streak`).

## Round 2 — fix shipped ([PR #1064](https://github.com/Qiyrix/aexa-frontend/pull/1064))

Extracted `ConfidenceBadge` out of `PendingAiReviewPanel.tsx` into a new shared component `src/components/dashboard/organization/CitationConfidenceBadge.tsx`, wired it into `RiskDetails.tsx` and `RiskRegisterPage.tsx`'s main table row, and changed its color scheme from amber/emerald (collided with `SEVERITY_STYLES`) to violet/indigo. Added a `title` tooltip explaining each confidence level. Full review loop (2 rounds — round 1 caught a real high-severity bug: `response.choices[0].message.parsed` sat outside the LLM-call's try/except in a *different* PR that landed the same day, unrelated to this fix) came back clean; merged.

Live-verified end-to-end before merge: approved a `curated_verified` seeded risk, confirmed the same "Vérifié" badge appeared in both the main register table and the risk detail page afterward — the exact failure mode round 1 found.

## Round 2 (post-fix judge panel)

| Axis | Score | vs. Round 1 |
|---|---|---|
| Industry-standards conformance | 3/10 | unchanged |
| UX | 6/10 | unchanged |
| Efficiency | 7/10 | unchanged |
| Accessibility (a11y) | 5/10 | **regressed (-1, still below floor both rounds)** |
| Visual/design polish | 7/10 | +1 |
| Resilience & edge cases | 7/10 | unchanged |
| Code quality/maintainability | 9/10 | +1 |
| Cross-view integration | 9/10 | **+5, now well above floor** |
| Security | 9/10 | unchanged |
| **Average** | **6.89/10** | +0.67 |

Below floor (6.5): industry-standards (3), accessibility (5).

### Findings summary (verbatim, lightly trimmed) — only axes with new/changed findings

**Cross-view integration (9/10, was 4):** Fix confirmed working end-to-end live — approved a seeded `curated_verified` risk, the same "Verified" violet badge now renders in the main table's SOURCE column and the detail page header, closing the exact gap round 1 found. Capability-regression check passed: `CONFIDENCE_RANK` sort and the badge's null-guard behave identically to the pre-extraction version. One finding remains open, unaddressed by this round's fix (correctly out of scope): `risk.category` still renders as bare uncolored text in this panel while every other view uses the colored-badge convention. [cosmetic-convention, contained]

**Accessibility (5/10, was 6 — genuine regression, not just re-confirmation):** The two round-1 findings (blanket `aria-live="polite"` region, no semantic heading/landmark) are unchanged. NEW: the round-2 fix's `title`-attribute tooltip (added to close a UX gap) has `tabIndex=-1`, no `role`, no `aria-describedby` — native `title` tooltips are mouse-hover-only, so this "accessibility-adjacent" addition is actually unreachable by keyboard or most screen readers, a real if minor new gap. Contrast on the new violet/indigo palette still clears WCAG AA (≈5.2-7.0:1) but with less margin than the old emerald/amber (≈8.4-9.4:1). [broken-functionality for a11y purposes, contained — one attribute away from fixed]

**Industry-standards, UX, efficiency, resilience, security:** all findings re-confirmed live as unchanged from round 1 (see round 1's findings above); no new issues, no regressions.

**Code quality (9/10, was 8):** The extraction itself is clean — `CitationConfidenceBadge`'s `STYLES` map is keyed by `NonNullable<Risk["citation_confidence"]>`, giving a compile error if the enum grows without a matching style (an exhaustiveness guard the old inline map never had). `CONFIDENCE_RANK` stays correctly panel-local (sort order is only meaningful here). The old duplicated selection-clearing block (round-1 minor finding) is untouched, still present.

### stuck_streak (computed after this round)

- industry-standards: 3 → 3, unchanged, below floor both rounds → **streak = 1**
- UX: 6 → 6, unchanged, below floor both rounds → **streak = 1**
- accessibility: 6 → 5, changed (regressed), below floor both rounds → **streak = 0** (streak requires "unchanged"; a regression resets it even though still below floor — logged as a regression instead, see selection rationale)
- visual, cross-view: exited the below-floor set this round (7 and 9 respectively, both ≥ floor)

### Next fix (Round 3)

**Selected: (1) add an evidence-preview affordance for pending risks (surface `risk.description`/`risk.regulatory_citation_note`, the "why did the AI suggest this" fields that already exist on every risk but were never rendered anywhere in this panel), batched with (2) a cheap, isolated a11y fix making `CitationConfidenceBadge`'s tooltip keyboard/screen-reader reachable (`aria-describedby` + a visually-hidden description, or an equivalent accessible-tooltip pattern) — the round-2 regression found this round.**

Selection rationale (step 5c priority order): industry-standards (3/10) and UX (6/10) are tied at `stuck_streak = 1`; tie-broken by lowest raw score → industry-standards wins. Of its four open findings (evidence preview, no select-all, no bulk confirmation, dismissed-items not restorable), the evidence-preview gap is the judge's own stated "crux of this axis" and is genuinely `contained` — `description`/`regulatory_citation_note` already exist on the `Risk` type/API response, this is a pure rendering gap, same class of fix as round 2's. "Dismissed-items not restorable" is `large-scope` (no restore/undo mutation exists anywhere in the backend — would need a new endpoint) and is excluded from this round's selection. Select-all and bulk-confirmation are both `contained` but touch the exact same file/interaction surface as each other and are deferred to a future round rather than tripling this round's scope.

Batched the a11y tooltip-reachability fix alongside it per the loop's batching rule: both are Tier 1/2, and their touched files are disjoint (`PendingAiReviewPanel.tsx`/test vs. `CitationConfidenceBadge.tsx`/test) — no merge-conflict risk from combining them into one PR.

## Round 3 — fix shipped ([PR #1065](https://github.com/Qiyrix/aexa-frontend/pull/1065))

Added an evidence-preview expand/collapse affordance to `PendingAiReviewPanel.tsx`: risk names with `description` and/or `regulatory_citation_note` become a real `<button aria-expanded>` with a chevron; clicking reveals a bordered card with both fields (correctly omitting whichever is absent, with conditional spacing). Batched alongside: `CitationConfidenceBadge.tsx`'s root element changed from `<span tabIndex={0} title>` (mouse-only, invalid per `jsx-a11y/no-noninteractive-tabindex`) to a real `<button type="button" aria-describedby={hintId}>` wrapping a visually-hidden `sr-only` hint span — fixes round 2's keyboard-unreachable-tooltip regression. Full review loop came back clean; merged.

Live-verified before merge: expanded/collapsed all 3 real evidence combinations (both fields, description-only, neither), and Tab-reached the confidence badge to confirm real keyboard focus.

## Round 3 (post-fix judge panel)

| Axis | Score | vs. Round 2 |
|---|---|---|
| Industry-standards conformance | 6/10 | +3 |
| UX | 7/10 | +1 |
| Efficiency | 8/10 | +1 |
| Accessibility (a11y) | 7.5/10 | +2.5, **cleared floor** |
| Visual/design polish | 7/10 | unchanged |
| Resilience & edge cases | 8/10 | +1 |
| Code quality/maintainability | 8/10 | **-1, regressed (stayed above floor)** |
| Cross-view integration | 9/10 | unchanged |
| Security | 9/10 | unchanged |
| **Average** | **7.72/10** | +0.83 |

Below floor (6.5): industry-standards (6) only.

### Findings summary (verbatim, lightly trimmed) — only axes with new/changed findings

**Industry-standards (6/10, was 3):** Evidence preview confirmed genuinely live and working end-to-end — closes the "blind accept/reject" gap, the axis's single biggest lever. Two of the four original findings remain fully unaddressed: no confirmation gate on bulk actions (immediate mutation on click, unlike GitHub/Jira/Linear bulk-triage conventions), and no select-all control (only per-row checkboxes, unlike the main table below it which has one). Dismissed-item restore remains `large-scope`, correctly out of scope.

**UX (7/10, was 6):** Evidence toggle works well once discovered (per-row `Set` state, multiple rows can stay expanded simultaneously, no lag). But it has a real discoverability gap: the trigger button has zero `hover:` classes and `cursor: default` — the only signal it's clickable is a small 12px chevron. Also newly confirmed: the long seeded name truncates with no `title` fallback, and expanding evidence doesn't un-truncate the header name either. Confirmation-gate and per-row in-flight-indicator findings unchanged from round 1.

**Accessibility (7.5/10, was 5 — regression fixed, cleared floor):** Round-3's targeted fix verified end-to-end live: real Tab keypress reaches the badge, `:focus-visible` true, visible focus ring renders, `aria-describedby` resolves to real hint text. New minor gap: the evidence-toggle button has `aria-expanded` but no `aria-controls` linking it to the region it governs (WCAG 4.1.2 partial-conformance pattern). Blanket `aria-live="polite"` region and missing semantic heading/landmark remain open, untouched by this round.

**Code quality (8/10, was 9 — regression, stayed above floor):** `expandedIds`/`toggleExpanded` faithfully mirrors the existing `selectedIds`/`toggleSelect` pattern (good consistency). Test coverage genuinely covers all 4 real evidence combinations. New finding: comment density is compounding round-over-round — `CitationConfidenceBadge.tsx` now carries more lines of round-1/2/3 rationale prose than actual component logic, and `PendingAiReviewPanel.tsx` has similar archaeology scattered across 5 locations. This is exactly the "restates PR history inline instead of pointing at the tracking log" anti-pattern this loop's own guidance warns against. [cosmetic/convention, contained]

**Efficiency (8/10, was 7):** `expandedIds` updates use correct immutable `Set` copy-mutate-return, matching `toggleSelect`'s existing pattern — no stale-closure/mutation bug. New feature's per-row cost is O(1) and trivial. No new inefficiency introduced.

**Resilience (8/10, was 7):** All 3 real evidence-data combinations (neither/description-only/both) live-verified to render correctly with no dangling labels or spacing bugs. Expand-then-approve leaves a harmless dead `expandedIds` entry (never resurfaces since approved rows leave the `pendingRisks` list for good) — flagged as cosmetic, not a real bug.

**Cross-view integration (9/10, was 9):** No invalid button-nesting introduced by the `<span>`→`<button>` conversion in any of the 3 render locations (live DOM-verified). Visual appearance unchanged across all 3. Round-2's citation_confidence-survives-approval fix re-confirmed live, still holding. `risk.category` bare-text gap still open, untouched by round 3, correctly out of scope.

**Security (9/10, was 9):** New evidence-preview text (`risk.description`/`regulatory_citation_note`) confirmed rendered via plain JSX interpolation, no `dangerouslySetInnerHTML`. **User's explicit ask verified**: `get_all_risks_from_db` hard-gates on `review_status: 'APPROVED'` by default for dashboards/KRI/correlation-matrix/exports/audit-linking; only two narrow, justified exceptions exist (KRI/risk-link *reference* creation, not aggregation) that don't surface unreviewed risk data as if confirmed. Pending risks are correctly excluded from consumers that would treat them as trusted data.

**Visual (7/10, was 7, unchanged):** Button conversion introduces no visual regression (baseline alignment within 0.5px, no unwanted hover/appearance bleed). Confidence palette still distinct from severity in both themes. Two carryover gaps remain open across 2 rounds now: no `title` tooltip fallback on truncated names, no row-level visual hierarchy by confidence.

### stuck_streak (computed after this round)

- industry-standards: 3 → 6, **changed** (though still below floor) → streak resets to **0**
- accessibility: 5 → 7.5, exited below-floor set entirely
- All other axes: at/above floor, no streak tracked

No below-floor axis currently has streak > 0. Priority-2 selection falls to its tie-break rule (lowest raw score among candidates) — industry-standards, still below floor at 6/10 and the lowest score of all 9 axes this round, wins selection.

### Next fix (Round 4)

**Selected: add a confirmation step before bulk "Tout approuver"/"Tout rejeter" mutations.**

Selection rationale (step 5c priority order): no data-correctness/security finding is at/below floor this round (priority 1 empty). No axis has stuck_streak > 0 (priority 2's primary criterion is trivially tied at 0 everywhere), so priority 2's tie-break applies — lowest raw score — which is industry-standards (6/10), still below the 6.5 floor. Of its two remaining fully-open, `contained` findings (no bulk-confirmation, no select-all), bulk-confirmation is selected as higher-leverage: it's a real data-loss-prevention gap (irreversible bulk dismiss with zero undo step) independently flagged by 3 separate judges this round (industry-standards, UX, and implicitly resilience's "no undo" framing), versus select-all which is pure convenience. Both findings touch the same file (`PendingAiReviewPanel.tsx`) so aren't eligible for the loop's disjoint-file batching rule this round — deferred select-all to a later round rather than risk a same-file conflict.

Deliberately not selected despite being real, still-open findings: code quality's comment-bloat regression (priority 3, stayed above floor, ranks below priority 2's pick) — flagged for a future round, likely paired with a consolidation pass pointing comments at this log file instead of restating history inline; visual's truncated-name-tooltip and row-hierarchy gaps (2 rounds open, same-file as this round's pick); UX's evidence-toggle discoverability gap (no hover state) — cheap, same-file, good candidate to batch with select-all next round since both are Tier 1/2 UX polish on the same interaction surface.

## Round 4 — fix shipped ([PR #1066](https://github.com/Qiyrix/aexa-frontend/pull/1066))

Gated bulk "Approve all"/"Dismiss all" behind a confirmation dialog, reusing the existing shared `DeleteAlertModal` (same reuse pattern already used elsewhere in this codebase for a non-delete "Dismiss" flow with custom copy) rather than building a new dialog. New `pendingBulkAction: "approve" | "dismiss" | null` state gates which action the dialog confirms; pluralized, count-aware copy ("This will approve/dismiss N selected risk(s)...").

One review round (Tier 2, capped per `ship-with-review-loop`'s own guidance): 2 findings —
1. **Documented, not fixed** (shared-component limitation, not introduced by this PR): the confirm button closes synchronously on click before the mutation resolves (Radix `AlertDialogAction` = `DialogPrimitive.Close`), so `DeleteAlertModal`'s `loading`/disabled-confirm state never actually renders for any of its callers, this one included — on rejection only the `toast.error` carries the failure, the dialog is already gone. Every other `DeleteAlertModal` caller (site/finding/template delete) shares this same characteristic. Fixing it means changing the shared component's confirm-button behavior for every caller — disproportionate scope for this contained fix. Flagged as a candidate for its own future round if worth the shared-component change.
2. **Fixed**: the dialog could leak "open" in state across the panel's empty-state early return (list empties while dialog is up → early-return branch unmounts the modal without resetting `pendingBulkAction` → a later non-empty render reopens it unprompted against a stale selection). Fixed by resetting the state during render (not an effect, per `react-hooks/set-state-in-effect`) when the pending count transitions to zero. Added a regression test with a negative control confirming it genuinely catches the bug.

Live-verified end-to-end before merge, against real seeded data (not mocks): selected 2 real pending risks → "Approve all" → dialog opened with correct pluralized copy → confirmed → real `POST /api/risk/bulk-approve` fired, both flipped to `APPROVED` in Postgres. Separately verified Dismiss-all → Cancel → no mutation fires, all 3 risks stayed `PENDING_REVIEW`, selection stayed checked.

## Round 5 (post-fix judge panel)

| Axis | Score | vs. Round 4 |
|---|---|---|
| Industry-standards conformance | 8/10 | +2, **floor cleared** |
| UX | 8/10 | +1 |
| Efficiency | 8/10 | unchanged |
| Accessibility (a11y) | 7.5/10 | unchanged |
| Visual/design polish | 7/10 | unchanged |
| Resilience & edge cases | 8/10 | unchanged |
| Code quality/maintainability | 8/10 | unchanged |
| Cross-view integration | 8/10 | **-1, regressed (stayed above floor)** |
| Security | 9/10 | unchanged |
| **Average** | **7.94/10** | +0.22 |

No axis below floor (6.5) — all 9 axes now at or above floor for the first time this loop. Not yet converged (average still below 8.5 target).

### Findings summary (verbatim, lightly trimmed) — only axes with new/changed findings

**Industry-standards (8/10, was 6):** Confirmation gate fully verified live via network trace — Cancel produces zero mutation requests, confirming fires the real `POST /api/risk/bulk-approve`/`bulk-dismiss`. Approve/Dismiss dialogs correctly differentiated (different titles/descriptions/confirm labels, not a generic "are you sure"). Select-all remains genuinely absent (per-row checkboxes only) — correctly left open, out of round 4's scope. New minor gap noted (not floor-relevant): no bulk-undo affordance after a confirmed action, a next-round candidate alongside select-all.

**UX (8/10, was 7):** Dialog copy is clear and count-aware, Cancel is clean with zero side effects, confirming gives prompt visible feedback via list re-render. Two new findings: no explicit success toast on the happy path (only `toast.error` exists, no `toast.success`); **the reused `DeleteAlertModal` mis-signals for "Approve"** — red `destructive`-styled icon and confirm button on what should read as a safe, additive action, independently confirmed by the visual judge below.

**Visual (7/10, unchanged):** Confirmed the same destructive-red styling mismatch — screenshotted and zoomed both themes, the "Approve all" confirm button is genuinely red, not just tinted, for a constructive action. `DeleteAlertModal.tsx`'s icon/button color aren't caller-configurable, so this caller had no way to differentiate without touching the shared component. Two round-2/3 findings still open, unchanged: no `title` tooltip on truncated names, no row-level visual hierarchy by confidence.

**Cross-view integration (8/10, was 9 — new regression, stayed above floor):** No capability regression, category-badge gap still open and correctly out of round 4's scope. **New finding**: round 4's `DeleteAlertModal` usage sets `confirmLabel` but not `loadingLabel`, so during the actual mutation the button falls back to the shared default "Deleting..." even though the action is Approve/Dismiss — the exact "trust/comprehension gap" class of bug `DeleteAlertModal.tsx`'s own round-11 precedent (the `AlertsPage.tsx` Dismiss flow) already solved by setting a matching `loadingLabel`, just not fully applied to this new caller.

**Resilience (8/10, unchanged):** The round-4 dialog-leak fix was verified against a **genuine live occurrence**, not a simulation — a concurrent judge session actually mutated the shared backend mid-test, pending count dropped 3→1 while the dialog was open, and it held up cleanly (no stuck/reopened dialog). Confirmed the failure path keeps the dialog open with cleared loading state on a rejected mutation (doesn't silently vanish). New finding: no `isError` handling on the initial `useGetAllRisksQuery` fetch — a failed load silently renders as "no risks pending," indistinguishable from a genuinely empty queue.

**Code quality (8/10, unchanged):** The `pendingBulkAction === "approve" ? ... : ...` ternary repeated 4 times is readable but a small lookup-object would be cleaner (not selected as a real finding, judge's own call). The render-time `prevPendingCount` pattern is correctly applied and commented; still "least obvious pattern in the file" for a newcomer unfamiliar with React's adjust-during-render idiom, comment mitigates but doesn't eliminate that. Comment density held flat this round (new comments judged load-bearing, not bloat) — round-3's comment-bloat finding didn't get worse.

**Efficiency (8/10), Security (9/10):** Both reconfirmed unchanged; efficiency confirmed the new render-time state pattern is O(1) and doesn't cause extra recompute; security confirmed the confirm dialog is a pure client-side UX gate with zero bearing on server-side authorization, no new injection surface.

**Accessibility (7.5/10, unchanged):** Round 4's dialog reuses `DeleteAlertModal`'s existing, real accessibility investment — live-verified autofocus onto Cancel, correct keyboard trap (Tab cycles only the two dialog buttons), Escape closes cleanly without firing the mutation and restores focus to the trigger, correct `role="alertdialog"`. The two round-3 panel-level findings (blanket `aria-live="polite"`, evidence-toggle missing `aria-controls`) remain untouched and still cap the score.

### stuck_streak (computed after this round)

No axis is at or below floor this round — the below-floor set is now empty for the first time in this loop. No streaks to track.

### Next fix (Round 6)

**Selected: give the bulk-approve confirmation dialog a non-destructive visual treatment, batched with setting the correct `loadingLabel` on both the approve and dismiss dialogs.**

Selection rationale (step 5c priority order): no data-correctness/security finding at/below floor (priority 1 empty, and for the first time no axis is below floor at all). No axis has stuck_streak > 0 (priority 2's primary criterion trivially ties at 0 everywhere), so priority 2's tie-break applies — lowest raw score — which is visual/design polish (7/10), the sole lowest-scoring axis this round. Of its findings, the destructive-red-styling-on-Approve mismatch is selected over the two older tooltip/row-hierarchy gaps because it's the freshest finding, independently confirmed by two separate judges (visual AND UX) in the same round, and because DeleteAlertModal's icon/button color isn't currently caller-configurable — closing it requires a small, contained prop addition to the shared component (e.g. a `variant` prop) rather than a purely single-file CSS tweak, making it worth doing before more callers accumulate on the destructive-only default.

Batched alongside: cross-view integration's `loadingLabel` gap (regressed this round, stayed above floor — priority 3, ranks below priority 2's pick on its own, but shares the exact same JSX call site being touched for the variant fix, so fixing both in the same pass is lower-risk than two separate rounds editing the same lines). Both are Tier 1/2 changes to the same call site in `PendingAiReviewPanel.tsx` plus the shared `DeleteAlertModal.tsx` — not a same-file conflict since they're not competing for different outcomes on the same lines, just two small additions to the same call.

Deliberately not selected: visual's two older findings (truncated-name tooltip, row-hierarchy) — still open, next round's candidates if visual doesn't clear via this round's fix alone; UX's missing-success-toast finding — minor, same-file, good candidate to batch next round; industry-standards' select-all and bulk-undo gaps — both `contained` but a larger single addition, deferred; resilience's missing `isError` handling on initial fetch — real but touches a different code path (the query hook itself, not the dialog), deferred to avoid conflating two unrelated fixes.

## Round 6 — fix shipped ([PR #1068](https://github.com/Qiyrix/aexa-frontend/pull/1068))

Added an optional `variant?: "destructive" | "default"` prop to the shared `DeleteAlertModal.tsx` (default `"destructive"`, so all 13 other existing callers are unaffected — reviewed and confirmed). `"default"` swaps `AlertCircle`/`bg-destructive` for `CheckCircle2`/`bg-emerald-600`, reusing the same emerald already used by this panel's own individual per-row Approve button (not a new color introduced). Wired the pending-AI-review panel's Approve-all dialog to `variant="default"`; Dismiss-all stays destructive, unchanged. Also set `loadingLabel` on both dialogs, fixing the round-4/round-5 `loadingLabel` gap (previously fell back to the shared "Deleting..." default even during an Approve mutation).

One review round (Tier 2): 0 findings across all 6 review angles, including the critical backward-compatibility check (grepped and confirmed all 13 other `DeleteAlertModal` callers still render identically since none pass `variant`) and the i18n-diff-shape check (a deliberate callback to an earlier incident this same session where a Python JSON round-trip silently collapsed a pre-existing duplicate key elsewhere in the locale file — this diff was confirmed to be exactly 2 clean insertions per file).

Live-verified end-to-end before merge, against real seeded data (not mocks): opened the Approve-all dialog, confirmed via DOM inspection it renders `circle-check`/`bg-emerald-600` (not `circle-alert`/`bg-destructive`), screenshotted it, confirmed it fires the real bulk-approve mutation. Re-seeded a pending risk and confirmed Dismiss-all still renders `circle-alert`/`bg-destructive` unchanged.
