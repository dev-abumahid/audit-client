import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  MOCK_KRIS,
  MOCK_RISKS,
} from "@/dashboard/organization/overview/overviewMockData"
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll"
import { kriStatusMeta } from "@/dashboard/organization/kri/kriConfig"
import { riskCategoryLabel } from "@/utils/riskConfig"
import { computeKriStatus } from "@/utils/kriStatus"
import { getRiskSeverityLevel } from "@/utils/riskScoring"
import { SEVERITY_STYLES, severityBadgeClasses } from "@/utils/severityStyles"
import {
  MOCK_AUDIT_FINDINGS,
  MOCK_MITIGATIONS,
} from "./connectedDataModelMockData"

// Landing overhaul PR9 (theme-improvement-initiative): the signature
// interaction. Replaces a paragraph-only "one data model underlies every
// module" claim with something a visitor can click through -- the same
// risk object (CYB-014 / "risk-1", already the hub RiskGraphWidget and the
// KRI slider use) appears as a real register row, a real KRI, a real audit
// finding, and a real mitigation. Real Risk->KRI is already-wired mock
// data; Risk->AuditFinding/Mitigation use the PR8 mock rows authored
// specifically to fill in a real, previously-empty field -- see that
// file's own comment for the honesty breakdown. No "Control" hop: no
// standalone Control entity exists in this data model (the closest
// equivalent, control_design_eff/control_operating_eff, lives directly on
// Risk), so it's dropped rather than invented.
//
// Deliberately deferred: a "pulse travels from center to related object"
// animation layer. This reveal (center appears -> lines draw outward ->
// satellites fade in) plus the click-driven simultaneous highlight is the
// full scope for this first ship; the pulse is a stretch enhancement for
// a later pass, not blocking here.
const RISK = MOCK_RISKS[0]
const KRI = MOCK_KRIS[0]
const FINDING = MOCK_AUDIT_FINDINGS[0]
const MITIGATION = MOCK_MITIGATIONS[0]

