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
