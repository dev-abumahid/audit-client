import {
  ClipboardCheck,
  FileText,
  ListChecks,
  MapPin,
  Users,
  UsersRound,
} from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"

const FeaturesSection: React.FC = () => {
  const { t } = useTranslation()
  const features = [
    {
      icon: FileText,
      title: t("home.featureSection.features.0.title"),
      description: t("home.featureSection.features.0.description"),
    },
    {
      icon: ClipboardCheck,
      title: t("home.featureSection.features.1.title"),
      description: t("home.featureSection.features.1.description"),
    },
    {
      icon: ListChecks,
      title: t("home.featureSection.features.2.title"),
      description: t("home.featureSection.features.2.description"),
    },
    {
      icon: Users,
      title: t("home.featureSection.features.3.title"),
      description: t("home.featureSection.features.3.description"),
    },
    {
      icon: MapPin,
      title: t("home.featureSection.features.4.title"),
      description: t("home.featureSection.features.4.description"),
    },
    {
      icon: UsersRound,
      title: t("home.featureSection.features.5.title"),
      description: t("home.featureSection.features.5.description"),
    },
  ]

  return (
    <section
      id="features"
      className="scroll-mt-16 bg-background px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-12 text-center sm:mb-16">
          <h2 className="mb-3 text-xl leading-tight font-bold text-foreground sm:mb-5 sm:text-3xl md:text-4xl lg:text-5xl">
            {t("home.featureSection.title1")}{" "}
            <span className="text-primary">
              {t("home.featureSection.title2")}
            </span>
          </h2>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
            {t("home.featureSection.description")}
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Left Side - Image */}
          <div className="order-2 lg:order-1">
            <div className="relative overflow-hidden rounded-2xl border border-border">
              <img
                src="https://images.unsplash.com/photo-1581094271901-8022df4466f9?w=800&h=1000&fit=crop"
                alt="Construction workers with safety equipment reviewing documents"
                className="h-auto w-full object-cover"
              />
            </div>
          </div>

          {/* Right Side - Features List */}
          <div className="order-1 space-y-3 lg:order-2">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group flex cursor-pointer gap-4 rounded-xl border p-2 transition-colors hover:bg-card/50 sm:gap-5"
              >
                {/* Icon */}
                <div className="shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20 sm:h-12 sm:w-12">
                    <feature.icon
                      className="h-5 w-5 text-primary sm:h-6 sm:w-6"
                      strokeWidth={2.5}
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-semibold text-foreground transition-colors group-hover:text-primary sm:mb-3 sm:text-xl">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection
