import type { KeyboardEvent } from "react"
import { useState } from "react"
import {
  CheckCircle2,
  FileText,
  Link2,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { kriStatusMeta, formatKriNumber } from "@/dashboard/organization/kri/kriConfig"
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll"
import { computeKriStatus } from "@/utils/kriStatus"
import { LINE_OF_DEFENSE_LABEL_KEY } from "@/utils/lineOfDefense"
import { riskCategoryLabel } from "@/utils/riskConfig"
import { getRiskSeverityLevel } from "@/utils/riskScoring"
import {
  SEVERITY_STYLES,
  severityBadgeClasses,
  type SeverityLevel,
} from "@/utils/severityStyles"
import { CONNECTED_DEMO_RISKS } from "./connectedDataModelDemoData"

// Landing overhaul (connected-data-model redesign, replaces the PR9
// single-risk fan-out): a visitor picks one of 4 real risks and sees the
// records genuinely connected to it elsewhere in Qiyrix. No "Control" card
// -- no standalone Control entity exists in this data model;
// control_design_eff/control_operating_eff live directly on Risk instead.
//
// Copy correction: the PR9 copy claimed "the same risk object underlies...
// updating one updates what everyone else sees" / "because it's the same
// record" -- that's not what's actually happening. KRI/AuditFinding/
// Mitigation are distinct records, each linked back to Risk by its own
// foreign key (risk_id / linked_risk_id). The new copy says "connected
// records," not "the same record."
const DEFAULT_RISK_ID = CONNECTED_DEMO_RISKS[0].risk.id

function formatDate(iso: string, language: string) {
  return new Date(iso).toLocaleDateString(
    language?.startsWith("fr") ? "fr-FR" : "en-US",
    { year: "numeric", month: "short", day: "numeric" }
  )
}

// Ties the connector line, its link-icon anchor, and every card's top
// accent to the selected risk's own severity color, instead of a fixed
// brand teal. Reuses the exact same Tailwind shades severityStyles.ts
// already verified pass AA contrast (see that file's own header comment
// for the measured ratios) -- the raw --risk-critical/high/medium/low
// tokens fail 3:1 for 3 of 4 levels in light mode, so this deliberately
// does NOT use those directly. severityStyles.ts has no border-t-*/
// stroke-* variants of its own, so those are added here using the same
// verified color values, not new ones.
const SEVERITY_ACCENT: Record<
  "critical" | "high" | "medium" | "low",
  { border: string; text: string; borderTop: string; stroke: string }
> = {
  critical: {
    border: "border-red-700 dark:border-red-400",
    text: "text-red-700 dark:text-red-400",
    borderTop: "border-t-red-700 dark:border-t-red-400",
    stroke: "stroke-red-700/70 dark:stroke-red-400/70",
  },
  high: {
    border: "border-orange-700 dark:border-orange-400",
    text: "text-orange-700 dark:text-orange-400",
    borderTop: "border-t-orange-700 dark:border-t-orange-400",
    stroke: "stroke-orange-700/70 dark:stroke-orange-400/70",
  },
  medium: {
    border: "border-amber-800 dark:border-amber-400",
    text: "text-amber-800 dark:text-amber-400",
    borderTop: "border-t-amber-800 dark:border-t-amber-400",
    stroke: "stroke-amber-800/70 dark:stroke-amber-400/70",
  },
  low: {
    border: "border-emerald-700 dark:border-emerald-400",
    text: "text-emerald-700 dark:text-emerald-400",
    borderTop: "border-t-emerald-700 dark:border-t-emerald-400",
    stroke: "stroke-emerald-700/70 dark:stroke-emerald-400/70",
  },
}

// Mitigation.status is a plain `string` on the real type (no enum), but
// this demo data only ever produces "planned"/"in_progress"/"completed" --
// the same 3-state vocabulary AuditPage.tsx's own STATUS_CONFIG colors via
// info/medium/low. Reused here rather than inventing new colors, with a
// neutral fallback for any value outside that vocabulary (same pattern as
// AllFindingsPage.tsx's NEUTRAL_BADGE).
const MITIGATION_STATUS_LEVEL: Record<string, SeverityLevel> = {
  planned: "info",
  in_progress: "medium",
  completed: "low",
}

export default function ConnectedDataModelSection() {
  const { t, i18n } = useTranslation()
  const [revealRef, revealVisible] = useRevealOnScroll<HTMLDivElement>()
  const [selectedId, setSelectedId] = useState(DEFAULT_RISK_ID)

  const selectedIndex = CONNECTED_DEMO_RISKS.findIndex(
    (entry) => entry.risk.id === selectedId
  )
  const selected = CONNECTED_DEMO_RISKS[selectedIndex]
  const { risk, kri, finding, mitigation } = selected
  const severity = getRiskSeverityLevel(risk.residual_score)
  const accent = SEVERITY_ACCENT[severity]

  const handleSelectorKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex: number | null = null
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      nextIndex = (index + 1) % CONNECTED_DEMO_RISKS.length
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      nextIndex =
        (index - 1 + CONNECTED_DEMO_RISKS.length) % CONNECTED_DEMO_RISKS.length
    else if (e.key === "Home") nextIndex = 0
    else if (e.key === "End") nextIndex = CONNECTED_DEMO_RISKS.length - 1
    if (nextIndex === null) return

    e.preventDefault()
    const nextId = CONNECTED_DEMO_RISKS[nextIndex].risk.id
    setSelectedId(nextId)
    document.getElementById(`cdm-risk-${nextId}`)?.focus()
  }

  // 4 fixed slots regardless of what's actually connected -- keeps the
  // layout from jumping if a future demo risk lacks a record type this
  // component still knows how to render as a genuine empty state.
  const kriStatus = kri
    ? computeKriStatus(kri.current_value, kri.alert_threshold, kri.target_value)
    : null
  const kriMeta = kriStatus ? kriStatusMeta(kriStatus) : null

  // Illustrative trend toward the KRI's real current_value -- KRI has no
  // historical-value field anywhere in the schema or mock data, so this is
  // NOT a real time series (no dates are shown, deliberately, so it never
  // reads as one). An eased (not linear) interpolation from a worse
  // starting point toward the real current_value -- a plain lerp produces
  // perfectly collinear points, which render as a single straight diagonal
  // segment (looks like a rendering bug, not a trend line).
  const kriTrendPoints = kri
    ? Array.from({ length: 6 }, (_, i) => {
        const t = i / 5
        const eased = 1 - (1 - t) * (1 - t)
        const start = kri.current_value + (kri.alert_threshold - kri.current_value) * 0.7
        return start + (kri.current_value - start) * eased
      })
    : []

  // SVG coordinates for the sparkline above, computed once (not per-point
  // inside the render map, which recomputed the same min/max on every
  // iteration) so the polyline, its area fill, and the current-value dot
  // marker all read off the same point set.
  const kriSparklineMin = kriTrendPoints.length ? Math.min(...kriTrendPoints) : 0
  const kriSparklineMax = kriTrendPoints.length
    ? Math.max(...kriTrendPoints) || 1
    : 1
  const kriSparklinePoints = kriTrendPoints.map((v, i) => {
    const norm =
      kriSparklineMax === kriSparklineMin
        ? 0.5
        : (v - kriSparklineMin) / (kriSparklineMax - kriSparklineMin)
    return {
      x: (i / (kriTrendPoints.length - 1)) * 58 + 1,
      y: 18 - norm * 16,
    }
  })

  // AuditFinding.severity is a plain `string` on the real type, not a
  // SeverityLevel union -- `in` would walk SEVERITY_STYLES' prototype
  // chain (e.g. a severity value of "toString" would incorrectly match),
  // so this checks the object's own keys via hasOwnProperty instead.
  const findingHasKnownSeverity = Boolean(
    finding &&
      Object.prototype.hasOwnProperty.call(SEVERITY_STYLES, finding.severity)
  )
  const findingSeverity = findingHasKnownSeverity
    ? (finding!.severity as keyof typeof SEVERITY_STYLES)
    : "neutral"

  return (
    <section className="scroll-mt-16 border-t border-border bg-background px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-5xl">
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

        <div
          ref={revealRef}
          className={`transition-all duration-500 ease-out motion-reduce:transition-none ${
            revealVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          {/* Risk selector: a real radiogroup (exactly one risk selected at
              a time), roving tabindex + arrow-key nav -- same established
              pattern as RoleScopedRegisterWidget's role picker. */}
          <div
            role="radiogroup"
            aria-label={t("home.connectedDataModel.selectorLabel")}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {CONNECTED_DEMO_RISKS.map((entry, index) => {
              const isActive = entry.risk.id === selectedId
              const entrySeverity = getRiskSeverityLevel(entry.risk.residual_score)
              return (
                <button
                  key={entry.risk.id}
                  id={`cdm-risk-${entry.risk.id}`}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={(e) => {
                    setSelectedId(entry.risk.id)
                    // Review finding: Safari doesn't reliably focus a
                    // <button> on mouse click, so roving tabindex (driven
                    // purely by React state, not real DOM focus) could
                    // leave a Safari mouse user's next Tab press landing
                    // somewhere unpredictable. Force it explicitly, same
                    // as the keyboard path below already does implicitly.
                    e.currentTarget.focus()
                  }}
                  onKeyDown={(e) => handleSelectorKeyDown(e, index)}
                  className={`focus-ring relative flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all duration-150 ease-out motion-reduce:transition-none ${
                    isActive
                      ? "border-primary bg-primary/[0.06] shadow-md shadow-primary/10"
                      : "border-border bg-card hover:border-primary/40 hover:bg-primary/[0.03]"
                  }`}
                >
                  {isActive && (
                    <CheckCircle2
                      aria-hidden="true"
                      className="absolute top-2.5 right-2.5 h-4 w-4 text-primary"
                    />
                  )}
                  <div className="flex w-full items-center justify-between gap-2 pr-5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${severityBadgeClasses(entrySeverity)}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES[entrySeverity].dot}`}
                      />
                      {t(`riskLevel.${entrySeverity}`)}
                    </span>
                  </div>
                  <span className="font-mono-data text-xs font-bold text-foreground">
                    {entry.risk.ref}
                  </span>
                  <p className="line-clamp-3 text-xs text-foreground">
                    {entry.risk.name}
                  </p>
                  <span className="block w-full truncate text-[10px] text-muted-foreground">
                    {riskCategoryLabel(t, entry.risk.category)} ·{" "}
                    {t("organization.riskRegister.residualScoreLabel")}{" "}
                    {entry.risk.residual_score}
                  </span>
                </button>
              )
            })}
          </div>

          <span role="status" aria-live="polite" className="sr-only">
            {t("home.connectedDataModel.selectionAnnouncement", {
              ref: risk.ref,
              name: risk.name,
            })}
          </span>

          {/* Container: everything below the selector lives inside one
              bordered panel, headed by which risk it's currently showing --
              design-team finding: without this wrapper, the hub/connector/
              cards read as loose floating pieces with no visual boundary
              tying them together as "this is one connected view." A
              thicker border + solid (not transparent) card background,
              not just border-border/bg-card/40 -- the transparent
              background blended toward the page's own bg-background,
              leaving too little contrast against the border to read as a
              real boundary. */}
          <div className="mt-6 rounded-2xl border-2 border-border bg-card p-5 sm:p-7">
            <p className="mb-5 text-sm font-semibold text-foreground">
              {t("home.connectedDataModel.panelTitle")}{" "}
              <span className="font-mono-data text-primary">{risk.ref}</span>
            </p>

            {/* Hub: the visual anchor the connectors radiate from. A left
                accent stripe colored by severity, "SELECTED RISK" eyebrow,
                then identity + category/score on the right of a divider --
                deliberately higher-contrast than the cards below it so
                "this is the one thing everything connects to" reads at a
                glance. key={selectedId} remounts on every selection so
                .animate-cdm-swap actually replays. */}
            <div key={selectedId}>
              <h3 className="sr-only">{t("home.connectedDataModel.hubLabel")}</h3>
              <div
                className={`animate-cdm-swap flex overflow-hidden rounded-lg border ${SEVERITY_STYLES[severity].border} bg-card`}
              >
                <span className={`w-1.5 shrink-0 ${SEVERITY_STYLES[severity].dot}`} />
                <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${severityBadgeClasses(severity)}`}
                    >
                      {t(`riskLevel.${severity}`)}
                    </span>
                    <span className="font-mono-data text-base font-bold text-foreground">
                      {risk.ref}
                    </span>
                  </div>
                  <span
                    aria-hidden="true"
                    className="hidden h-6 w-px bg-border sm:block"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {risk.name}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {riskCategoryLabel(t, risk.category)} ·{" "}
                      {t("organization.riskRegister.residualScoreLabel")}{" "}
                      {risk.residual_score}
                    </span>
                  </div>
                </div>
              </div>

              {/* Connector: a link icon anchors the hub, with one dashed
                  line per slot that actually has a connected record --
                  semantic (this object is related to this risk), not
                  decorative, so an empty slot gets no line. The 4 paths'
                  x-positions (12.5/37.5/62.5/87.5) assume 4 equal columns,
                  which only actually exist at the lg: breakpoint (the card
                  grid below is 1 col on mobile, 2 cols at sm:, 4 only at
                  lg:) -- showing this at sm: pointed 2 of the 4 lines at
                  gaps between wrapped rows instead of at their cards, so
                  it's hidden until lg: where the geometry is correct. */}
              <div className="relative mx-auto hidden h-10 max-w-3xl lg:block">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 100 40"
                  preserveAspectRatio="none"
                  className="h-full w-full"
                >
                  {[
                    { x: 12.5, present: true },
                    { x: 37.5, present: Boolean(kri) },
                    { x: 62.5, present: Boolean(finding) },
                    { x: 87.5, present: Boolean(mitigation) },
                  ]
                    .filter((slot) => slot.present)
                    .map((slot) => (
                      <path
                        key={slot.x}
                        // Branch point (54 for right-side slots, 46 for
                        // left) was hardcoded to 46 for every slot -- the
                        // 2 right-side paths (finding/mitigation) curved
                        // left toward 46 first, then had to backtrack all
                        // the way right to their actual x, crossing back
                        // over the left-side paths and rendering as a
                        // tangled loop right where they all met at top.
                        d={`M50,2 L50,16 Q50,20 ${slot.x < 50 ? 46 : 54},20 L${slot.x + (slot.x < 50 ? 4 : -4)},20 Q${slot.x},20 ${slot.x},24 L${slot.x},38`}
                        fill="none"
                        pathLength={1}
                        className={`animate-cdm-draw ${accent.stroke}`}
                        strokeWidth={1.25}
                        strokeDasharray="3 2.5"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                </svg>
                <span
                  className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-background p-1.5 ${accent.border}`}
                >
                  <Link2 aria-hidden="true" className={`h-3.5 w-3.5 ${accent.text}`} />
                </span>
              </div>

              <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:mt-0 sm:grid-cols-2 lg:grid-cols-4">
                {/* Register entry -- the risk itself, always present.
                    Deliberately different fields than the hub above
                    (status, line of defense) rather than repeating
                    ref/name/category/severity, so this card earns its own
                    place instead of duplicating the hub. */}
                <div
                  className={`animate-cdm-swap rounded-lg border border-t-2 border-border bg-card p-4 text-left shadow-sm shadow-foreground/[0.03] ${accent.borderTop}`}
                  style={{ animationDelay: "40ms" }}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                    {t("home.connectedDataModel.cards.register")}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs font-medium text-foreground">
                    {risk.name}
                  </p>
                  <dl className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="shrink-0">
                        {t("home.connectedDataModel.register.status")}
                      </dt>
                      <dd className="min-w-0 truncate font-medium text-foreground capitalize">
                        {risk.status}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="shrink-0">
                        {t("home.connectedDataModel.register.line")}
                      </dt>
                      <dd className="min-w-0 truncate font-medium text-foreground">
                        {t(LINE_OF_DEFENSE_LABEL_KEY[risk.line_of_defense])}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="shrink-0">
                        {t("home.connectedDataModel.register.updated")}
                      </dt>
                      <dd className="min-w-0 truncate font-medium text-foreground">
                        {formatDate(risk.updatedAt, i18n.language)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* KRI -- always present for these 4 demo risks. */}
                <div
                  className={`animate-cdm-swap rounded-lg border p-4 text-left transition-colors ${
                    kri
                      ? `border-t-2 border-border ${accent.borderTop} bg-card shadow-sm shadow-foreground/[0.03]`
                      : "border-border/70 bg-card/60"
                  }`}
                  style={{ animationDelay: "80ms" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" />
                      {t("home.connectedDataModel.cards.kri")}
                    </div>
                    {kriMeta && (
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${severityBadgeClasses(kriMeta.severityLevel)}`}
                      >
                        {t(kriMeta.labelKey)}
                      </span>
                    )}
                  </div>
                  {kri && kriMeta && kriStatus ? (
                    <>
                      <p className="mt-2 line-clamp-1 text-xs font-medium text-foreground">
                        {kri.name}
                      </p>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <div>
                          <span className="block text-[10px] tracking-wide text-muted-foreground uppercase">
                            {t("home.connectedDataModel.kri.current")}
                          </span>
                          <span className="font-mono-data text-base font-bold text-foreground">
                            {formatKriNumber(kri.current_value, i18n.language)}
                            {kri.unit === "%" ? "%" : ""}
                          </span>
                        </div>
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 60 20"
                          preserveAspectRatio="none"
                          className={`h-5 w-16 shrink-0 ${
                            // kriStatusMeta() only ever returns
                            // critical/medium/low (never "high") -- reuses
                            // the same AA-verified shade severityStyles.ts
                            // already defines (its own header comment
                            // documents the raw --risk-* tokens failing
                            // WCAG contrast in light mode), applied once
                            // here via `currentColor` for the fill/stroke/
                            // dot marker below.
                            (
                              SEVERITY_ACCENT[
                                kriMeta.severityLevel as keyof typeof SEVERITY_ACCENT
                              ] ?? SEVERITY_ACCENT.low
                            ).text
                          }`}
                        >
                          {kriSparklinePoints.length > 1 && (
                            <>
                              {/* Area fill under the line -- an unadorned
                                  1px stroke with nothing else around it
                                  read as a stray/broken line rather than a
                                  deliberate chart element; the fill plus
                                  the end-value dot below both tie it back
                                  to the CURRENT number it's illustrating. */}
                              <polygon
                                points={`${kriSparklinePoints[0].x},20 ${kriSparklinePoints
                                  .map((p) => `${p.x},${p.y}`)
                                  .join(" ")} ${
                                  kriSparklinePoints[kriSparklinePoints.length - 1].x
                                },20`}
                                fill="currentColor"
                                fillOpacity={0.15}
                              />
                              <polyline
                                points={kriSparklinePoints
                                  .map((p) => `${p.x},${p.y}`)
                                  .join(" ")}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <circle
                                cx={kriSparklinePoints[kriSparklinePoints.length - 1].x}
                                cy={kriSparklinePoints[kriSparklinePoints.length - 1].y}
                                r={1.75}
                                fill="currentColor"
                              />
                            </>
                          )}
                        </svg>
                        <div className="text-right">
                          <span className="block text-[10px] tracking-wide text-muted-foreground uppercase">
                            {t("home.connectedDataModel.kri.target")}
                          </span>
                          <span className="font-mono-data text-xs text-muted-foreground">
                            {formatKriNumber(kri.target_value, i18n.language)}
                            {kri.unit === "%" ? "%" : ""}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    // Not reachable with today's 4 demo risks (all 4 have a
                    // real KRI) -- kept so this component doesn't silently
                    // render a bare label if the underlying mock data ever
                    // changes out from under it.
                    <p className="mt-2 rounded border border-dashed border-border/70 px-2 py-2 text-xs text-muted-foreground/80">
                      {t("home.connectedDataModel.cards.kriEmpty")}
                    </p>
                  )}
                </div>

                {/* Audit finding -- only when linked_risk_id genuinely
                    points at the selected risk. */}
                <div
                  className={`animate-cdm-swap rounded-lg border p-4 text-left transition-colors ${
                    finding
                      ? `border-t-2 border-border ${accent.borderTop} bg-card shadow-sm shadow-foreground/[0.03]`
                      : "border-border/70 bg-card/60"
                  }`}
                  style={{ animationDelay: "120ms" }}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    <Search aria-hidden="true" className="h-3.5 w-3.5" />
                    {t("home.connectedDataModel.cards.finding")}
                  </div>
                  {finding ? (
                    <>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold uppercase ${severityBadgeClasses(findingSeverity)}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES[findingSeverity].dot}`}
                          />
                          {findingHasKnownSeverity
                            ? t(`riskLevel.${finding.severity}`)
                            : finding.severity}
                        </span>
                        <span className="font-mono-data text-xs text-muted-foreground">
                          {finding.ref}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs font-medium text-foreground">
                        {finding.title}
                      </p>
                      <span className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 font-mono-data text-[11px] text-muted-foreground">
                        {t("home.connectedDataModel.linkedToRisk", {
                          ref: risk.ref,
                        })}
                      </span>
                    </>
                  ) : (
                    <div className="mt-2 flex flex-col items-center gap-1.5 rounded border border-dashed border-border/70 px-2 py-4 text-center">
                      <Search
                        aria-hidden="true"
                        className="h-4 w-4 text-muted-foreground/50"
                      />
                      <p className="text-xs text-muted-foreground/80">
                        {t("home.connectedDataModel.cards.findingEmpty")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Mitigation -- only when risk_id genuinely points at the
                    selected risk. */}
                <div
                  className={`animate-cdm-swap rounded-lg border p-4 text-left transition-colors ${
                    mitigation
                      ? `border-t-2 border-border ${accent.borderTop} bg-card shadow-sm shadow-foreground/[0.03]`
                      : "border-border/70 bg-card/60"
                  }`}
                  style={{ animationDelay: "160ms" }}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                    {t("home.connectedDataModel.cards.mitigation")}
                  </div>
                  {mitigation ? (
                    <>
                      <p className="mt-2 line-clamp-2 text-xs font-medium text-foreground">
                        {mitigation.title}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${severityBadgeClasses(
                            MITIGATION_STATUS_LEVEL[mitigation.status] ?? "neutral"
                          )}`}
                        >
                          {mitigation.status.replace(/_/g, " ")}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {t("home.connectedDataModel.mitigation.riskReduction", {
                            percent: Math.round(mitigation.risk_reduction * 100),
                          })}
                        </span>
                      </div>
                      <span className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 font-mono-data text-[11px] text-muted-foreground">
                        {t("home.connectedDataModel.linkedToRisk", {
                          ref: risk.ref,
                        })}
                      </span>
                    </>
                  ) : (
                    <div className="mt-2 flex flex-col items-center gap-1.5 rounded border border-dashed border-border/70 px-2 py-4 text-center">
                      <ShieldCheck
                        aria-hidden="true"
                        className="h-4 w-4 text-muted-foreground/50"
                      />
                      <p className="text-xs text-muted-foreground/80">
                        {t("home.connectedDataModel.cards.mitigationEmpty")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t("home.connectedDataModel.hint")}
          </p>
        </div>
      </div>
    </section>
  )
}
