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
