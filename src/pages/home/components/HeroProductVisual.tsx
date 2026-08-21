import React from "react"
import Logo from "@/components/shared/Logo"
import { useTranslation } from "react-i18next"
import { useCountUp } from "@/hooks/useCountUp"

// Replaces the static hero-visual.svg: that asset had hardcoded hex colors
// baked in at authoring time, so it ignored the theme entirely (a bright
// white "card" floating on the dark-mode hero, and near-invisible framing in
// light mode) and became an illegible flattened image at mobile widths.
// This renders the same four proof points (risk matrix, compliance
// obligations, executive overview, AI-generated audit template) as real DOM
// driven by the design token system, so it's theme-correct and reflows
// cleanly on small screens instead of shrinking as one raster image.

type RiskLevel = "low" | "medium" | "high" | "critical"

const MATRIX: RiskLevel[][] = [
  ["medium", "high", "high", "critical", "critical"],
  ["medium", "medium", "high", "high", "critical"],
  ["low", "medium", "medium", "high", "high"],
  ["low", "low", "medium", "medium", "high"],
  ["low", "low", "low", "medium", "medium"],
]

// Opacity spread widened beyond the usual 60/65/75 step: risk-medium and
// risk-high sit close in hue/lightness in dark mode (both amber-orange),
// so a small opacity gap between them read as a muddy, indistinct band at
// this heatmap's small cell size. A wider spread keeps the 5-level
// severity gradient legible at a glance.
const CELL_CLASS: Record<RiskLevel, string> = {
  low: "bg-risk-low/55",
  medium: "bg-risk-medium/45",
  high: "bg-risk-high/80",
  critical: "bg-risk-critical/90",
}

const COMPLIANCE_ITEMS = [
  {
    key: "dataRetention",
    status: "compliant",
    dot: "bg-risk-low",
    // Same fix as its red/amber siblings below: raw --risk-low as text on
    // its own 15%-tint measures ~2:1 in light mode. Dark mode's raw token
    // technically clears AA on its own (9.08:1), but real Tailwind shades
    // for both themes -- not the raw token -- keeps this consistent with
    // src/utils/severityStyles.ts's low entry (round-4 final-review fix).
    // Also used directly (no chip) on the compliance-rate stat below.
    chip: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400",
  },
  {
    key: "vendorAccess",
    status: "nonCompliant",
    dot: "bg-risk-critical",
    // Same issue as the amber chip below: raw --risk-critical as text on
    // its own 15%-tint measures ~3.5-3.8:1, under WCAG AA — its lightness
    // is tuned to work as a solid fill/icon color, not small text-on-tint.
    chip: "bg-red-500/15 text-red-700 dark:bg-red-400/15 dark:text-red-400",
  },
  {
    key: "incidentDrill",
    status: "dueSoon",
    dot: "bg-accent",
    // Raw --accent as text on its own 15%-tint background measures ~2.1:1,
    // well under WCAG AA — --accent and --risk-medium share one HSL value
    // by design (both amber), so this can't borrow --accent-foreground
    // (that's tuned for white-on-solid-amber buttons elsewhere in the app,
    // also insufficient here). amber-700 measured ~4.48:1 in light mode —
    // technically still short of the 4.5:1 AA line for small text, hence
    // amber-800 for real margin. NOTE: intentionally decoupled from
    // --accent — if the accent hue is ever retuned, re-check this pair.
    chip: "bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-400",
  },
] as const

const CATEGORY_BARS = [
  { key: "operational", height: "h-8", fill: "bg-primary" },
  { key: "financial", height: "h-14", fill: "bg-risk-high" },
  { key: "compliance", height: "h-5", fill: "bg-risk-low" },
  { key: "cyber", height: "h-11", fill: "bg-risk-medium" },
  { key: "strategic", height: "h-7", fill: "bg-primary/60" },
]

