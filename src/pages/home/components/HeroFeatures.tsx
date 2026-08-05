import { useRevealOnScroll } from "@/hooks/useRevealOnScroll"
import { useRevealStagger } from "@/hooks/useRevealStagger"
import { ScrollText, Sparkles, TrendingUp, UserCog } from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"

const HeroFeatures: React.FC = () => {
  const { t } = useTranslation()
  const [revealRef, revealVisible] = useRevealOnScroll<HTMLDivElement>()
  const settled = useRevealStagger(revealVisible, 4)
  const features = [
    {
      icon: UserCog,
      title: t("home.heroFeatures.features.0.title"),
      description: t("home.heroFeatures.features.0.description"),
    },
    {
      icon: TrendingUp,
      title: t("home.heroFeatures.features.1.title"),
      description: t("home.heroFeatures.features.1.description"),
    },
    {
      // ScrollText (not ShieldCheck), which is already the brand mark --
      // reusing it here would put the same shape twice in the hero alone.
      icon: ScrollText,
      title: t("home.heroFeatures.features.2.title"),
      description: t("home.heroFeatures.features.2.description"),
    },
    {
      icon: Sparkles,
      title: t("home.heroFeatures.features.3.title"),
      description: t("home.heroFeatures.features.3.description"),
    },
  ]

  return (
    // bg-muted/40 (a diluted, fully theme-adaptive tint) only registered
    // as a visually distinct "authority band" in dark mode -- in light
    // mode it was nearly indistinguishable in weight from the plain
    // sections around it. A full-strength bg-muted plus real top/bottom
    // borders gives it a fixed, unmistakable band treatment in both themes.
    <section
      id="how-it-works"
      className="scroll-mt-16 border-y border-border bg-muted px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 max-w-3xl sm:mb-16">
          <span className="text-xs font-semibold tracking-wide text-teal-700 uppercase dark:text-primary">
            {t("home.heroFeatures.eyebrow")}
          </span>
          <h2 className="mt-3 mb-4 font-heading text-2xl leading-tight font-semibold text-balance text-foreground sm:text-3xl md:text-4xl">
            {t("home.heroFeatures.title1")}{" "}
            <span className="text-primary italic">
              {t("home.heroFeatures.title2")}
            </span>
          </h2>

          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            {t("home.heroFeatures.description")}
          </p>
        </div>

        {/* Feature Cards - denser, hairline-ruled "ledger" register (fixed
            title height, monospace index) so this reads distinct from the
            softer icon-grid used in FeaturesSection below */}
        <div
          ref={revealRef}
          className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-primary/15"
        >
          {features.map((feature, index) => (
            <div
              key={index}
              className={`bg-card p-6 sm:p-7 ${
                settled
                  ? "translate-y-0 opacity-100 transition-all duration-200 ease-out"
                  : `motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out ${
                      revealVisible
                        ? "translate-y-0 opacity-100"
                        : "translate-y-4 opacity-0"
                    }`
              }`}
              style={
                settled
                  ? undefined
                  : { transitionDelay: revealVisible ? `${index * 80}ms` : "0ms" }
              }
            >
              {/* Outlined, not filled: FeaturesSection's icon tiles are
                  filled bg-primary/10 squares, so an outlined treatment
                  here is what actually makes the two grids' icon language
                  distinct, not just the surrounding card border. No hover
                  state on the tile or card: these are static info cards
                  with no onClick/keyboard handler behind them, and a
                  hover-triggered style implies clickability that doesn't
                  exist (aexa-frontend#510). */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30">
                  <feature.icon className="h-5 w-5 text-primary" strokeWidth={2} />
                </div>
                <span className="font-mono-data text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>

              {/* Title - fixed min-height so cards with a 1-line vs 2-line
                  title still align descriptions across the row */}
              {/* min-h sized for the actual 2-line max in current copy (56px):
                  min-h-20 (80px) reserved room for a 3-line title that never
                  occurs, leaving up to 52px of dead space above the
                  description on 1-line cards. */}
              <h3 className="mb-2 min-h-12 text-base font-semibold text-foreground sm:min-h-14 sm:text-lg">
                {feature.title}
              </h3>

              {/* Description */}
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HeroFeatures
