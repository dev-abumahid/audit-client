import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CircleCheck, Loader2, Sparkles } from "lucide-react"
import type { SuggestedRegulatorySource } from "@/redux/apis/organization/compliance.api"
import { useSuggestRegulatorySourcesMutation } from "@/redux/apis/organization/compliance.api"
import { isHttpUrl } from "@/utils/isHttpUrl"
import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import { toast } from "sonner"

interface Site {
  id: string
  name: string
}

interface RegulatoryCoverageSuggestionsProps {
  sites: Site[]
  sitesError: boolean
  domainLabel: (key: string) => string
  onAddSuggestion: (siteId: string, suggestion: SuggestedRegulatorySource) => void
}

/**
 * aexa-frontend#939 (CEO feedback follow-up): "comment savoir si toutes les
 * sources reglementaires sont la" -- AI-suggests regulatory sources likely
 * applicable to a chosen site (grounded in a web search, per aexa-ai's
 * regulatory_coverage_service.py), cross-checked server-side against what's
 * already tracked so only genuine gaps surface -- same "review and
 * selectively import" shape as RiskFormModal's AI pre-fill, never
 * auto-creating an obligation.
 *
 * Design notes (consolidated from this feature's quality-bar-loop history --
 * see tracking issue aexa-frontend#946 for the full round-by-round log):
 *
 * - **Index-keyed status, not name-keyed.** aexa-ai doesn't guarantee
 *   suggestion names are unique within one response. `status` maps a
 *   suggestion's array INDEX to at most one of "dismissed" | "added" --
 *   mutually exclusive by construction, unlike the two independent Sets this
 *   used to be. Session-only, deliberately not persisted (unlike the
 *   AI-suggested-risks lifecycle feature, aexa-frontend#922): a stale
 *   judgment surviving across sessions as regulations/obligations change
 *   would be worse than just re-showing the suggestion next time.
 *   "Added" is marked the instant the button is clicked, not gated on the
 *   parent's form actually being saved -- this component has no visibility
 *   into whether the user saved or cancelled.
 * - **Stale-response guard.** `selectedSiteIdRef` always holds the CURRENT
 *   selection (unlike a closure, which freezes at request-start), so a slow
 *   response for a site the user has since switched away from gets
 *   discarded instead of silently repopulating the panel with the wrong
 *   site's suggestions.
 * - **Resilience states.** `sitesError` and an empty `sites` array each get
 *   their own message instead of degrading to an identical, unexplained
 *   disabled control. A 504 from a 45s-capped AI timeout (aexa-server's
 *   LLM_CALL_TIMEOUT_MS) shows a distinct toast from a generic failure.
 *   `checkCoverage` clears `suggestions`/`status` synchronously before the
 *   request goes out -- otherwise the previous batch stays on screen with
 *   re-enabled buttons for the full round-trip, letting a same-site re-check
 *   re-add an already-added suggestion.
 * - **Accessibility.** The `aria-live="polite"` region is always mounted
 *   (only its children are conditional) so AT reliably observes content
 *   changes -- it also carries an sr-only "checking..." announcement while
 *   `isLoading`, since the check button used to swap only a visual icon and
 *   never told assistive tech a check was in progress. Dismiss moves focus
 *   to the panel heading afterward, since its own (removed) button would
 *   otherwise silently drop focus to `<body>`.
 *   Known gap: Add doesn't get the same focus-management treatment when it
 *   self-disables (aexa-frontend#946 round 10/12).
 * - **Security.** `source_url` is LLM-grounded web-search content --
 *   attacker-influenceable if a malicious page were ever indexed. aexa-ai's
 *   `_normalize` already drops non-http(s) schemes server-side; `isHttpUrl`
 *   here is a second, independent sink-side guard.
 * - **Contrast.** The domain pill/jurisdiction text is `muted-foreground` on
 *   purpose -- it already clears 4.5:1 AA (~6.07:1 against card, ~5.4:1
 *   against the pill's own background). Don't "fix" this to `foreground`
 *   without computing the real ratio first; that was tried and reverted.
 */
