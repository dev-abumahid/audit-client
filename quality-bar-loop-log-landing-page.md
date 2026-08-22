# Quality Bar Loop — Public Landing Page (`/`, `src/pages/home/`)

Target: average >= 9/10, every axis >= 7/10 floor. No max-round cap.
Active judges: industry-standards, UX, efficiency, accessibility, visual/design
polish, resilience & edge cases, code quality, mobile/responsive (security judge
skipped — page is static marketing content; the sign-up/sign-in modals it
triggers are shared auth components covered elsewhere, not this page's own
surface).

User framing for this loop: "with an emphasis on visuals" — every judge is
instructed to actually exercise the live page at real desktop width (1440px)
before scoring, not just read source or rely on a narrow browser pane, per a
same-day incident where a shipped fix looked fine in a narrow capture but was
visibly broken (dead space, duplicate content) at real width.

Standing merge authorization: auto-merge for the whole loop (per prior
established aexa-frontend admin-bypass authorization).

## Round 1 (baseline)

| Axis | Score |
|---|---|
| Industry-standards | 6/10 |
| UX | 8/10 |
| Efficiency | 8/10 |
| Accessibility | 9/10 |
| Visual/design polish | 7/10 |
| Resilience & edge cases | 8/10 |
| Code quality/maintainability | 6/10 |
| Cross-view integration | 7/10 |
| Mobile/responsive | 8/10 |

**Average: 7.44/10** — not converged (industry-standards 6, code quality 6, both below floor of 7).
stuck_streak: all axes 0 (round 1, no history).

### Judge findings

