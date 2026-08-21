import React from "react"
import { useTranslation } from "react-i18next"
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll"
import KriTrendWidget from "./productDemo/KriTrendWidget"
import RiskGraphWidget from "./productDemo/RiskGraphWidget"
import RiskMatrixWidget from "./productDemo/RiskMatrixWidget"

// Phase E (theme-improvement-initiative), redesigned after live feedback:
// the first version of this section literally embedded the authenticated
// OverviewView dashboard -- real, but read as a cropped admin screenshot,
// not a designed marketing moment. This version keeps the same "not
// fabricated" commitment (every widget computes from the same real mock
// data and scoring functions the live app uses -- see each widget's own
// comment) but presents it the way HeroProductVisual already does for the
// hero: stylized, theme-token-driven DOM, now with real motion layered on
// top instead of a static illustration.
const ProductDemoSection: React.FC = () => {
  const { t } = useTranslation()
  const [revealRef, revealVisible] = useRevealOnScroll<HTMLDivElement>()

  return (
    <section
      id="product-demo"
      className="scroll-mt-16 bg-background px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-2xl sm:mb-14">
          <span className="text-xs font-semibold tracking-wide text-teal-700 uppercase dark:text-primary">
            {t("home.productDemo.eyebrow")}
          </span>
          <h2 className="mt-3 font-heading text-2xl font-bold text-balance text-foreground sm:text-3xl md:text-4xl">
            {t("home.productDemo.title")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("home.productDemo.description")}
          </p>
        </div>

        <div ref={revealRef} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <RiskMatrixWidget animate={revealVisible} />
          <KriTrendWidget animate={revealVisible} />
          <RiskGraphWidget animate={revealVisible} />
        </div>
      </div>
    </section>
  )
}

export default ProductDemoSection