export default function RegulatoryCoverageSuggestions({
  sites,
  sitesError,
  domainLabel,
  onAddSuggestion,
}: RegulatoryCoverageSuggestionsProps) {
  const { t } = useTranslation()
  const [selectedSiteId, setSelectedSiteId] = useState("")
  const [suggestions, setSuggestions] = useState<SuggestedRegulatorySource[] | null>(null)
  const [status, setStatus] = useState<Map<number, "dismissed" | "added">>(
    () => new Map()
  )
  const [suggestRegulatorySources, { isLoading }] = useSuggestRegulatorySourcesMutation()

  const selectedSiteIdRef = useRef(selectedSiteId)
  useEffect(() => {
    selectedSiteIdRef.current = selectedSiteId
  }, [selectedSiteId])

  // Dismiss's own (removed) button is the focused element right before this
  // fires -- without moving focus, it drops to <body>. See the design notes
  // above.
  const headingRef = useRef<HTMLHeadingElement>(null)

  const checkCoverage = async () => {
    if (!selectedSiteId) return
    const requestedSiteId = selectedSiteId
    setSuggestions(null)
    setStatus(new Map())
    try {
      const res = await suggestRegulatorySources({ site_id: requestedSiteId }).unwrap()
      if (selectedSiteIdRef.current !== requestedSiteId) return
      setSuggestions(res.data.suggestions)
    } catch (err: unknown) {
      if (selectedSiteIdRef.current !== requestedSiteId) return
      const isTimeout =
        typeof err === "object" && err !== null && "status" in err && err.status === 504
      toast.error(
        t(
          isTimeout
            ? "organization.compliance.regulatoryCoverage.checkTimedOut"
            : "organization.compliance.regulatoryCoverage.checkFailed"
        )
      )
    }
  }

  const visibleSuggestions = (suggestions ?? [])
    .map((suggestion, index) => ({ suggestion, index }))
    .filter(({ index }) => status.get(index) !== "dismissed")

  return (
    <div className="animate-slide-up rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="focus-ring rounded text-sm font-semibold text-foreground"
          >
            {t("organization.compliance.regulatoryCoverage.title")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("organization.compliance.regulatoryCoverage.subtitle")}
          </p>
        </div>
        {sitesError ? (
          <p role="alert" className="text-xs text-destructive">
            {t("organization.compliance.sitesLoadError")}
          </p>
        ) : sites.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("organization.compliance.regulatoryCoverage.noSites")}
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={selectedSiteId}
              onChange={(e) => {
                setSelectedSiteId(e.target.value)
                setSuggestions(null)
              }}
              aria-label={t(
                "organization.compliance.regulatoryCoverage.selectSite"
              )}
              className="focus-ring h-9 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="">
                {t("organization.compliance.regulatoryCoverage.selectSite")}
              </option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={checkCoverage}
              disabled={!selectedSiteId || isLoading}
              aria-busy={isLoading}
              className="focus-ring flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {t("organization.compliance.regulatoryCoverage.checkButton")}
            </button>
          </div>
        )}
      </div>

      <div className="mt-3" aria-live="polite">
        {isLoading && (
          <>
            <span className="sr-only">
              {t("organization.compliance.regulatoryCoverage.checking")}
            </span>
            {/* Round-16 quality-bar-loop review (visual polish axis, streak
                3): checkCoverage clears `suggestions` the instant a fresh
                check starts (round 10/11 resilience fix) with nothing
                rendered in its place, so a same-site re-check visibly
                emptied the panel, then filled it back in a beat later --
                a flicker plus a layout jump (no reserved height). These
                two placeholder rows give the loading window real content
                sized like the cards it's about to replace, aria-hidden
                since the sr-only announcement above already covers screen
                readers. */}
            <ul className="flex flex-col gap-2" aria-hidden="true">
              {[0, 1].map((i) => (
                <li
                  key={i}
                  className="animate-pulse rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="h-3 w-1/3 rounded bg-muted" />
                  <div className="mt-2 h-2 w-2/3 rounded bg-muted" />
                </li>
              ))}
            </ul>
          </>
        )}
        {!isLoading && suggestions !== null && (
          suggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("organization.compliance.regulatoryCoverage.noGaps")}
            </p>
          ) : visibleSuggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("organization.compliance.regulatoryCoverage.allDismissed")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibleSuggestions.map(({ suggestion, index }) => {
                const isAdded = status.get(index) === "added"
                return (
                  <li
                    key={index}
                    className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Round-14 quality-bar-loop review
                              (industry-standards axis, streak 8): reuses the
                              app's existing RiskBadge + riskLevel.* i18n
                              keys (same component AlertRow/Overview/
                              IntelligencePage already use for
                              severity/risk) rather than a one-off badge, so
                              a gap's materiality reads first, before its
                              name -- same triage-first ordering those other
                              severity lists use. */}
                          <RiskBadge
                            level={suggestion.severity as "high" | "medium" | "low"}
                            size="sm"
                          />
                          <span className="text-xs font-semibold text-foreground">
                            {suggestion.name}
                          </span>
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {domainLabel(suggestion.domain)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {suggestion.jurisdiction}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {suggestion.rationale}
                        </p>
                        {isHttpUrl(suggestion.source_url) && (
                          <a
                            href={suggestion.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="focus-ring mt-1 inline-block text-[11px] text-primary hover:underline"
                          >
                            {t("organization.compliance.regulatoryCoverage.source")}
                            <span className="sr-only">
                              {" "}
                              {t(
                                "organization.compliance.regulatoryCoverage.opensInNewTab"
                              )}
                            </span>
                          </a>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setStatus((prev) => new Map(prev).set(index, "added"))
                            onAddSuggestion(selectedSiteId, suggestion)
                          }}
                          disabled={isAdded}
                          aria-label={t(
                            isAdded
                              ? "organization.compliance.regulatoryCoverage.addedFor"
                              : "organization.compliance.regulatoryCoverage.addAsObligationFor",
                            { name: suggestion.name }
                          )}
                          className="focus-ring flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:hover:bg-transparent"
                        >
                          {isAdded && (
                            <CircleCheck className="h-3 w-3" aria-hidden="true" />
                          )}
                          {t(
                            isAdded
                              ? "organization.compliance.regulatoryCoverage.added"
                              : "organization.compliance.regulatoryCoverage.addAsObligation"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStatus((prev) => new Map(prev).set(index, "dismissed"))
                            headingRef.current?.focus()
                          }}
                          aria-label={t(
                            "organization.compliance.regulatoryCoverage.dismissFor",
                            { name: suggestion.name }
                          )}
                          className="focus-ring rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                        >
                          {t("organization.compliance.regulatoryCoverage.dismiss")}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        )}
      </div>
    </div>
  )
}