**Industry-standards (6/10):**
- Claimed the "Same register, scoped access" demo moment (`ProductDemoSection.tsx`, `DemoMoment`) is stranded left with ~40-45% dead void at 1440px. **Verified myself via `getBoundingClientRect()` and REFUTED**: the moment column measures 768px wide with symmetric 333px margins on both sides in a 1434px section — centered, not stranded. Likely a stale/blank-screenshot artifact (this session's Browser pane has repeatedly produced blank captures after fast scrolls, confirmed harmless multiple times today).
- No customer-logo "trusted by" strip beneath the hero (category norm per Vanta/Drata/Secureframe) — large-scope, can't fabricate real customer logos honestly (no real customers yet).
- Testimonials have no photo/avatar, just role + generic industry — reads closer to "example use case" copy than testimonial-format social proof.
- FAQ accordion and lack-of-public-pricing both match category norm — not findings.

**UX (8/10):**
- KRI slider, Connected Data Model click-to-highlight, and FAQ accordion all deliver exactly what their copy promises, live-verified via DOM state.
- Real gap: "Switch roles" demo's own heading says "watch the interface change," but switching Admin→Lead Auditor shows an *identical* table — only Light User actually changes anything. Small credibility gap in an otherwise honest demo.
- Sign-up modal is a real, functional CTA (org name/email/password/Google SSO), not a dead button.
- Flagged (not scored as confirmed): a few real mouse clicks vs. programmatic clicks behaved differently on 3 different buttons — couldn't conclusively pin on the site vs. the automation tool; noted as a residual unknown, not a defect.

**Efficiency (8/10):**
- `LandingRiskMatrixWidget.tsx` `buildGrid()` and `RiskGraphWidget.tsx` `buildNodes()`/`computePageRank()` are unmemoized, recomputing on every render (verified live: double-fires on click). Inert today at n=4-25 items, but a real missing-memoization gap.
- **This project has no React Compiler** (`vite.config.ts` only registers `@vitejs/plugin-react`, no `babel-plugin-react-compiler` anywhere) — several code comments (`useRevealOnScroll.ts`, `KriThresholdSliderWidget.tsx`) explicitly claim auto-memoization from "this codebase's React Compiler" that doesn't actually run at build time. `eslint-plugin-react-hooks` v7 does bundle some React-Compiler-derived *lint rules* (hook-correctness only, no runtime transform) — the comments conflate the two. Worth a comment-accuracy correction, low urgency.
- `useRevealOnScroll` itself is well-designed (disconnects after firing once, no observer churn).

**Accessibility (9/10):**
- Exactly one h1, clean heading nesting verified live via `document.querySelectorAll('h1,h2,...')`.
- KRI slider is a real `<input type="range">` — full native keyboard support confirmed (arrow keys change value + status chip live).
- Role-switcher radiogroup has real ARIA APG roving-tabindex, arrow-key nav confirmed live.
- Risk matrix cells are real `<button>`s with `aria-pressed`/`aria-label`, visible focus rings confirmed.
- FAQ accordion has proper `aria-expanded`/`aria-controls`, keyboard-operable.
- All decorative crops consistently `aria-hidden`.

**Visual/design polish (7/10):**
- **Real, precisely-measured finding**: the two demo moments (`ProductDemoSection.tsx:236-251`) use `mx-auto max-w-3xl` (768px), but the file's own comment claims this matches "FAQSection's max-w-4xl (896px), ConnectedDataModelSection's max-w-5xl (1024px)" — both are actually wider. The centering fix (earlier today) solved the worse stranded-left bug but under-shot the width vs. the very sections it claims consistency with. Confirmed via `getBoundingClientRect()`.
- `FeaturesSection.tsx`'s 3x2 grid has unequal visual weight: top row (3 cards) gets rich illustrative mockups, bottom row (3 cards) gets only an icon + text, despite being presented as parallel items.
- Everything else (hero, How It Works row, static demo rail, testimonials, FAQ, final CTA, footer) is genuinely well-executed — consistent radii/borders/spacing/contrast, no other issues found.

**Resilience & edge cases (8/10):**
- Real sign-up flow (validation errors, real backend call, OTP flow) all handled cleanly; one stray copy nit ("Invalid OTP, Please try again!!" double exclamation).
- Risk matrix empty-cell state, role-switcher's read-only caption, and FAQ accordion all degrade gracefully.
- `useRevealOnScroll` has real reduced-motion/no-IntersectionObserver fallbacks (verified in source).
- Whole page is JS-required with no `<noscript>` fallback — real but pre-existing SPA-wide architecture characteristic, not landing-page-specific.

**Code quality/maintainability (6/10):**
- `npm run typecheck`/`eslint src/pages/home`/`vitest run src/pages/home` all clean (82/82 tests) — objective signal is good.
- Severe comment-cruft: `RiskGraphWidget.tsx`, `KriThresholdSliderWidget.tsx`, `KriTrendWidget.tsx`, `LandingRiskMatrixWidget.tsx`, `ProductDemoSection.tsx` all carry multi-line "Review finding on PR #XXXX" / "Phase E redesign" / "Landing overhaul PRx" blocks — permanent forensic design-log prose violating this repo's own stated "terse what+why, not round-by-round history" convention.
- `LandingRiskMatrixWidget.tsx:56-65` comment describes a "standalone register/KRI moments' matrix predecessor" mount point that no longer exists in the current tree (stale after the matrix-consolidation PR).
- Sibling `productDemo/` widgets have no shared `WidgetProps`-style type for the repeated `{ animate?: boolean }` shape — a small missed extraction.

**Cross-view integration (7/10):**
- Risk-matrix coloring, KRI status legend, and role-permission gating all import the SAME real shared functions the authenticated app uses (`riskMatrixCalc.ts`, `kriConfig.ts`'s `KRI_STATUS_META`, `useMyOrgRole.ts`'s `canWriteOrgResource`) — not re-implementations. Verified via grep + both call sites.
- **Real capability regression** (tagged `broken-functionality`): today's matrix-consolidation commit (`e7c60a3`) deleted the old static `RiskMatrixWidget.tsx`, which had an always-visible Critical/High/Medium/Low color legend. Its replacement (`LandingRiskMatrixWidget` in the rail) has no equivalent — a visitor who never clicks a cell now has no way to read what the color gradient means, while its two rail siblings (Risk Correlation, KRI Trend) both still show always-visible legends.
- Role list intentionally omits VIEWER, matching existing public marketing copy — not a bug.

**Mobile/responsive (8/10):**
- No horizontal overflow at 375px or 768px (verified via `scrollWidth`/`clientWidth`).
- Nav correctly swaps to hamburger below `lg`; static rail stacks cleanly with `items-start` (no dead space).
- Interactive widgets (matrix cells ~62px, role pills, native range slider) all comfortably tappable at 375px.
- Decorative desktop-only connector SVGs are `hidden lg:block` with no orphaned gap.
- One honest gap: couldn't fully verify the mobile hamburger menu's open state due to shared-dev-server contention from other concurrent judges (viewport kept getting reset by other judges' resize calls) — noted as unverified, not flagged as a defect.

### Fix selected for round 1

Lowest-scored axes (tied at 6, below floor): industry-standards, code quality. Roster-order tie-break selects **industry-standards**. Its headline finding (stranded-left dead void) is refuted, but visual-polish's independent, more precisely measured finding in the *same file/section* is real and unrefuted — the demo-moment column is narrower than the very sections its own comment claims to match. Fixing this serves industry-standards' underlying (if imprecisely stated) concern and visual-polish's precise one at once.

Batched with a second, non-file-overlapping Tier 1/2 fix: cross-view integration's real capability-regression finding (missing color legend on the now-interactive rail matrix widget), touching `LandingRiskMatrixWidget.tsx` only — disjoint from `ProductDemoSection.tsx`, safe to batch per the skill's same-round batching rule.

Code quality's comment-cruft cleanup is real and will be picked next round — it touches `ProductDemoSection.tsx`, which this round's fix also touches, so batching it now would risk merge conflicts within the same round.

**Shipped as [PR #1029](https://github.com/Qiyrix/aexa-frontend/pull/1029)**, merged, deployed, live-verified on qiyrix.com (legend text + max-w-4xl class confirmed via DOM).

### Round 2 scoping

Diff confined to 2 files (`ProductDemoSection.tsx`, `LandingRiskMatrixWidget.tsx`), no existing test assertions changed (only new tests added), full pre-existing suite passed unmodified. Narrow-scoped per the skill's cost-saving rule: re-running only the axes whose findings this round's diff was meant to address —
**industry-standards, visual/design polish, cross-view integration** (all three cited this exact section), plus **code quality** (this round's diff also fixed 2 of its flagged stale comments, though the broader comment-cruft sweep across `RiskGraphWidget.tsx`/`KriThresholdSliderWidget.tsx`/`KriTrendWidget.tsx` remains untouched).

Carried forward unchanged (zero code overlap with this round's diff): UX (8), efficiency (8), accessibility (9), resilience & edge cases (8), mobile/responsive (8).

## Round 2

| Axis | Score | Δ | stuck_streak |
|---|---|---|---|
| Industry-standards | 7/10 | +1 | 0 |
| UX | 8/10 (carried forward) | — | 0 |
| Efficiency | 8/10 (carried forward) | — | 0 |
| Accessibility | 9/10 (carried forward) | — | 0 |
| Visual/design polish | 8/10 | +1 | 0 |
| Resilience & edge cases | 8/10 (carried forward) | — | 0 |
| Code quality/maintainability | 6/10 | 0 | 1 |
| Cross-view integration | 9/10 | +2 | 0 |
| Mobile/responsive | 8/10 (carried forward) | — | 0 |

**Average: 7.89/10** (up from 7.44) — not converged (code quality 6, below floor of 7; every other axis now clears the floor).

### Judge findings (re-scored axes only)

**Industry-standards (6→7):** width fix confirmed live and correct (896px column matching FAQSection exactly). New observation: `ConnectedDataModelSection.tsx` uses an even narrower `max-w-3xl` (768px) inside its own `max-w-5xl` outer container — a third width value in play across the page's "moment" sections; visually fine today (compact node diagram, not a text/card block) but worth a follow-up width-rhythm pass if pursued further. Logo wall and testimonial-photo findings still open, unchanged.

**Visual/design polish (7→8):** width fix verified via `getBoundingClientRect()` — 896px matching FAQSection exactly, centered correctly (269px/275px margins, 6px delta is scrollbar width). Inner card now genuinely fills the column (894px vs 896px shell, the 2px gap is the intentional 1px gradient border each side) — round 1's "widened outer, still-narrow inner" failure mode does not recur. No new stretching/sparseness introduced in the register table or KRI slider at the wider width. FeaturesSection card-parallelism finding re-confirmed, still open.

**Cross-view integration (7→9):** legend fix verified live — always visible, no click needed, colors confirmed matching between legend dots and matrix cells (both sourced from the same `SEVERITY_STYLES`). Hunted for other capabilities dropped by the same-day matrix-consolidation commit — grepped for all deleted i18n keys, confirmed zero dangling references anywhere in `src/`. All three cross-view consistency checks (risk-matrix coloring, KRI status, role gating) re-confirmed intact.

**Code quality (6, unchanged, stuck_streak=1):** the two comment trims from round 1 (`ProductDemoSection.tsx`, `LandingRiskMatrixWidget.tsx`) confirmed as genuine readability improvements, not just relocation. The bulk of the flagged comment-cruft — `RiskGraphWidget.tsx` (~31 lines across 4 blocks), `KriThresholdSliderWidget.tsx` (3 blocks), `KriTrendWidget.tsx` (2 blocks) — remains completely untouched. **New finding**: the round-1 legend fix's own comment in `LandingRiskMatrixWidget.tsx` ("...deleted in favor of this one, see PR #1028...") reintroduced the exact "see PR #NNNN" forensic-citation pattern the round was meant to reduce — a small, self-inflicted regression in the same session. Shared `WidgetProps` type gap still open.

### Mid-loop user feedback — reprioritized ahead of the mechanical pick

User reviewed a reference mockup of the static 3-widget rail (equal-height cards, no dead space) and gave direct feedback: doesn't like that the three rail cards (Risk Matrix / Risk Correlation / KRI Trend) are different heights. This is a direct consequence of the `items-start` fix shipped days before this loop started (chosen specifically to eliminate a real dead-space bug in the KRI Trend card, at the cost of uneven bottom edges).

Per this loop's own principle of responding immediately to user redirection, this took priority over the mechanical round-3 pick (which would have been code quality, per stuck_streak). Root-cause fix, not a re-introduction of the old bug: each of the three rail widgets became its own `flex h-full flex-col` with its closing legend/results-panel wrapped in `mt-auto`, so when the grid returns to `items-stretch` (equal heights), the extra stretched space is absorbed by the flex gap pushing the footer down — not left as a trailing empty rectangle. Verified live via `getBoundingClientRect()`: all three cards now measure exactly 529.35px (equal), and the gap between each card's last element and its bottom edge is exactly 20px everywhere (the shell's own `p-5` padding, not dead space).

Code quality's fix (the comment-cruft sweep) is deferred to round 3.

## Round 3

Selected fix per mechanical priority: code quality is the only axis below floor (6/10, stuck_streak=1 after round 2) -- its own remaining findings are the fix.

Trimmed comment-cruft (multi-line "Review finding on PR #XXXX" / "Phase E redesign" blocks) to terse what+why in the 4 files the judge explicitly named:
- `RiskGraphWidget.tsx` -- 5 blocks trimmed (top-of-file, non-null-assertion rationale, PageRank-tie rationale, strokeWidth-match rationale, fillOpacity-match rationale).
- `KriThresholdSliderWidget.tsx` -- 4 blocks trimmed, including a real factual correction: one comment claimed "this codebase's React Compiler" auto-memoizes an array literal at runtime -- false (no `babel-plugin-react-compiler` anywhere in this build, confirmed in round 1's efficiency judge findings). Corrected to state the array simply isn't memoized (harmless, since the hook diffs by value). Cross-checked `useRevealOnScroll.ts`/`useCountUp.ts`'s similar-sounding comments -- both correctly scope the claim to the real `eslint-plugin-react-hooks` v7 lint rule, not a runtime transform, so left unchanged.
- `KriTrendWidget.tsx` -- 2 blocks trimmed.
- `LandingRiskMatrixWidget.tsx` -- 5 blocks trimmed, including round 2's own self-inflicted "see PR #1028" regression, plus two comments that had gone stale after round 1's matrix-consolidation (one claimed this widget "mounts twice," including under DemoMoment -- it no longer does, DemoMoment's matrix moment was removed in round 1; fixed to describe the actual single (rail) mount point).

Deliberately out of scope: the comment-cruft pattern is pervasive across ~12 more files in `src/pages/home/` (`ConnectedDataModelSection.tsx`, `FinalCTASection.tsx`, the `featuresShowcase/*Crop.tsx` files, etc.) that this round's judge never named -- not swept, per this loop's own rule against inventing scope beyond what a judge actually flagged. The shared `WidgetProps` type gap is also still open: the three rail widgets' `animate` prop shapes differ intentionally (two required, one optional with a default that's no longer serving a second mount point but still a reasonable fallback), so a forced single shared type wouldn't cleanly fit without either loosening real constraints or unnecessary test churn -- judged not worth forcing this round.

QA gate: typecheck clean, 0 lint errors, 156 files / 2533 tests passing unmodified (comment-only diff, zero logic changes).

## Round 4

Diff confined to 4 comment-only edits with zero behavior change (full pre-existing suite passed unmodified) -- narrow-scoped per the skill's cost-saving rule: only re-ran **code quality**, the axis this round's diff was meant to address. All other 8 axes carried forward unchanged (zero code overlap with this round's diff): industry-standards (7), UX (8), efficiency (8), accessibility (9), visual/design polish (8), resilience (8), cross-view integration (9), mobile/responsive (8).

| Axis | Score | Δ |
|---|---|---|
| Code quality/maintainability | 8/10 | +2 |
| (all others) | carried forward | — |

**Average: 8.11/10** (up from 7.89) — not converged (average < 9), but **every axis now clears the floor for the first time this loop**. stuck_streak resets to 0 across the board.

### Judge findings

**Code quality (6→8):** all 4 flagged files confirmed clean of comment-cruft on direct read -- what survives is terse, genuinely useful WHY-context, not history theater. Both factual corrections independently re-verified against the real codebase (no React Compiler plugin exists anywhere in the build; `LandingRiskMatrixWidget` really does mount exactly once now). Objective signal clean. Fresh full-tree scan confirms the known ~13-location comment-cruft backlog outside the 4 fixed files is real and unswept, but correctly not counted against this round's score (deliberate, logged scope boundary, not silently ignored).

### Fix selected for round 5

No axis below floor, no axis with a live stuck_streak. Priority falls to "furthest below target (9)": **industry-standards** (7) is the lowest score of any axis, ahead of the five axes tied at 8. Its most concrete still-open, contained finding: round 2's industry-standards judge flagged that testimonial cards pair 5-star ratings with quotes explicitly badged "ILLUSTRATIVE EXAMPLE" -- an odd combination (a rating implies a real measured opinion; category-reference sites like Vanta/Drata/Secureframe don't use star ratings on testimonials at all). Dropping the stars while keeping the quote + honesty badge is a small, contained, Tier 1 fix. The logo-wall and testimonial-photo findings remain open and large-scope (no real customers/photos to show yet).

## Round 5

Fix: removed the 5-star rating row from `TestimonialsSection.tsx`'s testimonial cards (the `Star` icon import, the `rating` field on the `Testimonial` interface/mock data, and the rendered star row) -- a rating implies a real measured opinion, at odds with the "ILLUSTRATIVE EXAMPLE" badge directly above it on the same card, and no reference site in the category (Vanta/Drata/Secureframe) uses star ratings on testimonials.

QA gate: typecheck clean, 0 lint errors, 156 files / 2533 tests passing (5/5 in `TestimonialsSection.test.tsx`, no test depended on the removed rating). Live-verified: 0 star SVGs remain in the testimonials section, all 4 cards intact, console clean.

## Round 6

Narrow-scoped: re-ran industry-standards and visual/design polish (the two axes round 5's fix touched or targeted). Carried forward unchanged: UX (8), efficiency (8), accessibility (9), resilience (8), code quality (8), cross-view integration (9), mobile/responsive (8).

| Axis | Score | Δ | stuck_streak |
|---|---|---|---|
| Industry-standards | 7/10 | 0 | 1 |
| Visual/design polish | 8/10 | 0 | 0 (above floor, doesn't count as stuck) |
| (all others) | carried forward | — | 0 |

**Average: 8.11/10 -- identical to round 4's average.**

### Judge findings

**Industry-standards (7, unchanged):** star-removal fix verified live and in source -- clean, no regression, no orphaned gap. The two remaining findings (no customer-logo strip, no testimonial photos) are unchanged and both explicitly large-scope (no real customer assets exist yet to show honestly). Fresh full-page pass found nothing new; this axis's honesty-badge discipline ("Not verified customer quotes," "ILLUSTRATIVE DATA" labels throughout) was called out as unusually transparent versus the category norm.

**Visual/design polish (8, unchanged):** star-removal verified clean via `getBoundingClientRect()` -- consistent 24px gap in all 4 cards, no leftover margin artifact, row-paired cards match heights exactly. The `FeaturesSection.tsx` card-parallelism finding (row 1: 3/3 cards with rich crops; row 2: 1/3) is confirmed still open -- this is now its **third** consecutive scored round flagged without ever being selected as a fix, because every prior round's mechanical priority routed to a lower-scoring or more-urgent axis first.

### Guardrail check: STAGNATION

Round 4's average (8.11) and round 6's average (8.11) are identical -- two consecutive scored rounds with zero net improvement, tripping this loop's stagnation guardrail. **Stopping the loop here to escalate, per the skill's explicit instruction, rather than continuing silently.**

Diagnosis: this is not the loop spinning without progress -- both of the last two fixes (round 3's comment cleanup, round 5's star removal) were independently verified as clean, correct, real improvements with no regressions. The flat average instead reflects two separate real dynamics converging at the same time:
1. Industry-standards' only remaining findings (customer-logo wall, testimonial photos) are both explicitly large-scope -- blocked on real customer assets that don't exist yet, not fixable by another contained round.
2. Visual/design polish's one remaining finding (`FeaturesSection.tsx` card-parallelism) is genuinely contained -- but has been flagged and re-confirmed in 3 consecutive scored rounds (1, 2, 6) without ever winning mechanical priority, because rounds 1-4 always had a lower-scoring or newly-regressed axis to address first. Now that every other axis is comfortably above floor, this finding is next in line but the loop stopped for stagnation before it could be selected.

## Round 7 (final, per user direction after the stagnation escalation)

User chose: fix the FeaturesSection parallelism finding, then stop the loop regardless of the outcome.

Fix: reordered `FeaturesSection.tsx`'s render order (content/copy unchanged) so the 4 cropped and 2 icon-only cards interleave across both grid rows instead of clustering 4-then-2. Row 1 now carries 2/3 cropped cards, row 2 carries 2/3 -- no row reads as categorically less finished than the other. Named the 6 feature objects individually (compliance/audits/tracked-actions/board-ready-reporting/site-wide-risk-view/highest-exposure-risks) so the render-order array reads as an intentional interleave, not an opaque reshuffle.

New regression test asserting neither 3-card row is all-crop or all-icon-only, negative-control-verified (reverted to the old clustered order, confirmed the test fails; restored, confirmed it passes).

QA gate: typecheck clean, 0 lint errors, 156 files / 2534 tests passing. Live-verified via DOM: row 1 = crop/no-crop/crop, row 2 = no-crop/crop/crop, exactly as designed. Console clean.
