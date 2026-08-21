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
| D | Modal consolidation (~24 files, smallest/safest first, `FindingDetails.tsx`/`AuditPage.tsx` last) — sequenced with Phase C since both touch modal files | **in progress** (4 of ~24 done — see below) | [#1003](https://github.com/Qiyrix/aexa-frontend/pull/1003), [#1004](https://github.com/Qiyrix/aexa-frontend/pull/1004), [#1005](https://github.com/Qiyrix/aexa-frontend/pull/1005) |
| E | Landing page rebuild using real preview components + interactive demos + Phase C motion | **in progress** (core "real product" section shipped — see below) | [#1007](https://github.com/Qiyrix/aexa-frontend/pull/1007) |
| F | Remaining primitives (Checkbox/Avatar/Skeleton/Tooltip), opportunistic | not started | — |

This table is the source of truth for status — update the Status/PR
columns as each phase ships, rather than tracking progress anywhere else.

## Phase D status detail

**Pattern established** (4 modals shipped: `AttestConfirmModal`,
`ComplianceRiskLinkModal`, `RiskApprovalControls`'s Reject modal,
`FindingClosureControls`'s Reject modal): swap a hand-rolled
`fixed inset-0` overlay + the bespoke `useModalA11y` hook
(`src/hooks/useModalA11y.ts`) for the shared Radix-backed `Dialog`
(`src/components/ui/dialog.tsx`) — `Dialog`/`DialogContent`/
`DialogHeader`/`DialogTitle`/`DialogFooter`, `open`/`onOpenChange`
wired to whatever state already controlled the modal (a real boolean if
one existed, or a literal `true` for conditionally-mounted modals),
internal content otherwise untouched. Two real, reusable fixes came out
of the first migration: (1) this `radix-ui` version (1.4.3) never emits
`aria-modal` on `DialogContent` itself — fixed once in the shared
component, not per-caller; (2) a couple of `CompliancePage.test.tsx`
tests modeled clicking a different row's action while a modal was open
— Radix's stricter (correct) modality makes the rest of the page
`aria-hidden` while a dialog is open, so that's no longer reachable via
role queries (and, given the full-viewport overlay both old and new
implementations render, was likely never reachable by a real click
either — only jsdom's lack of pixel-occlusion checking let it "work"
before). Watch for the same pattern in any other modal-switching test.

**Remaining candidates, by risk** (`grep -rl useModalA11y src --include="*.tsx"`
minus the four done):

- **Small/standalone, likely safe next** — none currently identified;
  the four done were exactly the standalone small modal files. Re-run
  the grep and check line counts before assuming a new one qualifies.
- **Deliberately deferred, explicit warning already in the code**:
  `KriDashboardPage.tsx`'s three modals (`UpdateValueModal.tsx`,
  `EditKriModal.tsx`, `NewKriModal.tsx`) — `useModalA11y.ts`'s own
  comment (written before this initiative) explains these were
  deliberately kept on `useModalA11y` instead of the shared `Dialog`
  because migrating would mean re-styling all three to fit
  `DialogContent`'s own layout, a larger change than that a11y fix
  called for. Respect that unless doing the restyling work properly,
  with real layout comparison, not just a wrapper swap.
- **Everything else is embedded in a large page-level file, not a
  standalone modal component** — `IntelligencePage.tsx` (1478 lines),
  `InspectionReport.tsx` (1230), `AuditPage.tsx` (1109),
  `FindingDetails.tsx` (1227), `SitesEntities.tsx` (2062),
  `EditTemplatePage.tsx` (758), `CreateTemplatePage.tsx` (483),
  `RiskGraphPage.tsx` (2562), `RiskFormModal.tsx` (1931),
  `ComplianceFormModal.tsx` (469), `AttestHistoryModal.tsx` (303, plus
  its own roving-tabindex tab management — more complex than a plain
  confirm modal), `QnASettingsPanel.tsx` (415), `TrendModal.tsx`
  (KRI folder, likely shares the KRI restyling risk above). Migrating
  the modal wrapper *within* one of these is meaningfully higher-risk
  than the four done tonight — larger diff, harder to isolate the
  modal-only change, more surface area for an unrelated regression in
  the same file. Treat each as its own careful pass, not a batch.
- `DeleteAlertModal.tsx` only mentions `useModalA11y` in a comment
  (explaining a related fix) — it already uses `AlertDialog`, no work
  needed.

## Phase E status detail

**Shipped**: a new `ProductDemoSection.tsx` on the public landing page
(`src/pages/home/Home.tsx`, between `HeroFeatures` and
`FeaturesSection`) embeds the real `OverviewView` component fed the
same mock fixtures `OverviewPreview.tsx` uses — a genuine "see it in
action" section, not fabricated placeholder numbers.

**Deliberately untouched**: `HeroSection`'s existing product visual
(`HeroProductVisual.tsx`) — it's a well-crafted, theme-token-driven,
accessibility-reviewed compact illustration, not the "hand-drawn
mockup" this phase set out to replace. `OverviewView`/`RiskMatrixView`
are full authenticated pages (own `<h1>`, full chrome) that don't fit
that tight hero slot without looking cramped, hence the separate
section instead of a hero-visual swap.

**Key implementation pattern**: go around `OverviewPreview.tsx`/
`RiskMatrixPreview.tsx` entirely for a permanent public embed —
`assertPreviewOnly()` throws unconditionally in dev builds by design
(catching an accidental preview-route leak), which would crash the dev
server on every visit to `/` if a `*Preview.tsx` component were mounted
there directly. Render the underlying `*View.tsx` component directly
with the same mock data instead — that's what the `*Preview.tsx` entry
points themselves render once their guard passes.

**Known, disclosed limitation** (flagged in PR #1007's review, not
fixed yet): `OverviewView`'s risk/KPI links use mock IDs pointing to
real authenticated `/organization/*` routes. A logged-out visitor
clicking one gets redirected by `ProtectedRoute` back to `/` — not
broken, just a mildly confusing "click, briefly navigate, land back
where you started" moment. A proper fix (redirect these specific links
to a signup CTA instead) is real design work, tracked separately.

**Not done — remaining Phase E scope**: the tracking table's original
description also named "interactive demos" (this section is scrollable/
hoverable but not click-to-interact beyond that) and "Phase C motion"
integration (the section uses the existing `useRevealOnScroll` pattern,
not any new C3-era technique) — neither is a hard requirement, both are
reasonable candidates for a future pass if the current static-embed
version proves out. `RiskMatrixPreview`'s own mock data/component is
still unused on the public site — a second demo section (or a tabbed
view alternating between Overview/Risk Matrix) is a natural next step.

## How to revert this whole initiative

Because each phase is its own PR, reverting everything is reverting each
phase's merge commit in reverse phase order (F, then E, ... then A). There
is no shared migration or schema change anything else depends on — the
design-token layer was never touched, so a full revert leaves the app
exactly where it was before this initiative started.
