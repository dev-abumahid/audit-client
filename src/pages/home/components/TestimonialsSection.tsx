import { Quote, Star } from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"

interface Testimonial {
  rating: number
  quote: string
  title: string
  company: string
}

const TestimonialsSection: React.FC = () => {
  const { t } = useTranslation()
  const testimonials: Testimonial[] = [
    {
      rating: 5,
      quote: t("home.testimonials.reviews.0.quote"),
      title: t("home.testimonials.reviews.0.name"),
      company: t("home.testimonials.reviews.0.position"),
    },
    {
      rating: 5,
      quote: t("home.testimonials.reviews.1.quote"),
      title: t("home.testimonials.reviews.1.name"),
      company: t("home.testimonials.reviews.1.position"),
    },
    {
      rating: 5,
      quote: t("home.testimonials.reviews.2.quote"),
      title: t("home.testimonials.reviews.2.name"),
      company: t("home.testimonials.reviews.2.position"),
    },
  ]

  return (
    <section className="bg-background px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-12 text-center sm:mb-16">
          <h1 className="mb-3 text-xl leading-tight font-bold text-foreground sm:mb-5 sm:text-3xl md:text-4xl lg:text-5xl">
            {t("home.testimonials.title1")}{" "}
            <span className="text-primary">
              {t("home.testimonials.title2")}
            </span>
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
            {t("home.testimonials.description")}
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="group relative rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md sm:p-8"
            >
              {/* Quote Icon */}
              <div className="absolute -top-5 left-6 sm:left-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-md">
                  <Quote className="h-6 w-6 fill-current text-primary-foreground" />
                </div>
              </div>

              {/* Stars */}
              <div className="mt-8 mb-6 flex gap-1">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                ))}
              </div>

              {/* Quote */}
              <p className="mb-8 text-base leading-relaxed text-muted-foreground sm:text-lg">
                "{testimonial.quote}"
              </p>

              {/* Author Info */}
              <div className="border-t border-border pt-6">
                <h4 className="text-base font-semibold text-foreground sm:text-lg">
                  {testimonial.title}
                </h4>
                <p className="text-sm text-muted-foreground sm:text-base">
                  {testimonial.company}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default TestimonialsSection
