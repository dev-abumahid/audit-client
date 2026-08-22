import React from "react"
import { useTranslation } from "react-i18next"
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll"
import KriThresholdSliderWidget from "./productDemo/KriThresholdSliderWidget"
import KriTrendWidget from "./productDemo/KriTrendWidget"
import LandingRiskMatrixWidget from "./productDemo/LandingRiskMatrixWidget"
import RiskGraphWidget from "./productDemo/RiskGraphWidget"
import RoleScopedRegisterWidget from "./productDemo/RoleScopedRegisterWidget"

// Live audit finding: the static rail's risk-matrix card and this section's
// own "Click into the risk matrix" moment were two different 5x5 risk
// matrices shown back-to-back -- real, distracting redundancy, not
// intentional reinforcement. Resolved by consolidating into one: the rail
// slot below now mounts LandingRiskMatrixWidget directly (the interactive,
// clickable one) instead of the separate non-interactive RiskMatrixWidget
// (now deleted, it had no other callers), and the standalone matrix moment
// is removed from this list entirely -- the smaller rail card is the
// clickable one now, not a duplicate.
//
// Landing overhaul, post-launch pass: replaces the DemoTabs tab-switcher
// (one demo visible at a time, hidden behind a click) with full-width
// "moments" the visitor scrolls through -- direct response to feedback that
// an external design exploration's one-demo-per-screen pacing read better
// than the boxed tabbed card. Each entry's own widget component is
// unchanged; only how it's introduced and mounted changed.
const INTERACTIVE_DEMOS = [
  {
    id: "roleRegister",
    headingKey: "home.productDemo.roleRegister.sectionHeading",
    descriptionKey: "home.productDemo.roleRegister.sectionDescription",
    pillKey: "home.productDemo.roleRegister.pill",
    Widget: RoleScopedRegisterWidget,
  },
  {
    id: "kriSlider",
    headingKey: "home.productDemo.kriSlider.sectionHeading",
    descriptionKey: "home.productDemo.kriSlider.sectionDescription",
    pillKey: "home.productDemo.kriSlider.pill",
    Widget: KriThresholdSliderWidget,
  },
] as const

// One numbered "moment": eyebrow number, heading, description, pill, and
// the real widget, laid out as two columns at lg+ (copy left, widget
// right) rather than stacked -- design-team finding: centering each
// moment in a narrow max-w-4xl column left ~270px of empty canvas on both
// sides while the text sat entirely above the widget, making the section
// that best proves the product real (live interactivity, not a static
// screenshot) the emptiest-feeling one on the page. Mirrors HeroSection's
// own copy-left/visual-right rhythm instead of inventing a third pattern.
// Its own useRevealOnScroll (not the parent's) so each moment animates in
// as the visitor actually scrolls to it, rather than all three firing
// together the instant the section's top edge is reached.
function DemoMoment({
  index,
  headingKey,
  descriptionKey,
  pillKey,
  Widget,
}: {
  index: number
  headingKey: string
  descriptionKey: string
  pillKey: string
  Widget: React.ComponentType
}) {
  const { t } = useTranslation()
  const [revealRef, revealVisible] = useRevealOnScroll<HTMLDivElement>()

  return (
    <div
      ref={revealRef}
      className={`border-t border-border pt-10 transition-all duration-700 ease-out first:border-t-0 first:pt-0 motion-reduce:transition-none lg:grid lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-12 ${
        revealVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      <div>
        <span className="font-heading text-sm text-muted-foreground italic">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className="mt-2 font-heading text-xl font-bold text-balance text-foreground sm:text-2xl">
          {t(headingKey)}
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t(descriptionKey)}
        </p>
        <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {t(pillKey)}
        </span>
      </div>

      <div className="mt-6 w-full rounded-xl bg-gradient-to-br from-accent/50 to-border/60 p-px shadow-lg shadow-foreground/[0.03] lg:mt-0">
        <Widget />
      </div>
    </div>
  )
}

// Phase E (theme-improvement-initiative), redesigned twice after live
// feedback: v1 literally embedded the authenticated OverviewView dashboard
// (read as a cropped admin screenshot). v2 replaced it with these three
// stylized widgets but kept a flat, un-elevated card treatment that read as
// correct rather than premium. This pass adds real depth and a signature
// element instead of decoration for its own sake: the three widgets are
// visually stitched into ONE connected system (a thin traced rail with
// three nodes, each labeled with the real relationship between the
// widgets) -- literalizing the "one data model underlies every module"
// claim FeaturesSection already makes in copy, rather than three
// independent cards that happen to sit in a row.
const ProductDemoSection: React.FC = () => {
  const { t } = useTranslation()
  const [revealRef, revealVisible] = useRevealOnScroll<HTMLDivElement>()

  return (
    <section
      id="product-demo"
      className="relative scroll-mt-16 overflow-hidden bg-background px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
    >
      {/* Same grid+radial-glow treatment as HeroSection's own background --
          reused deliberately, not reinvented, so this section reads as
          continuous with the hero rather than a different page bolted on.
          Recentered lower (60% down instead of pinned to the top) since
          this section's focal point is the widget row, not its heading. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground) / 0.06) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 70% 50% at 50% 65%, black 30%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-10 max-w-2xl sm:mb-14">
          <span className="text-xs font-semibold tracking-wide text-teal-700 uppercase dark:text-primary">
            {t("home.productDemo.eyebrow")}
          </span>
          <h2 className="mt-3 font-heading text-2xl font-semibold text-balance text-foreground sm:text-3xl md:text-4xl">
            {t("home.productDemo.title")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("home.productDemo.description")}
          </p>
        </div>

        <div ref={revealRef} className="relative">
          {/* Connector rail: the signature element. A traced horizontal
              line with three nodes, each labeled with the real relationship
              between the widgets it sits above (plots into / correlates
              with / triggers). Desktop only -- the three widgets stack
              vertically below lg, where a horizontal rail spanning shifting
              card positions can't stay meaningfully aligned. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            className="absolute -top-9 right-0 left-0 hidden h-9 w-full lg:block"
          >
            <line
              x1="16.5"
              y1="12"
              x2="83.5"
              y2="12"
              pathLength={1}
              className={`stroke-primary/40 transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none ${
                revealVisible
                  ? "[stroke-dashoffset:0]"
                  : "[stroke-dashoffset:1]"
              }`}
              strokeWidth={0.5}
              strokeDasharray={1}
              vectorEffect="non-scaling-stroke"
            />
            {[16.5, 50, 83.5].map((cx, i) => (
              <circle
                key={cx}
                cx={cx}
                cy={12}
                r={1.5}
                className={`fill-primary transition-opacity duration-500 ease-out motion-reduce:transition-none ${
                  revealVisible ? "opacity-100" : "opacity-0"
                }`}
                style={
                  revealVisible
                    ? { transitionDelay: `${300 + i * 350}ms` }
                    : undefined
                }
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {/* Review finding on PR #1011: purely decorative narrative labels
              (visually reinforcing the rail above), not associated with
              any specific element below via aria-labelledby/heading
              semantics -- a screen-reader user got three orphaned short
              phrases with no structural link to the cards that follow.
              Each widget's own role="img" aria-label already carries the
              real information in full sentences; hiding this row avoids
              a redundant, disconnected announcement. */}
          <div
            aria-hidden="true"
            className="mb-2 hidden grid-cols-3 gap-5 text-center text-[10px] font-medium tracking-wide text-primary/70 uppercase lg:grid"
          >
            <span>{t("home.productDemo.rail.plots")}</span>
            <span>{t("home.productDemo.rail.correlates")}</span>
            <span>{t("home.productDemo.rail.triggers")}</span>
          </div>

          {/* Default items-stretch: all 3 cards match the tallest one's
              height. Each card is its own flex column with its closing
              legend pinned to the bottom via mt-auto (see each widget's own
              root div), so the stretched height never shows as a trailing
              gap -- direct user feedback wanted matched card heights, not
              the uneven-bottoms look items-start produced. */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {[
              { Widget: LandingRiskMatrixWidget, glow: "from-risk-info/50" },
              { Widget: RiskGraphWidget, glow: "from-risk-critical/50" },
              { Widget: KriTrendWidget, glow: "from-primary/50" },
            ].map(({ Widget, glow }, i) => (
              <div
                key={i}
                className={`rounded-xl bg-gradient-to-br to-border/60 p-px shadow-lg shadow-foreground/[0.03] transition-all duration-500 ease-out motion-reduce:transition-none ${glow} ${
                  revealVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-3 opacity-0"
                }`}
                style={
                  revealVisible
                    ? { transitionDelay: `${i * 120}ms` }
                    : undefined
                }
              >
                <Widget animate={revealVisible} />
              </div>
            ))}
          </div>

          {/* Numbered moments (register -> KRI). No max-w-4xl cap here
              anymore -- design-team finding: centering each moment in a
              narrow column while its own copy sat above the widget left
              ~270px of dead space on both sides, twice. Now that
              DemoMoment lays out copy+widget side by side, the moments
              use the same full width as the rail above them instead of
              shrinking into an island within it. */}
          <div className="mt-16 space-y-14 sm:mt-20">
            {INTERACTIVE_DEMOS.map((demo, i) => (
              <DemoMoment
                key={demo.id}
                index={i}
                headingKey={demo.headingKey}
                descriptionKey={demo.descriptionKey}
                pillKey={demo.pillKey}
                Widget={demo.Widget}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default ProductDemoSection
