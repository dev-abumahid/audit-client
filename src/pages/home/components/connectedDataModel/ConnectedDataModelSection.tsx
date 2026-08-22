import type { KeyboardEvent } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { kriStatusMeta, formatKriNumber } from "@/dashboard/organization/kri/kriConfig"
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll"
import { computeKriStatus } from "@/utils/kriStatus"
import { riskCategoryLabel } from "@/utils/riskConfig"
import { getRiskSeverityLevel } from "@/utils/riskScoring"
import { SEVERITY_STYLES, severityBadgeClasses } from "@/utils/severityStyles"
import { CONNECTED_DEMO_RISKS } from "./connectedDataModelDemoData"

// Landing overhaul (connected-data-model redesign, replaces the PR9
// single-risk fan-out): a visitor picks one of 4 real risks and sees the
// records genuinely connected to it elsewhere in Qiyrix -- a KRI always
// (every demo risk has one), an audit finding and a mitigation only where
// one is actually linked (only CYB-014 has both; see
// connectedDataModelDemoData.ts's own comment on why that's not fabricated
// for symmetry). No "Register entry" card -- the hub below already shows
// everything that card would (ref/name/category/severity), so it would be
// a pure duplicate. No "Control" card -- no standalone Control entity
// exists in this data model; control_design_eff/control_operating_eff live
// directly on Risk instead.
//
// Copy correction: the PR9 copy claimed "the same risk object underlies...
// updating one updates what everyone else sees" / "because it's the same
// record" -- that's not what's actually happening. KRI/AuditFinding/
// Mitigation are distinct records, each linked back to Risk by its own
// foreign key (risk_id / linked_risk_id). The new copy says "connected
// records," not "the same record."
const DEFAULT_RISK_ID = CONNECTED_DEMO_RISKS[0].risk.id

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

  // 3 fixed slots regardless of what's actually connected -- keeps the
  // layout from jumping when switching between a risk with all 3 records
  // and one with only a KRI. Each slot renders either its real card or a
  // genuinely-empty state; there's no 4th "Register entry" slot (dropped,
  // see file header) so this is 3 wide, not 4.
  const kriStatus = kri
    ? computeKriStatus(kri.current_value, kri.alert_threshold, kri.target_value)
    : null
  const kriMeta = kriStatus ? kriStatusMeta(kriStatus) : null

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
                  className={`focus-ring flex flex-col items-start gap-1.5 rounded-lg border bg-card p-3 text-left transition-all duration-150 ease-out motion-reduce:transition-none ${
                    isActive
                      ? "border-primary shadow-md shadow-primary/10"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${severityBadgeClasses(entrySeverity)}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES[entrySeverity].dot}`}
                    />
                    {t(`riskLevel.${entrySeverity}`)}
                  </span>
                  <span className="font-mono-data text-xs font-bold text-foreground">
                    {entry.risk.ref}
                  </span>
                  <p className="line-clamp-2 text-xs text-foreground">
                    {entry.risk.name}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
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

          {/* Hub: compact summary of the selected risk, not a duplicate of
              the selector card above -- single line of identity plus
              severity/score, nothing else. key={selectedId} remounts on
              every selection so .animate-cdm-swap actually replays. */}
          <div key={selectedId} className="mt-6">
            <h3 className="sr-only">{t("home.connectedDataModel.hubLabel")}</h3>
            <div className="animate-cdm-swap mx-auto flex max-w-md flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-xl border border-primary/30 bg-card px-5 py-3 text-center shadow-lg shadow-foreground/[0.03]">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${severityBadgeClasses(severity)}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES[severity].dot}`}
                />
                {t(`riskLevel.${severity}`)}
              </span>
              <span className="font-mono-data text-sm font-bold text-foreground">
                {risk.ref}
              </span>
              <span className="text-sm font-medium text-foreground">
                {risk.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {riskCategoryLabel(t, risk.category)}
              </span>
            </div>

            {/* Connector: one line per slot that actually has a connected
                record -- semantic (this record is related to this risk),
                not decorative, so an empty slot gets no line. Hidden on
                mobile where the cards stack, same precedent as PR9. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 100 20"
              preserveAspectRatio="none"
              className="mx-auto hidden h-14 w-full max-w-2xl sm:block"
            >
              {[
                { x: 16.67, present: Boolean(kri) },
                { x: 50, present: Boolean(finding) },
                { x: 83.33, present: Boolean(mitigation) },
              ]
                .filter((slot) => slot.present)
                .map((slot) => (
                  <line
                    key={slot.x}
                    x1="50"
                    y1="0"
                    x2={slot.x}
                    y2="20"
                    pathLength={1}
                    className="animate-cdm-draw stroke-primary/40"
                    strokeWidth={0.5}
                    strokeDasharray={1}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
            </svg>

            <div className="mx-auto grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
              {/* KRI -- always present for these 4 demo risks. */}
              <div
                className="animate-cdm-swap rounded-lg border border-border bg-card p-3 text-left"
                style={{ animationDelay: "40ms" }}
              >
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {t("home.connectedDataModel.cards.kri")}
                </span>
                {kri && kriMeta && kriStatus ? (
                  <>
                    <p className="mt-1.5 line-clamp-1 text-xs text-foreground">
                      {kri.name}
                    </p>
                    <p className="mt-1 font-mono-data text-[11px] text-muted-foreground">
                      {t("home.connectedDataModel.kri.valueLine", {
                        current: formatKriNumber(kri.current_value, i18n.language),
                        unit: kri.unit === "%" ? "%" : ` ${kri.unit}`,
                        target: formatKriNumber(kri.target_value, i18n.language),
                      })}
                    </p>
                    <span
                      className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${severityBadgeClasses(kriMeta.severityLevel)}`}
                    >
                      {t(kriMeta.labelKey)}
                    </span>
                  </>
                ) : (
                  // Not reachable with today's 4 demo risks (all 4 have a
                  // real KRI) -- kept for the same reason the finding/
                  // mitigation slots have one: this component shouldn't
                  // silently render a bare label if the underlying mock
                  // data ever changes out from under it.
                  <p className="mt-2 rounded border border-dashed border-border/70 px-2 py-2 text-[11px] text-muted-foreground/80">
                    {t("home.connectedDataModel.cards.kriEmpty")}
                  </p>
                )}
              </div>

              {/* Audit finding -- only when linked_risk_id genuinely
                  points at the selected risk. */}
              <div
                className="animate-cdm-swap rounded-lg border border-border bg-card p-3 text-left"
                style={{ animationDelay: "90ms" }}
              >
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {t("home.connectedDataModel.cards.finding")}
                </span>
                {finding ? (
                  <>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${severityBadgeClasses(findingSeverity)}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES[findingSeverity].dot}`}
                        />
                        {findingHasKnownSeverity
                          ? t(`riskLevel.${finding.severity}`)
                          : finding.severity}
                      </span>
                      <span className="font-mono-data text-[11px] text-muted-foreground">
                        {finding.ref}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-foreground">
                      {finding.title}
                    </p>
                    <span className="mt-1.5 inline-block rounded bg-muted px-1.5 py-0.5 font-mono-data text-[10px] text-muted-foreground">
                      {t("home.connectedDataModel.linkedToRisk", {
                        ref: risk.ref,
                      })}
                    </span>
                  </>
                ) : (
                  <p className="mt-2 rounded border border-dashed border-border/70 px-2 py-2 text-[11px] text-muted-foreground/80">
                    {t("home.connectedDataModel.cards.findingEmpty")}
                  </p>
                )}
              </div>

              {/* Mitigation -- only when risk_id genuinely points at the
                  selected risk. */}
              <div
                className="animate-cdm-swap rounded-lg border border-border bg-card p-3 text-left"
                style={{ animationDelay: "140ms" }}
              >
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {t("home.connectedDataModel.cards.mitigation")}
                </span>
                {mitigation ? (
                  <>
                    <p className="mt-1.5 line-clamp-2 text-xs text-foreground">
                      {mitigation.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase">
                        {mitigation.status.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {t("home.connectedDataModel.mitigation.riskReduction", {
                          percent: Math.round(mitigation.risk_reduction * 100),
                        })}
                      </span>
                    </div>
                    <span className="mt-1.5 inline-block rounded bg-muted px-1.5 py-0.5 font-mono-data text-[10px] text-muted-foreground">
                      {t("home.connectedDataModel.linkedToRisk", {
                        ref: risk.ref,
                      })}
                    </span>
                  </>
                ) : (
                  <p className="mt-2 rounded border border-dashed border-border/70 px-2 py-2 text-[11px] text-muted-foreground/80">
                    {t("home.connectedDataModel.cards.mitigationEmpty")}
                  </p>
                )}
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
