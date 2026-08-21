import React from "react"
import { useTranslation } from "react-i18next"
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll"
import OverviewView from "@/dashboard/organization/overview/OverviewView"
import {
  MOCK_ALERTS,
  MOCK_CORRELATION_MATRIX_DATA,
  MOCK_EBITDA_SUMMARY,
  MOCK_FINDINGS,
  MOCK_INSPECTIONS,
  MOCK_KRIS,
  MOCK_ORG_NAME,
  MOCK_RISKS,
  MOCK_SITES,
} from "@/dashboard/organization/overview/overviewMockData"

// Phase E (theme-improvement-initiative): replaces the landing page's
// hand-drawn product mockup pattern with the ACTUAL authenticated Overview
// page, fed the same mock fixtures OverviewPreview.tsx uses for its own
// (internal, route-gated) demo. Deliberately does NOT go through
// OverviewPreview.tsx or its assertPreviewOnly() guard: that guard throws
// unconditionally in dev builds (by design, to catch a throwaway preview
// route reaching prod by accident) -- exactly wrong for a component meant
// to be permanently, intentionally public. This renders OverviewView
// directly instead, which is what OverviewPreview.tsx itself renders once
// the guard passes; the guard's own job (catching an ACCIDENTAL leak) has
// nothing to do with THIS deliberate, permanent embed.
//
// OverviewView is a full authenticated dashboard page (own h1, its full
// metrics/charts/tables) -- not a compact widget. Rather than shrinking or
// cropping it to fit a tight hero-card slot (illegible at that scale, and
// fighting the page's own internal spacing), it gets its own section with
// a generous max-height + overflow-hidden "windowed" treatment and a
// bottom fade-out, the same "peek into the real app" pattern several
// dev-tool marketing sites use for a genuine (not staged) product
// screenshot. No pointer-events suppression: letting a visitor scroll/
// hover inside the frame (search, expand a table row, etc.) reinforces
// that this is the real, functioning page, not a static image -- nothing
// in OverviewView performs a live mutation or network call when fed
// override props, so there's nothing unsafe to leave interactive.
const ProductDemoSection: React.FC = () => {
  const { t } = useTranslation()
  const [revealRef, revealVisible] = useRevealOnScroll<HTMLDivElement>()

  return (
    <section
      id="product-demo"
      className="scroll-mt-16 bg-background px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 max-w-2xl sm:mb-10">
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

        <div
          ref={revealRef}
          className={`relative overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-foreground/5 transition-all duration-700 ease-out ${
            revealVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <span className="flex items-center gap-1.5 font-mono-data text-[10px] font-semibold tracking-wide text-teal-700 uppercase dark:text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-current opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
              </span>
              {t("home.productDemo.liveLabel")}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 font-mono-data text-[10px] font-semibold text-muted-foreground">
              {t("home.productDemo.badge")}
            </span>
          </div>

          {/* max-h + overflow-hidden windows the real page instead of
              scaling it -- a CSS transform: scale() here would blur text
              and desync hit-testing from what's visually shown, worse
              trade-offs than just showing a genuine, unscaled slice of the
              real page. */}
          <div className="max-h-[640px] overflow-hidden">
            <div className="p-4 sm:p-6">
              <OverviewView
                titleHeadingLevel="h2"
                orgName={MOCK_ORG_NAME}
                risks={{ data: MOCK_RISKS, isLoading: false, isError: false }}
                kris={{ data: MOCK_KRIS, isLoading: false, isError: false }}
                alerts={{
                  data: MOCK_ALERTS,
                  isLoading: false,
                  isError: false,
                }}
                findings={{
                  data: MOCK_FINDINGS,
                  isLoading: false,
                  isError: false,
                }}
                inspections={{
                  data: MOCK_INSPECTIONS,
                  isLoading: false,
                  isError: false,
                }}
                correlationMatrix={{
                  data: MOCK_CORRELATION_MATRIX_DATA,
                  isLoading: false,
                  isError: false,
                }}
                sites={{ data: MOCK_SITES, isLoading: false, isError: false }}
                ebitda={{
                  data: MOCK_EBITDA_SUMMARY,
                  isLoading: false,
                  isError: false,
                }}
              />
            </div>
          </div>

          {/* Fade-out overlay: makes the max-height cutoff read as an
              intentional "peek" rather than content abruptly clipped.
              pointer-events-none so it never blocks scrolling/interacting
              with the real page content underneath. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-card to-transparent"
          />
        </div>
      </div>
    </section>
  )
}

export default ProductDemoSection
