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
