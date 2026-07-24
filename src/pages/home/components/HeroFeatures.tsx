import { Shield, Smartphone, TrendingUp, Users } from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"

const HeroFeatures: React.FC = () => {
  const { t } = useTranslation()
  const features = [
    {
      icon: Users,
      title: t("home.heroFeatures.features.0.title"),
      description: t("home.heroFeatures.features.0.description"),
    },
    {
      icon: Smartphone,
      title: t("home.heroFeatures.features.1.title"),
      description: t("home.heroFeatures.features.1.description"),
    },
    {
      icon: TrendingUp,
      title: t("home.heroFeatures.features.2.title"),
      description: t("home.heroFeatures.features.2.description"),
    },
    {
      icon: Shield,
      title: t("home.heroFeatures.features.3.title"),
      description: t("home.heroFeatures.features.3.description"),
    },
  ]

  return (
    <section className="bg-background px-4 py-8 sm:px-6 sm:py-10 md:py-12 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 text-center sm:mb-16 lg:mb-20">
          <h1 className="mb-3 text-xl leading-tight font-bold text-foreground sm:mb-5 sm:text-3xl md:text-4xl lg:text-5xl">
            {t("home.heroFeatures.title1")}{" "}
            <span className="text-primary">
              {t("home.heroFeatures.title2")}
            </span>
          </h1>

          <p className="mx-auto max-w-4xl px-4 text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            {t("home.heroFeatures.description")}
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group cursor-pointer rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md sm:p-5 lg:p-6"
            >
              {/* Icon Container */}
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20 sm:mb-6 sm:h-12 sm:w-12">
                <feature.icon
                  className="h-5 w-5 text-primary sm:h-6 sm:w-6"
                  strokeWidth={2.5}
                />
              </div>

              {/* Title */}
              <h3 className="mb-2 text-lg font-semibold text-foreground sm:mb-3 sm:text-xl">
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
