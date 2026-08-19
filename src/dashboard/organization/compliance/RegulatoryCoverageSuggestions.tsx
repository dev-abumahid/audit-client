import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Sparkles } from "lucide-react"
import type { SuggestedRegulatorySource } from "@/redux/apis/organization/compliance.api"
import { useSuggestRegulatorySourcesMutation } from "@/redux/apis/organization/compliance.api"
import { isHttpUrl } from "@/utils/isHttpUrl"
import { toast } from "sonner"

interface Site {
  id: string
  name: string
}

interface RegulatoryCoverageSuggestionsProps {
  sites: Site[]
  domainLabel: (key: string) => string
  onAddSuggestion: (siteId: string, suggestion: SuggestedRegulatorySource) => void
}

// aexa-frontend#939 (CEO feedback follow-up): "comment savoir si toutes les
// sources reglementaires sont la" -- the CEO's own question about whether
// regulatory coverage is complete had no answer anywhere in the app. This
// panel AI-suggests regulatory sources likely applicable to a chosen site
// (grounded in a web search, per aexa-ai's regulatory_coverage_service.py)
// and cross-checked server-side against what's already tracked for that
// site, so only genuine gaps surface -- same "review and selectively
// import" shape as RiskFormModal's AI pre-fill, never auto-creating an
// obligation. Dismissed suggestions are held in local (session-only) state
// -- deliberately not persisted, unlike the AI-suggested-risks lifecycle
// feature (aexa-frontend#922): a stale "you already dismissed this"
// judgment surviving across sessions as regulations change would be worse
// than just re-showing it next time the user checks.
export default function RegulatoryCoverageSuggestions({
  sites,
  domainLabel,
  onAddSuggestion,
}: RegulatoryCoverageSuggestionsProps) {
  const { t } = useTranslation()
  const [selectedSiteId, setSelectedSiteId] = useState("")
  const [suggestions, setSuggestions] = useState<SuggestedRegulatorySource[] | null>(null)
  // Review finding: aexa-ai doesn't guarantee suggestion names are unique
  // within one response (e.g. two jurisdictions could each produce a
  // "Data Protection Act"). Keying dismissal/React's `key` by array INDEX
  // instead of `name` removes that whole class of risk -- a dismissed
  // index only ever refers to the one suggestion that occupied that slot
  // in this specific response.
  const [dismissed, setDismissed] = useState<Set<number>>(() => new Set())
  const [suggestRegulatorySources, { isLoading }] = useSuggestRegulatorySourcesMutation()

  // Round-2 quality-bar-loop review (resilience axis): checkCoverage's
  // closure captures selectedSiteId as it was WHEN THE REQUEST STARTED --
  // if the user switches to a different site (or the AI round-trip is slow
  // enough to overlap a second check) before it resolves, the stale
  // response used to land unconditionally and silently repopulate the
  // panel with the WRONG site's suggestions, even though the dropdown
  // shows the new site selected. A ref always holds the CURRENT
  // selectedSiteId (unlike the closure's frozen copy), so the response
  // handler can compare "the site I asked about" against "the site
  // actually selected right now" and discard a stale result -- for both
  // the success and error paths, since an error toast for a check the
  // user has already abandoned would be equally misleading.
  const selectedSiteIdRef = useRef(selectedSiteId)
  useEffect(() => {
    selectedSiteIdRef.current = selectedSiteId
  }, [selectedSiteId])

  // Round-4 quality-bar-loop review (accessibility axis, 3 consecutive
  // below-floor rounds): after Dismiss removes a suggestion's <li> (and its
  // own now-focused Dismiss button) from the DOM, nothing moved focus
  // anywhere -- it silently dropped to <body>, disorienting keyboard/
  // screen-reader users. Focus moves to this heading (tabIndex=-1 makes an
  // otherwise non-interactive element a valid, one-time programmatic focus
  // target) so the user lands somewhere sensible and stable regardless of
  // how many items remain.
  const headingRef = useRef<HTMLHeadingElement>(null)

  const checkCoverage = async () => {
    if (!selectedSiteId) return
    const requestedSiteId = selectedSiteId
    setDismissed(new Set())
    try {
      const res = await suggestRegulatorySources({ site_id: requestedSiteId }).unwrap()
      if (selectedSiteIdRef.current !== requestedSiteId) return
      setSuggestions(res.data.suggestions)
    } catch {
      if (selectedSiteIdRef.current !== requestedSiteId) return
      toast.error(t("organization.compliance.regulatoryCoverage.checkFailed"))
    }
  }

  const visibleSuggestions = (suggestions ?? [])
    .map((suggestion, index) => ({ suggestion, index }))
    .filter(({ index }) => !dismissed.has(index))

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
      </div>

      {/* Round-4 quality-bar-loop review (accessibility axis): the live
          region used to only exist in the DOM once `suggestions` was
          already non-null -- reliable announcement across AT/browser
          combos needs the region PRESENT before its content changes, not
          mounted-with-content-already-inside. Now always rendered; only
          its children are conditional. Also carries the loading
          announcement (round-4 finding: isLoading swapped an icon but
          never told assistive tech a check was in progress). */}
      <div className="mt-3" aria-live="polite">
        {isLoading && (
          <span className="sr-only">
            {t("organization.compliance.regulatoryCoverage.checking")}
          </span>
        )}
        {suggestions !== null && (
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
              {visibleSuggestions.map(({ suggestion, index }) => (
                <li
                  key={index}
                  className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">
                          {suggestion.name}
                        </span>
                        {/* Round-4 quality-bar-loop review (accessibility
                            axis): this text sat on the app's documented
                            near-miss --muted-foreground contrast token at
                            10px, likely failing 4.5:1 at this size (the
                            large-text 3:1 exemption doesn't apply well
                            under 14px). text-foreground carries the app's
                            already-verified full body-text contrast. */}
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                          {domainLabel(suggestion.domain)}
                        </span>
                        <span className="text-[10px] text-foreground">
                          {suggestion.jurisdiction}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {suggestion.rationale}
                      </p>
                      {/* Round-1 quality-bar-loop review (security axis):
                          source_url comes from an LLM response grounded in
                          web search results -- attacker-influenceable
                          content if a malicious/compromised page ever got
                          indexed. aexa-ai's own _normalize already drops a
                          non-http(s) scheme at the source, but this sink-
                          side guard (the same isHttpUrl helper used
                          elsewhere in this app for user-supplied URLs)
                          means a stale cached response or a future call
                          site that bypasses the backend guard still can't
                          render a javascript:/data: link here. */}
                      {isHttpUrl(suggestion.source_url) && (
                        <a
                          href={suggestion.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="focus-ring mt-1 inline-block text-[11px] text-primary hover:underline"
                        >
                          {t("organization.compliance.regulatoryCoverage.source")}
                          {/* Round-4 quality-bar-loop review (accessibility
                              axis): opening in a new tab with no warning is
                              a minor but real surprise for screen-reader
                              and low-vision users who may not notice the
                              tab switch. */}
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
                      {/* Round-4 quality-bar-loop review (accessibility
                          axis): both buttons rendered only the generic
                          translated label, so a screen reader stepping
                          through multiple suggestions heard "Add as
                          obligation, Add as obligation, Dismiss, Dismiss..."
                          with no way to tell which regulation each one
                          acts on. aria-label carries the full disambiguated
                          text; the visible label stays short. */}
                      <button
                        type="button"
                        onClick={() => onAddSuggestion(selectedSiteId, suggestion)}
                        aria-label={t(
                          "organization.compliance.regulatoryCoverage.addAsObligationFor",
                          { name: suggestion.name }
                        )}
                        className="focus-ring rounded-md border border-primary/30 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                      >
                        {t("organization.compliance.regulatoryCoverage.addAsObligation")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDismissed((prev) => new Set(prev).add(index))
                          // Round-4 review: the suggestion's own Dismiss
                          // button (the currently-focused element) is about
                          // to be removed from the DOM -- without this,
                          // focus silently drops to <body>. The panel
                          // heading is a stable landing spot regardless of
                          // how many suggestions remain after removal.
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
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  )
}
