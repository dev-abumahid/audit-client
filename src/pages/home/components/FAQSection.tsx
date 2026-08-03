import { Minus, Plus } from "lucide-react"
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
        <div className="mb-12 text-center sm:mb-16">
          <h2 className="mb-3 text-xl leading-tight font-bold text-foreground sm:mb-5 sm:text-3xl md:text-4xl lg:text-5xl">
            {t("home.faq.title1")}{" "}
            <span className="text-primary">{t("home.faq.title2")}</span>
          </h2>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
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
                onClick={() => toggleAccordion(index)}
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
                id={`faq-question-${index}`}
                className="group flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-accent/10 sm:px-8 sm:py-6"
              >
                <span className="pr-4 text-base font-medium text-foreground sm:text-lg">
                  {faq.question}
                </span>

                <div className="shrink-0">
                  {openIndex === index ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary sm:h-9 sm:w-9">
                      <Minus
                        className="h-5 w-5 text-primary-foreground"
                        strokeWidth={2.5}
                      />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-muted-foreground/10 sm:h-9 sm:w-9">
                      <Plus
                        className="h-5 w-5 text-muted-foreground"
                        strokeWidth={2.5}
                      />
                    </div>
                  )}
                </div>
              </button>

              {/* Answer -- always rendered (rather than conditionally
                  mounted) so aria-controls on the button above always
                  resolves to a real element in the DOM, even while
                  collapsed. Visibility is toggled via `hidden` instead. */}
              <div
                id={`faq-answer-${index}`}
                role="region"
                aria-labelledby={`faq-question-${index}`}
                hidden={openIndex !== index}
                className="px-6 pb-5 sm:px-8 sm:pb-6"
              >
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
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