// v3 motion pass (theme-improvement-initiative, landing overhaul): the
// hero's four quadrants previously entered as one opaque block via the
// parent's own visualRef transition. `visible` lets each quadrant stagger
// in independently on top of that, plus one real data point (compliance
// rate) counts up once -- the plan's single deliberate exception to
// "hero polish is spacing/copy only", bounded to a one-time reveal with
// no ambient loop.
const HeroProductVisual: React.FC<{ visible?: boolean }> = ({
  visible = true,
}) => {
  const { t } = useTranslation()
  const complianceRate = useCountUp(92, visible)

  const quadrantClass = `bg-card p-4 transition-all duration-500 ease-out motion-reduce:transition-none ${
    visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
  }`
  const quadrantStyle = (index: number) =>
    visible ? { transitionDelay: `${index * 90}ms` } : undefined

  return (
    // No hover state: this is a static illustrative product screenshot
    // wrapped in role="img" by the caller, with no onClick/keyboard handler
    // behind it, and a hover-triggered shadow deepening implies clickability
    // that doesn't exist (aexa-frontend#510).
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-foreground/5">
      {/* A labeled panel, not fake browser chrome: three dots + a mock URL
          bar is the single most reused "trust us, it's a real product"
          trope in SaaS marketing. A monospace tag in the same idiom as the
          authority band's 01-04 ledger indices ties this panel back to the
          page's own visual system instead of borrowing a generic one. */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Logo className="h-4 w-4" />
          <span className="font-heading text-sm font-semibold text-foreground">
            Qiyrix
          </span>
        </div>
        <span className="flex items-center gap-1.5 font-mono-data text-[10px] font-semibold tracking-wide text-teal-700 uppercase dark:text-primary">
          {/* Pulsing dot gives the "Live" claim an actual visual signal --
              without it the label was static text next to a static mock,
              a claim with no matching cue anywhere in the panel. */}
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-current opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
          </span>
          {t("home.hero.visual.liveLabel")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
        {/* Risk matrix */}
        <div className={quadrantClass} style={quadrantStyle(0)}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {t("home.hero.visual.riskMatrix")}
            </span>
            <span className="font-mono-data text-[10px] text-muted-foreground">
              5 × 5
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {MATRIX.map((row, rowIdx) =>
              row.map((level, colIdx) => {
                const isSelected = rowIdx === 2 && colIdx === 2
                return (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    className={`flex aspect-square items-center justify-center rounded-[3px] text-[9px] font-semibold ${
                      // Full-opacity text-foreground, not /70: the /70 cut
                      // dark-mode contrast on the "3" digit to 3.32:1
                      // (dark-mode risk-medium's amber got lighter without
                      // re-checking the overlaid digit). This class is only
                      // ever applied to the one selected cell that actually
                      // renders a digit, so full opacity doesn't affect
                      // the other 24 (empty) cells.
                      isSelected ? "text-foreground" : "text-foreground/70"
                    } ${CELL_CLASS[level]} ${
                      // A ring here would be invisible against the amber
                      // medium-risk cells (--accent === --risk-medium) and
                      // would visually double as the site's own keyboard
                      // focus-ring treatment. A solid inset border reads as
                      // "flagged" without either collision.
                      isSelected ? "border-2 border-foreground" : ""
                    }`}
                  >
                    {isSelected ? "3" : ""}
                  </div>
                )
              })
            )}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>{t("home.hero.visual.likelihood")}</span>
            <span>{t("home.hero.visual.impact")}</span>
          </div>
        </div>

        {/* Compliance obligations */}
        <div className={quadrantClass} style={quadrantStyle(1)}>
          <div className="mb-3">
            <span className="text-xs font-semibold text-foreground">
              {t("home.hero.visual.compliance")}
            </span>
            <p className="text-[10px] text-muted-foreground">
              {t("home.hero.visual.obligationsTracked")}
            </p>
          </div>
          <ul className="space-y-2.5">
            {COMPLIANCE_ITEMS.map((item) => (
              <li key={item.key} className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dot}`} />
                <span className="flex-1 truncate text-xs text-foreground">
                  {t(`home.hero.visual.obligations.${item.key}.title`)}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${item.chip}`}
                >
                  {t(`home.hero.visual.obligations.${item.key}.status`)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Executive overview */}
        <div className={quadrantClass} style={quadrantStyle(2)}>
          <span className="mb-3 block text-xs font-semibold text-foreground">
            {t("home.hero.visual.executiveOverview")}
          </span>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <p className="font-mono-data text-lg font-bold text-foreground">
                27
              </p>
              <p className="text-[10px] text-muted-foreground">
                {t("home.hero.visual.activeRisks")}
              </p>
            </div>
            <div>
              <p className="font-mono-data text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {complianceRate}%
              </p>
              <p className="text-[10px] text-muted-foreground">
                {t("home.hero.visual.complianceRate")}
              </p>
            </div>
          </div>
          <div className="flex h-14 items-end gap-1.5">
            {CATEGORY_BARS.map((bar) => (
              <div
                key={bar.key}
                className={`flex-1 rounded-t-sm ${bar.height} ${bar.fill}`}
              />
            ))}
          </div>
        </div>

        {/* AI-generated audit template */}
        <div className={quadrantClass} style={quadrantStyle(3)}>
          <span className="mb-3 block text-xs font-semibold text-foreground">
            {t("home.hero.visual.generateTemplate")}
          </span>
          <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-background/70 px-2.5 py-1.5 text-[10px] text-muted-foreground">
            <span className="truncate">
              {t("home.hero.visual.templatePrompt")}
            </span>
          </div>
          <ul className="space-y-2">
            <li className="flex items-center justify-between gap-2 text-[10px]">
              <span className="truncate text-foreground">
                {t("home.hero.visual.question1")}
              </span>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-semibold text-secondary-foreground">
                {t("home.hero.visual.yesNo")}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2 text-[10px]">
              <span className="truncate text-foreground">
                {t("home.hero.visual.question2")}
              </span>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-semibold text-secondary-foreground">
                {t("home.hero.visual.media")}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default HeroProductVisual
