import { useRevealOnScroll } from "@/hooks/useRevealOnScroll"
import { useRevealStagger } from "@/hooks/useRevealStagger"
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
  const { t, i18n } = useTranslation()
  const [revealRef, revealVisible] = useRevealOnScroll<HTMLDivElement>()
  const settled = useRevealStagger(revealVisible, 4)
  const testimonials: Testimonial[] = [0, 1, 2, 3].map((i) => ({
    rating: 5,
    quote: t(`home.testimonials.reviews.${i}.quote`),
    title: t(`home.testimonials.reviews.${i}.name`),
    company: t(`home.testimonials.reviews.${i}.position`),
  }))

  // Locale-correct typographic marks, not straight ASCII quotes: this is
  // the one section leaning hardest into an editorial Fraunces treatment,
  // and a hardcoded `"` reads as a typewriter default against that.
  const [openQuote, closeQuote] = i18n.language?.startsWith("fr")
    ? ["« ", " »"]
    : ["“", "”"]

  // Plain bg-background, not a diluted bg-muted tint: at a ~2-lightness-
  // point gap between --muted and --background in light mode, a 30%
  // opacity wash was essentially invisible there and only did anything in
  // dark mode — the same broken pattern already fixed for the authority
  // band, just never applied here.
  return (
    <section className="bg-background px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-7xl">
        {/* Header - plain (no italic accent), see FeaturesSection */}
        <div className="mb-12 max-w-2xl sm:mb-16">
          <span className="text-xs font-semibold tracking-wide text-teal-700 uppercase dark:text-primary">
            {t("home.testimonials.eyebrow")}
          </span>
          <h2 className="mt-3 mb-4 font-heading text-2xl leading-tight font-semibold text-balance text-foreground sm:text-3xl md:text-4xl">
            {t("home.testimonials.title1")}{" "}
            <span>{t("home.testimonials.title2")}</span>
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            {t("home.testimonials.description")}
          </p>
        </div>

        {/* Testimonials Grid - 2x2 at every breakpoint above mobile so 4
            cards never leave an orphaned gap the way 3-in-a-3-col did */}
        <div ref={revealRef} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              // No hover state: this is a static illustrative-quote card
              // with no onClick/keyboard handler behind it, and a
              // hover-triggered lift/shadow implies clickability that
              // doesn't exist (aexa-frontend#510).
              className={`relative flex flex-col rounded-2xl border border-border bg-card p-6 sm:p-8 ${
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
              {/* Illustrative disclosure - keeps the aspirational tone honest */}
              <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {t("home.testimonials.illustrativeLabel")}
              </span>

              <Quote
                className="mb-4 h-7 w-7 text-primary/40"
                strokeWidth={1.5}
              />

              {/* Quote - a step larger than the name/title metadata below it
                  so it reads as the card's focal point, not co-equal text */}
              <p className="mb-6 flex-1 font-heading text-lg leading-relaxed text-foreground sm:text-xl">
                {openQuote}
                {testimonial.quote}
                {closeQuote}
              </p>

              {/* Stars in primary teal, not amber: amber is used elsewhere
                  on the page (risk matrix, compliance status chips) to
                  specifically mean caution/medium-severity, so reusing it
                  here as a generic "positive rating" signal would work
                  against that established vocabulary. */}
              <div className="mb-5 flex gap-1">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>

              {/* Author Info */}
              <div className="border-t border-border pt-5">
                <h3 className="text-base font-semibold text-foreground sm:text-lg">
                  {testimonial.title}
                </h3>
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
