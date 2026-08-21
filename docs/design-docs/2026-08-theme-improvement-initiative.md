# Theme improvement initiative (2026-08)

## What this is

A multi-agent design/engineering pass to improve the app's existing visual
identity (dark navy / jade green, Fraunces + Manrope) — not replace it.
Four alternative visual directions (working names: Precision Instrument,
Field Ledger, Command Surface, Quiet Authority) were explored and shelved;
the current identity was preferred, so this work instead: (1) closes real
consistency/accessibility gaps found in that exploration, (2) adds motion
and interactivity using modern CSS, and (3) makes the public landing page
show the real product instead of a hand-drawn mockup.

Every phase below ships as its own small, independently revertable PR. If
a phase turns out to be the wrong call, `git revert <merge commit>` should
cleanly undo it without touching unrelated phases — that's a hard
requirement for how these PRs are scoped, not just a nice-to-have.

## Findings this work is based on (see PR descriptions for full detail)

- Design-token layer (Tailwind v4 CSS-first tokens, WCAG-AA-computed
  contrast, dedicated risk-severity palette, theme provider) is solid —
  kept as-is throughout.
- Component layer has real drift: ~24 hand-rolled modals vs. 14 using the
  shared `Dialog`; severity/status badges independently reimplemented
  despite an existing `severityStyles.ts` utility, adoption inconsistent
  within the same files in several cases.
- 23 toggle-button patterns were reported to have no `role="switch"`/
  `aria-checked`. **Phase A1 re-verified this and found it stale** — an
  exhaustive re-check of `src/` found zero hand-rolled switch controls;
  the ones that exist already use correct ARIA (`aria-pressed`, native
  checkboxes with labels) from earlier, unrelated a11y remediation PRs.
  No component code changed for this reason; `eslint-plugin-jsx-a11y` was
  added instead so this bug class is now caught automatically going
  forward, whether or not it was ever real to begin with.
- No flagship dashboard component (Risk Matrix, Overview, KRI dashboard,
  Compliance) has a props-injectable "preview" mode — all fetch live data
  directly. Proven fix pattern (see Phase B) verified end-to-end on
  `RiskMatrixPage`.
- `framer-motion` is installed but used in exactly one place — recommended
  to drop in favor of native CSS (`<dialog>`, `animation-timeline: view()`,
  `:has()`, container queries), each with a progressive-enhancement
  fallback documented in the relevant PR.
- **Preview-pattern convention, established in Phase B1/B2**: split a page
  into a thin data-fetching wrapper + a presentational `*View.tsx` taking
  props, plus a `*Preview.tsx` demo entry point with mock data via the
  shared `assertPreviewOnly()` guard (`src/utils/assertPreviewOnly.ts`).
  For a page with more than a couple of data sources (Overview.tsx had 8),
  group props by domain — `{ risks: {data, isLoading, isError}, kris: {...},
  ... }` — not flat props per field; a `useMemo` depending on a group must
  depend on the group's `.data` field specifically, not the group object
  itself, since both the real wrapper and the preview construct a fresh
  literal every render. Neither B1 nor B2 wired their preview into a public
  route — that's deliberately deferred to Phase E, so there's no unused
  public surface sitting in production between phases.
- **Two Phase C ideas dropped from scope after investigation (Phase C3):**
  - *Native `<dialog>`*: the shared `Dialog` component (`src/components/ui/dialog.tsx`)
    is already built on Radix UI's `Dialog` primitive — fully accessible
    (focus trap, Escape, backdrop-click, return-focus-on-close) and used by
    14+ consumers. Rewriting it to the native `<dialog>` element would be a
    large, risky change to shared infrastructure for no real accessibility
    gain, since Radix already delivers equivalent behavior. The actual
    modal-consistency problem — ~24 *hand-rolled* modals not using the
    shared `Dialog` at all — is Phase D's job instead.
  - *Scroll-driven animation (`animation-timeline: view()`)*: researched as
    a replacement for the existing `useRevealOnScroll` IntersectionObserver
    hook (already reduced-motion-aware, used on the landing page's hero/
    features/testimonials sections). As of August 2026 this still isn't
    safe to ship without a JS fallback — Firefox requires a flag and Safari
    only just landed support in a 26 beta. Migrating would regress those
    users for a "remove some JS" benefit that isn't worth it yet. Revisit
    once support is broader; the existing hook stays as-is.
  - What *did* ship from Phase C3: `has-[:checked]`-based row-select
    highlighting on `RiskRegisterPage`/`InspectionTable` — CSS `:has()` is
    Baseline-safe everywhere as of 2026, no fallback needed.

## Phases

| # | Phase | Status | PR |
|---|---|---|---|
| A1 | `role="switch"`/`aria-checked` audit (found stale — no fix needed) + add `eslint-plugin-jsx-a11y` | **shipped** | [#991](https://github.com/Qiyrix/aexa-frontend/pull/991) |
| A2 | Badge primitive + severity-color migration | **shipped** (partial — 4 of ~25 files migrated, rest listed as follow-up in the PR) | [#992](https://github.com/Qiyrix/aexa-frontend/pull/992) |
| B1 | Land the `RiskMatrixPage` → `RiskMatrixView` + preview pattern for real | **shipped** (not yet wired to a public route — that's Phase E) | [#994](https://github.com/Qiyrix/aexa-frontend/pull/994) |
| B2 | Extend the preview pattern to `Overview.tsx` | **shipped** (not yet wired to a public route — that's Phase E) | [#996](https://github.com/Qiyrix/aexa-frontend/pull/996) |
| C1 | Drop `framer-motion` (its one usage site ported to a CSS `animate-fade-in` class) | **shipped** | [#998](https://github.com/Qiyrix/aexa-frontend/pull/998) |
| C2 | Live-update flash pattern: `useValueChangeFlash` hook + two-phase CSS transition + `aria-live` announcement, applied to the KRI dashboard | **shipped** | [#999](https://github.com/Qiyrix/aexa-frontend/pull/999) |
| C3 | `:has()`-based row-select highlighting on `RiskRegisterPage`/`InspectionTable` (native `<dialog>` and scroll-driven-animation ideas dropped from scope — see below) | **shipped** | [#1001](https://github.com/Qiyrix/aexa-frontend/pull/1001) |
| D | Modal consolidation (~24 files, smallest/safest first, `FindingDetails.tsx`/`AuditPage.tsx` last) — sequenced with Phase C since both touch modal files | in progress | — |
| E | Landing page rebuild using real preview components + interactive demos + Phase C motion | not started | — |
| F | Remaining primitives (Checkbox/Avatar/Skeleton/Tooltip), opportunistic | not started | — |

This table is the source of truth for status — update the Status/PR
columns as each phase ships, rather than tracking progress anywhere else.

## How to revert this whole initiative

Because each phase is its own PR, reverting everything is reverting each
phase's merge commit in reverse phase order (F, then E, ... then A). There
is no shared migration or schema change anything else depends on — the
design-token layer was never touched, so a full revert leaves the app
exactly where it was before this initiative started.
