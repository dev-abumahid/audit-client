/* eslint-disable @typescript-eslint/no-explicit-any */
import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import {
  Brain,
  Globe,
  Loader2,
  Radio,
  Search,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react"
import { useState } from "react"

// Dummy Data
const DUMMY_SAVED_ITEMS = [
  {
    id: "i1",
    title: "New ransomware campaign targets European manufacturing firms",
    description:
      "A sophisticated ransomware group has launched attacks against several manufacturers in Germany and France. Initial access via phishing.",
    severity: "high",
    category: "cyber",
    source_name: "Cyber Threat Intel",
    relevance_score: 0.87,
    created_at: "2026-04-15T10:30:00Z",
  },
  {
    id: "i2",
    title: "Supply chain disruption expected due to Red Sea shipping attacks",
    description:
      "Ongoing geopolitical tensions in the Red Sea are causing significant delays in global shipping routes.",
    severity: "medium",
    category: "operational",
    source_name: "Risk Watch Daily",
    relevance_score: 0.76,
    created_at: "2026-04-16T08:15:00Z",
  },
  {
    id: "i3",
    title: "New data privacy regulation proposed in Southeast Asia",
    description:
      "Governments in the region are moving toward stricter data localization requirements.",
    severity: "low",
    category: "compliance",
    source_name: "Regulatory Bulletin",
    relevance_score: 0.64,
    created_at: "2026-04-14T14:20:00Z",
  },
]

const DUMMY_ANALYZED_ITEMS = [
  {
    original_title: "Major cyber attack hits logistics provider",
    risk_summary:
      "High likelihood of supply chain impact. Immediate monitoring recommended.",
    severity: "critical",
    category: "cyber",
    relevance_score: 0.92,
    is_risk: true,
    requires_immediate_attention: true,
    recommended_actions: [{ action: "Activate incident response team" }],
  },
  {
    original_title: "Rising inflation concerns in key markets",
    risk_summary: "Potential cost increase for raw materials in Q3.",
    severity: "medium",
    category: "financial",
    relevance_score: 0.71,
    is_risk: true,
    requires_immediate_attention: false,
  },
]

const DUMMY_PREDICTIONS = {
  predictions: {
    score_7d: 6.8,
    score_30d: 7.4,
    trend: "worsening" as const,
    board_summary:
      "Overall risk posture is deteriorating due to increasing cyber threats and geopolitical instability.",
    emerging_risks: [
      { title: "AI-powered phishing campaigns", probability: 0.78 },
      { title: "Disruption in semiconductor supply", probability: 0.65 },
    ],
  },
}

export default function IntelligencePage() {
  const [isScraping, setIsScraping] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isPredicting, setIsPredicting] = useState(false)

  const [savedItems, setSavedItems] = useState(DUMMY_SAVED_ITEMS)
  const [scrapedItems, setScrapedItems] = useState<any[]>([])
  const [analyzedItems, setAnalyzedItems] = useState(DUMMY_ANALYZED_ITEMS)
  const [predictions, setPredictions] = useState<any>(DUMMY_PREDICTIONS)
  const [scrapeStats, setScrapeStats] = useState<{
    sources: number
    items: number
    success: number
  } | null>({
    sources: 62,
    items: 184,
    success: 58,
  })

  const [search, setSearch] = useState("")
  const [filterSeverity, setFilterSeverity] = useState<string>("all")

  // Simulate Scraping
  const handleScrape = async () => {
    setIsScraping(true)
    await new Promise((resolve) => setTimeout(resolve, 1800))

    setScrapedItems(
      Array.from({ length: 12 }, (_, i) => ({
        source_name: `Source ${i + 1}`,
        source_url: "#",
        source_category: "news",
      }))
    )

    setScrapeStats({ sources: 62, items: 184, success: 58 })

    alert("Collection completed: 184 articles from 58/62 sources")
    setIsScraping(false)
  }

  // Simulate Analysis
  const handleAnalyze = async () => {
    if (scrapedItems.length === 0) return

    setIsAnalyzing(true)
    await new Promise((resolve) => setTimeout(resolve, 2200))

    setAnalyzedItems(DUMMY_ANALYZED_ITEMS)

    // Simulate saving some items
    const newSaved = DUMMY_ANALYZED_ITEMS.filter((a) => a.is_risk).map(
      (item, i) => ({
        id: `new-${Date.now()}-${i}`,
        title: item.original_title,
        description: item.risk_summary,
        severity: item.severity,
        category: item.category,
        source_name: "ARIA Analysis",
        relevance_score: item.relevance_score,
        created_at: new Date().toISOString(),
      })
    )

    setSavedItems((prev) => [...newSaved, ...prev])

    alert(
      `Analysis complete: ${DUMMY_ANALYZED_ITEMS.filter((a) => a.is_risk).length} risks identified`
    )
    setIsAnalyzing(false)
  }

  // Simulate Prediction
  const handlePredict = async () => {
    setIsPredicting(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setPredictions(DUMMY_PREDICTIONS)
    alert("AI Predictions generated successfully")
    setIsPredicting(false)
  }

  const filteredItems = savedItems.filter((item) => {
    if (filterSeverity !== "all" && item.severity !== filterSeverity)
      return false
    if (
      search &&
      !((item.title as string) || "")
        .toLowerCase()
        .includes(search.toLowerCase())
    )
      return false
    return true
  })

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="animate-fade-in">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Threat Intelligence
          </h1>
          <div className="ml-2 h-2 w-2 animate-pulse rounded-full bg-risk-low" />
        </div>
        <p className="text-sm text-muted-foreground">
          Automated monitoring from 60+ global sources — ARIA CRO Intelligence
          Engine
        </p>
      </div>

      {/* Action Bar */}
      <div className="animate-slide-up flex flex-wrap items-center gap-3">
        <button
          onClick={handleScrape}
          disabled={isScraping}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40"
        >
          {isScraping ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          {isScraping ? "Collecting sources…" : "Collect 60+ sources"}
        </button>

        {scrapedItems.length > 0 && (
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-all hover:opacity-90 disabled:opacity-40"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {isAnalyzing
              ? "Analyzing with ARIA…"
              : `Analyze ${scrapedItems.length} articles`}
          </button>
        )}

        <button
          onClick={handlePredict}
          disabled={isPredicting}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted disabled:opacity-40"
        >
          {isPredicting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          AI Predictions
        </button>

        {scrapeStats && (
          <span className="text-xs text-muted-foreground">
            {scrapeStats.success}/{scrapeStats.sources} sources •{" "}
            {scrapeStats.items} articles
          </span>
        )}
      </div>

      {/* Predictions Panel */}
      {predictions && (
        <div className="animate-fade-in rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              ARIA Predictions — Predictive Intelligence
            </h3>
          </div>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">7-day Risk Score</p>
              <p className="text-xl font-bold text-foreground">
                {predictions.predictions.score_7d?.toFixed(1)}
                <span className="text-xs text-muted-foreground">/10</span>
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">30-day Risk Score</p>
              <p className="text-xl font-bold text-foreground">
                {predictions.predictions.score_30d?.toFixed(1)}
                <span className="text-xs text-muted-foreground">/10</span>
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Trend</p>
              <p className="flex items-center gap-2 text-xl font-bold text-foreground">
                <TrendingUp className="h-4 w-4" />
                {predictions.predictions.trend === "worsening"
                  ? "Worsening"
                  : predictions.predictions.trend === "improving"
                    ? "Improving"
                    : "Stable"}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {predictions.predictions.board_summary}
          </p>

          {predictions.predictions.emerging_risks?.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold text-foreground">
                Emerging Risks Detected:
              </p>
              <div className="space-y-1">
                {predictions.predictions.emerging_risks.map(
                  (er: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span className="text-risk-high">⚠</span>
                      <span>{er.title}</span>
                      <span className="font-mono">
                        ({(er.probability * 100).toFixed(0)}%)
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search intelligence..."
            className="h-9 w-full rounded-md border border-input bg-background pr-4 pl-9 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
          />
        </div>

        <div className="flex gap-1">
          {["all", "critical", "high", "medium", "low"].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filterSeverity === sev
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {sev === "all"
                ? "All"
                : sev.charAt(0).toUpperCase() + sev.slice(1)}
              {sev !== "all" &&
                ` (${savedItems.filter((i) => i.severity === sev).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Live Analysis Results */}
      {analyzedItems.length > 0 && (
        <div className="animate-fade-in rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              ARIA Analysis Results —{" "}
              {analyzedItems.filter((a) => a.is_risk).length} risks identified
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {analyzedItems
              .filter((a) => a.is_risk)
              .map((item, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-start gap-2">
                    <RiskBadge level={item.severity as any} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-foreground">
                        {item.original_title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {item.risk_summary}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {item.category}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {(item.relevance_score * 100).toFixed(0)}%
                        </span>
                        {item.requires_immediate_attention && (
                          <span className="rounded bg-risk-critical/10 px-1.5 py-0.5 text-[10px] font-medium text-risk-critical">
                            ⚡ Immediate Action
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Saved Intelligence Items */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {filteredItems.length} Intelligence Items
        </h3>

        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Shield className="mb-3 h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">No intelligence items yet</p>
            <p className="mt-1 text-xs">
              Start a collection to populate threat intelligence
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item, i) => (
              <div
                key={(item.id as string) || i}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80"
              >
                <div className="flex items-start gap-3">
                  <RiskBadge
                    level={
                      (item.severity as
                        | "critical"
                        | "high"
                        | "medium"
                        | "low") || "medium"
                    }
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {item.title as string}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {item.description as string}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="font-medium">
                        {item.source_name as string}
                      </span>
                      <span>·</span>
                      <span className="font-mono">
                        {(
                          ((item.relevance_score as number) || 0) * 100
                        ).toFixed(0)}
                        %
                      </span>
                      {item.created_at && (
                        <>
                          <span>·</span>
                          <span>
                            {new Date(
                              item.created_at as string
                            ).toLocaleDateString("en-US")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