export default function ConnectedDataModelSection() {
  const { t } = useTranslation()
  const [revealRef, revealVisible] = useRevealOnScroll<HTMLDivElement>()
  const [highlighted, setHighlighted] = useState(false)

  const severity = getRiskSeverityLevel(RISK.residual_score)
  const kriStatus = computeKriStatus(
    KRI.current_value,
    KRI.alert_threshold,
    KRI.target_value
  )
  const kriMeta = kriStatusMeta(kriStatus)

  const toggleHighlight = () => setHighlighted((h) => !h)

  // Shared highlight ring applied identically to all 5 cards -- the
  // simultaneity across every card is the point of the interaction, not a
  // sequential cascade.
  const highlightClass = highlighted
    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
    : ""

  return (
    // Landing overhaul PR11 (density/rhythm pass): a real border-t here --
    // ProductDemoSection, FeaturesSection, and this section were three
    // consecutive bg-background, same-padding-scale sections in a row with
    // no visual break, exactly the "wall" risk the v3 motion plan's
    // density section warned about. Same thin-delineation technique
    // already established (HeroFeatures' border-y, FinalCTASection's
    // border-t) rather than a heavier background-color change, since this
    // section's own content already carries plenty of visual weight.
    <section className="scroll-mt-16 border-t border-border bg-background px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      {/* max-w-4xl -- matches FAQSection's own centered-column width.
          Design-team finding: this section, FAQSection, and FinalCTASection
          each picked a different max-w (5xl/4xl/3xl) independently, so their
          left edges crept progressively narrower down the page with no
          visual signal why. Standardized to the width FAQSection already
          used; this section's own interactive grid already caps itself
          tighter internally (max-w-3xl), so this only moves the header's
          and card-row's shared centering point, not their real content
          width. */}
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 max-w-2xl sm:mb-14">
          <span className="text-xs font-semibold tracking-wide text-teal-700 uppercase dark:text-primary">
            {t("home.connectedDataModel.eyebrow")}
          </span>
          <h2 className="mt-3 font-heading text-2xl font-semibold text-balance text-foreground sm:text-3xl md:text-4xl">
            {t("home.connectedDataModel.title")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("home.connectedDataModel.description")}
          </p>
        </div>

        <div ref={revealRef} className="relative">
          {/* Review finding on PR #1021: aria-pressed on 5 buttons sharing
              one boolean is a real ARIA misuse -- that attribute means "this
              control's own state," not "an unrelated global flag happens to
              be true." Replaced with a role="group" wrapper (these 5 cards
              are simultaneous views of one record, not mutually-exclusive
              tabs/radios -- DemoTabs'/RoleScopedRegisterWidget's own
              tablist/radiogroup patterns don't fit) plus a single aria-live
              region below announcing the outcome once, instead of 5
              per-button "pressed"/"not pressed" toggles with no explanation
              of why they're linked. */}
          <div
            role="group"
            aria-label={t("home.connectedDataModel.groupLabel")}
          >
            {/* Center: the risk itself */}
            <button
              type="button"
              onClick={toggleHighlight}
              className={`focus-ring mx-auto flex max-w-sm flex-col items-center gap-2 rounded-xl border border-border bg-card p-5 text-center shadow-lg shadow-foreground/[0.03] transition-all duration-500 ease-out hover:border-primary/40 hover:shadow-md motion-reduce:transition-none ${highlightClass} ${
                revealVisible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-3 opacity-0"
              }`}
            >
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${severityBadgeClasses(severity)}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES[severity].dot}`}
                />
                {t(`riskLevel.${severity}`)}
              </span>
              <span className="font-mono-data text-sm font-bold text-foreground">
                {RISK.ref}
              </span>
              <h3 className="text-base font-semibold text-foreground sm:text-lg">
                {RISK.name}
              </h3>
              <span className="text-xs text-muted-foreground">
                {riskCategoryLabel(t, RISK.category)}
              </span>
            </button>

            {/* Fan-out connector: only where the 4 satellites render in one
              row (sm+, grid-cols-4 below) -- hidden on mobile where they
              stack, same precedent as the other rails in this codebase
              skipping grid states they can't cleanly represent. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 100 20"
              preserveAspectRatio="none"
              // Review finding on PR #1021: at the old h-6 (24px) against a
              // max-w-3xl (768px) container, preserveAspectRatio="none"'s
              // non-uniform scale (~7.7x horizontal vs ~1.2x vertical)
              // flattened the fan toward near-horizontal, close to a single
              // smear instead of a visible V. Taller box narrows that gap
              // without touching the coordinate math.
              className="mx-auto hidden h-14 w-full max-w-3xl sm:block"
            >
              {[12.5, 37.5, 62.5, 87.5].map((x, i) => (
                <line
                  key={x}
                  x1="50"
                  y1="0"
                  x2={x}
                  y2="20"
                  pathLength={1}
                  className={`stroke-primary/40 transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none ${
                    revealVisible
                      ? "[stroke-dashoffset:0]"
                      : "[stroke-dashoffset:1]"
                  }`}
                  style={
                    revealVisible
                      ? { transitionDelay: `${200 + i * 120}ms` }
                      : undefined
                  }
                  strokeWidth={0.5}
                  strokeDasharray={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
              {/* Register row */}
              <button
                type="button"
                onClick={toggleHighlight}
                className={`focus-ring rounded-lg border border-border bg-card p-3 text-left transition-all duration-500 ease-out hover:border-primary/40 hover:shadow-md motion-reduce:transition-none ${highlightClass} ${
                  revealVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-2 opacity-0"
                }`}
                style={revealVisible ? { transitionDelay: "700ms" } : undefined}
              >
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {t("home.connectedDataModel.cards.register")}
                </span>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_STYLES[severity].dot}`}
                  />
                  <span className="font-mono-data text-[11px] text-muted-foreground">
                    {RISK.ref}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-foreground">
                  {RISK.name}
                </p>
              </button>

              {/* KRI */}
              <button
                type="button"
                onClick={toggleHighlight}
                className={`focus-ring rounded-lg border border-border bg-card p-3 text-left transition-all duration-500 ease-out hover:border-primary/40 hover:shadow-md motion-reduce:transition-none ${highlightClass} ${
                  revealVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-2 opacity-0"
                }`}
                style={revealVisible ? { transitionDelay: "820ms" } : undefined}
              >
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {t("home.connectedDataModel.cards.kri")}
                </span>
                <p className="mt-1.5 line-clamp-1 text-xs text-foreground">
                  {KRI.name}
                </p>
                <span
                  className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${severityBadgeClasses(kriMeta.severityLevel)}`}
                >
                  {t(kriMeta.labelKey)}
                </span>
              </button>

              {/* Audit finding */}
              <button
                type="button"
                onClick={toggleHighlight}
                className={`focus-ring rounded-lg border border-border bg-card p-3 text-left transition-all duration-500 ease-out hover:border-primary/40 hover:shadow-md motion-reduce:transition-none ${highlightClass} ${
                  revealVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-2 opacity-0"
                }`}
                style={revealVisible ? { transitionDelay: "940ms" } : undefined}
              >
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {t("home.connectedDataModel.cards.finding")}
                </span>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="font-mono-data text-[11px] text-muted-foreground">
                    {FINDING.ref}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-foreground">
                  {FINDING.title}
                </p>
              </button>

              {/* Mitigation */}
              <button
                type="button"
                onClick={toggleHighlight}
                className={`focus-ring rounded-lg border border-border bg-card p-3 text-left transition-all duration-500 ease-out hover:border-primary/40 hover:shadow-md motion-reduce:transition-none ${highlightClass} ${
                  revealVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-2 opacity-0"
                }`}
                style={
                  revealVisible ? { transitionDelay: "1060ms" } : undefined
                }
              >
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {t("home.connectedDataModel.cards.mitigation")}
                </span>
                <p className="mt-1.5 line-clamp-2 text-xs text-foreground">
                  {MITIGATION.title}
                </p>
                <span className="mt-1.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase">
                  {MITIGATION.mitigation_type}
                </span>
              </button>
            </div>
          </div>

          {/* Single announcement instead of 5 per-button aria-pressed
              toggles -- fires once when the shared state actually changes,
              not on every unrelated focus move. */}
          <span role="status" aria-live="polite" className="sr-only">
            {highlighted
              ? t("home.connectedDataModel.highlightAnnouncement")
              : ""}
          </span>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t("home.connectedDataModel.hint")}
          </p>
        </div>
      </div>
    </section>
  )
}
