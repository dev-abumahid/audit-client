import React, { useState } from "react"
import { useTranslation } from "react-i18next"

interface FAQItem {
  question: string
  answer: string
}

const FAQSection: React.FC = () => {
  const { t } = useTranslation()
  const [openIndex, setOpenIndex] = useState<number>(0)

  const faqs: FAQItem[] = [
    {
      question: t("home.faq.questions.0.question"),
      answer: t("home.faq.questions.0.answer"),
    },
    {
      question: t("home.faq.questions.1.question"),
      answer: t("home.faq.questions.1.answer"),
    },
    {
      question: t("home.faq.questions.2.question"),
      answer: t("home.faq.questions.2.answer"),
    },
    {
      question: t("home.faq.questions.3.question"),
      answer: t("home.faq.questions.3.answer"),
    },
    {
      question: t("home.faq.questions.4.question"),
      answer: t("home.faq.questions.4.answer"),
    },
  ]

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? -1 : index)
  }

  return (
    <section
      id="faq"
      className="scroll-mt-16 bg-background px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
    >
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-12 sm:mb-16">
          <span className="text-xs font-semibold tracking-wide text-teal-700 uppercase dark:text-primary">
            {t("home.faq.eyebrow")}
          </span>
          <h2 className="mt-3 mb-4 font-heading text-2xl leading-tight font-semibold text-balance text-foreground sm:text-3xl md:text-4xl">
            {t("home.faq.title1")} <span>{t("home.faq.title2")}</span>
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            {t("home.faq.description")}
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-4 sm:space-y-5">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              {/* Question Button */}
              <button
                type="button"
                onClick={() => toggleAccordion(index)}
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
                id={`faq-question-${index}`}
                className="focus-ring group flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-muted/40 sm:px-8 sm:py-6"
              >
                <span className="pr-4 text-base font-semibold text-foreground sm:text-lg">
                  {faq.question}
                </span>

                {/* Single icon that morphs between + and − via transform,
                    instead of swapping two DOM nodes on toggle */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-150 sm:h-9 sm:w-9 ${
                    openIndex === index
                      ? "bg-primary"
                      : "bg-muted group-hover:bg-muted-foreground/10"
                  }`}
                >
                  <div className="relative h-3.5 w-3.5">
                    <span
                      className={`absolute top-1/2 left-0 h-0.5 w-3.5 -translate-y-1/2 rounded-full transition-colors duration-150 ${
                        openIndex === index
                          ? "bg-primary-foreground"
                          : "bg-muted-foreground"
                      }`}
                    />
                    <span
                      className={`absolute top-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full transition-all duration-150 ${
                        openIndex === index
                          ? "h-0 bg-primary-foreground"
                          : "h-3.5 bg-muted-foreground"
                      }`}
                    />
                  </div>
                </div>
              </button>

              {/* Answer -- always rendered (rather than conditionally
                  mounted) so aria-controls on the button above always
                  resolves to a real element in the DOM, even while
                  collapsed. Visibility is toggled via `hidden` instead. */}
              {/* Not height/opacity-animated like the icon above: the
                  `hidden` attribute is what makes this panel genuinely
                  invisible to assistive tech (it resolves to computed
                  display:none), and CSS can't transition display:none.
                  Animating it would mean either overriding [hidden]'s
                  display via author CSS -- which un-hides the panel from
                  screen readers while it's still supposed to be closed --
                  or reaching for `@starting-style`/`allow-discrete`, whose
                  browser support isn't verified for this stack. Left as an
                  instant toggle rather than risk a real (untested-by-CI)
                  a11y regression for a cosmetic mismatch with the icon. */}
              <div
                id={`faq-answer-${index}`}
                role="region"
                aria-labelledby={`faq-question-${index}`}
                hidden={openIndex !== index}
                className="px-6 pb-5 sm:px-8 sm:pb-6"
              >
                {/* max-w-[65ch] -- every other body paragraph on this page
                    is capped at 65-75 characters per line; this was the one
                    left unconstrained, running well past 100ch at desktop
                    width. */}
                <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FAQSection
