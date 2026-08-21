import { useRevealOnScroll } from "@/hooks/useRevealOnScroll"
import {
  BarChart3,
  ClipboardCheck,
  FileText,
  ListChecks,
  MapPin,
  Target,
} from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"
import AuditEngagementCrop from "./featuresShowcase/AuditEngagementCrop"
import ComplianceHeatmapCrop from "./featuresShowcase/ComplianceHeatmapCrop"
import FindingsOverdueCrop from "./featuresShowcase/FindingsOverdueCrop"
import SeverityChipsCrop from "./featuresShowcase/SeverityChipsCrop"

// Landing overhaul PR7: 4 of the 6 cards below now embed a compact real
// crop of that module's own distinctive UI (see featuresShowcase/*.tsx for
// each crop's real source page/line) instead of icon+text alone -- the
// single highest-fidelity win the plan called for. The other 2 (templates,
// board-ready reporting) stay icon+text: not every card needs a crop, and
// a report/export card in particular doesn't have a small-scale visual
// moment worth compressing into this space.
const FeaturesSection: React.FC = () => {
  const { t } = useTranslation()
  const [revealRef, revealVisible] = useRevealOnScroll<HTMLDivElement>()
  const features = [
    {
      icon: FileText,
      title: t("home.featureSection.features.0.title"),
      description: t("home.featureSection.features.0.description"),
      Visual: ComplianceHeatmapCrop,
    },
    {
      icon: ClipboardCheck,
      title: t("home.featureSection.features.1.title"),
      description: t("home.featureSection.features.1.description"),
      Visual: AuditEngagementCrop,
    },
    {
      icon: ListChecks,
      title: t("home.featureSection.features.2.title"),
      description: t("home.featureSection.features.2.description"),
      Visual: FindingsOverdueCrop,
    },
    {
      icon: BarChart3,
      title: t("home.featureSection.features.3.title"),
      description: t("home.featureSection.features.3.description"),
      Visual: null,
    },
    {
      icon: MapPin,
      title: t("home.featureSection.features.4.title"),
      description: t("home.featureSection.features.4.description"),
      Visual: null,
    },
    {
      icon: Target,
      title: t("home.featureSection.features.5.title"),
      description: t("home.featureSection.features.5.description"),
      Visual: SeverityChipsCrop,
    },
  ]

  return (
    <section
      id="features"
      className="scroll-mt-16 bg-background px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header - plain (no italic accent): that treatment is reserved for
            the hero and authority band so it still signals emphasis instead
            of reading as a repeated template default. */}
        <div className="mb-12 max-w-2xl sm:mb-16">
          <span className="text-xs font-semibold tracking-wide text-teal-700 uppercase dark:text-primary">
            {t("home.featureSection.eyebrow")}
          </span>
          <h2 className="mt-3 mb-4 font-heading text-2xl leading-tight font-semibold text-balance text-foreground sm:text-3xl md:text-4xl">
            {t("home.featureSection.title1")}{" "}
            <span>{t("home.featureSection.title2")}</span>
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            {t("home.featureSection.description")}
          </p>
        </div>

        {/* Feature Grid */}
        <div
          ref={revealRef}
          className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-12"
        >
          {features.map((feature, index) => (
            <div
              key={index}
              className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
                revealVisible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
              style={{ transitionDelay: revealVisible ? `${index * 70}ms` : "0ms" }}
            >
              {/* Asymmetric corner-rounding + accent underline, not a plain
                  filled rounded-square: that shape is the default "feature
                  grid" icon tile in essentially every Tailwind/shadcn
                  template. This keeps the filled-tile language that
                  distinguishes it from HeroFeatures' outlined tiles, but
                  gives it its own identifiable silhouette rather than
                  being the generic baseline. No hover state: these are
                  static info cards with no onClick/keyboard handler behind
                  them, and a hover-triggered style implies clickability
                  that doesn't exist (aexa-frontend#510). */}
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-tr-xl rounded-bl-xl border-b-2 border-primary bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" strokeWidth={2} />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground sm:text-xl">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {feature.description}
              </p>
              {feature.Visual && <feature.Visual />}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection
