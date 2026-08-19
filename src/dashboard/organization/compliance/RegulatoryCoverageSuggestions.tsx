import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Sparkles } from "lucide-react"
import type { SuggestedRegulatorySource } from "@/redux/apis/organization/compliance.api"
import { useSuggestRegulatorySourcesMutation } from "@/redux/apis/organization/compliance.api"
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

  const checkCoverage = async () => {
    if (!selectedSiteId) return
    setDismissed(new Set())
    try {
      const res = await suggestRegulatorySources({ site_id: selectedSiteId }).unwrap()
      setSuggestions(res.data.suggestions)
    } catch {
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
          <h2 className="text-sm font-semibold text-foreground">
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

      {suggestions !== null && (
        <div className="mt-3" aria-live="polite">
          {suggestions.length === 0 ? (
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
                      {suggestion.source_url && (
                        <a
                          href={suggestion.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="focus-ring mt-1 inline-block text-[11px] text-primary hover:underline"
                        >
                          {t("organization.compliance.regulatoryCoverage.source")}
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAddSuggestion(selectedSiteId, suggestion)}
                        className="focus-ring rounded-md border border-primary/30 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                      >
                        {t("organization.compliance.regulatoryCoverage.addAsObligation")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDismissed((prev) => new Set(prev).add(index))
                        }
                        className="focus-ring rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                      >
                        {t("organization.compliance.regulatoryCoverage.dismiss")}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
