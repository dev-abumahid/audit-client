/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Brain,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { SubmitHandler } from "react-hook-form"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

type SortKey = "residual_score" | "pagerank_score" | "probability"

const EMPTY_RISK = {
  ref: "",
  name: "",
  description: "",
  category: "operational" as const,
  inherent_score: 10,
  residual_score: 8,
  pagerank_score: 50,
  probability: 0.5,
  velocity: "medium" as const,
  trend: "stable" as const,
  financial_impact_min: 0,
  financial_impact_max: 0,
  owner: "",
  is_tipping_point: false,
}

type RiskFormData = typeof EMPTY_RISK

interface Risk {
  id: string
  ref: string
  name: string
  description?: string
  category: string
  inherent_score: number
  residual_score: number
  pagerank_score: number
  probability: number
  velocity: string
  trend: string
  financial_impact_min: number
  financial_impact_max: number
  owner?: string
  is_tipping_point: boolean
  status: "open" | "dismissed"
  color_hex: string
  ai_generated?: boolean
  is_edited?: boolean
  site_id?: string
  site_name?: string
}

interface CorrectiveAction {
  action: string
  priority: string
  normReference: string
  owner: string
  timeline: string
}

interface RiskGroup {
  id: string
  name: string
  description: string
  rootCause?: string
  aggregatedScore: number
  maxScore: number
  riskRefs: string[]
  correctiveActions?: CorrectiveAction[]
  estimatedRiskReduction?: number
}

// Dummy Data
const DUMMY_SITES = [
  { id: "site1", name: "Siège Paris" },
  { id: "site2", name: "Usine Lyon" },
  { id: "site3", name: "Bureau Marseille" },
]

const DUMMY_RISKS: Risk[] = [
  {
    id: "1",
    ref: "CY-001",
    name: "Cyberattaque ransomware",
    description:
      "Risque de blocage des systèmes suite à une attaque ransomware",
    category: "cyber",
    inherent_score: 20,
    residual_score: 12,
    pagerank_score: 85,
    probability: 0.65,
    velocity: "high",
    trend: "worsening",
    financial_impact_min: 450,
    financial_impact_max: 2500,
    owner: "Jean Dupont",
    is_tipping_point: true,
    status: "open",
    color_hex: "#ef4444",
    ai_generated: true,
  },
  {
    id: "2",
    ref: "OP-012",
    name: "Rupture de chaîne d’approvisionnement",
    description: "Dépendance excessive sur un fournisseur unique en Asie",
    category: "operational",
    inherent_score: 18,
    residual_score: 15,
    pagerank_score: 72,
    probability: 0.8,
    velocity: "medium",
    trend: "stable",
    financial_impact_min: 800,
    financial_impact_max: 1800,
    owner: "Marie Laurent",
    is_tipping_point: false,
    status: "open",
    color_hex: "#f59e0b",
  },
  {
    id: "3",
    ref: "CO-005",
    name: "Non-conformité RGPD",
    description:
      "Manque de consentement explicite dans la collecte de données clients",
    category: "compliance",
    inherent_score: 15,
    residual_score: 9,
    pagerank_score: 68,
    probability: 0.4,
    velocity: "low",
    trend: "improving",
    financial_impact_min: 200,
    financial_impact_max: 1200,
    owner: "Sophie Moreau",
    is_tipping_point: false,
    status: "open",
    color_hex: "#8b5cf6",
  },
  {
    id: "4",
    ref: "FI-008",
    name: "Fluctuation des taux de change",
    description: "Exposition importante sur les marchés émergents",
    category: "financial",
    inherent_score: 12,
    residual_score: 7,
    pagerank_score: 55,
    probability: 0.55,
    velocity: "medium",
    trend: "stable",
    financial_impact_min: 150,
    financial_impact_max: 600,
    owner: "Paul Bernard",
    is_tipping_point: false,
    status: "dismissed",
    color_hex: "#10b981",
  },
]

const RISK_CATEGORIES = {
  cyber: { label: "Cyber", color: "#ef4444" },
  operational: { label: "Opérationnel", color: "#f59e0b" },
  compliance: { label: "Conformité", color: "#8b5cf6" },
  financial: { label: "Financier", color: "#10b981" },
}

export default function RiskRegisterPage() {
  const { t } = useTranslation()
  const [risks, setRisks] = useState<Risk[]>(DUMMY_RISKS)
  const [showDismissed, setShowDismissed] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>("pagerank_score")
  const [filterCat, setFilterCat] = useState("")
  const [search, setSearch] = useState("")
  const [siteFilter, setSiteFilter] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [isGrouping, setIsGrouping] = useState(false)
  const [groupMode, setGroupMode] = useState<"typology" | "root_cause" | null>(
    null
  )
  const [riskGroups, setRiskGroups] = useState<RiskGroup[]>([])
  const [sendingToFindings, setSendingToFindings] = useState<string | null>(
    null
  )

  // React Hook Form
  const { register, handleSubmit, reset, setValue } = useForm<RiskFormData>({
    defaultValues: EMPTY_RISK,
  })

  const activeRisks = useMemo(
    () => risks.filter((r) => r.status !== "dismissed"),
    [risks]
  )
  const dismissedRisks = useMemo(
    () => risks.filter((r) => r.status === "dismissed"),
    [risks]
  )

  const filtered = useMemo(() => {
    const source = showDismissed ? dismissedRisks : activeRisks
    let result = source

    if (siteFilter) result = result.filter((r) => r.site_id === siteFilter)
    if (filterCat) result = result.filter((r) => r.category === filterCat)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.ref.toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q)
      )
    }

    return [...result].sort((a, b) => Number(b[sortBy]) - Number(a[sortBy]))
  }, [
    activeRisks,
    dismissedRisks,
    showDismissed,
    siteFilter,
    filterCat,
    search,
    sortBy,
  ])

  const openCreate = () => {
    setEditId(null)
    reset(EMPTY_RISK)
    setShowModal(true)
  }

  const openEdit = (risk: Risk) => {
    setEditId(risk.id)
    setValue("ref", risk.ref)
    setValue("name", risk.name)
    setValue("description", risk.description || "")
    setValue("category", risk.category as any)
    setValue("inherent_score", risk.inherent_score)
    setValue("residual_score", risk.residual_score)
    setValue("pagerank_score", risk.pagerank_score)
    setValue("probability", risk.probability)
    setValue("velocity", risk.velocity as any)
    setValue("trend", risk.trend as any)
    setValue("financial_impact_min", risk.financial_impact_min)
    setValue("financial_impact_max", risk.financial_impact_max)
    setValue("owner", risk.owner || "")
    setValue("is_tipping_point", risk.is_tipping_point)
    setShowModal(true)
  }

  const onSubmit: SubmitHandler<RiskFormData> = (data) => {
    const cat = RISK_CATEGORIES[data.category as keyof typeof RISK_CATEGORIES]

    const newRisk: Risk = {
      id: editId || crypto.randomUUID(),
      ...data,
      status: "open",
      color_hex: cat?.color || "#888888",
      site_id: undefined,
      site_name: undefined,
      ai_generated: false,
      is_edited: !!editId,
    }

    if (editId) {
      setRisks((prev) => prev.map((r) => (r.id === editId ? newRisk : r)))
    } else {
      setRisks((prev) => [...prev, newRisk])
    }

    setShowModal(false)
  }

  const handleDismiss = (risk: Risk) => {
    setRisks((prev) =>
      prev.map((r) => (r.id === risk.id ? { ...r, status: "dismissed" } : r))
    )
  }

  const handleRestore = (risk: Risk) => {
    setRisks((prev) =>
      prev.map((r) => (r.id === risk.id ? { ...r, status: "open" } : r))
    )
  }

  const handleAIGrouping = async (mode: "typology" | "root_cause") => {
    setIsGrouping(true)
    setGroupMode(mode)

    // Simulate AI processing
    setTimeout(() => {
      const dummyGroups: RiskGroup[] =
        mode === "root_cause"
          ? [
              {
                id: "GRP-1",
                name: "Dépendance fournisseurs critiques",
                description:
                  "Plusieurs risques liés à la chaîne d’approvisionnement",
                rootCause: "Manque de diversification des fournisseurs",
                aggregatedScore: 68,
                maxScore: 15,
                riskRefs: ["OP-012", "CY-001"],
                estimatedRiskReduction: 35,
                correctiveActions: [
                  {
                    action:
                      "Identifier et qualifier 2 fournisseurs alternatifs",
                    priority: "high",
                    normReference: "ISO 28000",
                    owner: "Supply Chain",
                    timeline: "Q3 2026",
                  },
                ],
              },
            ]
          : [
              {
                id: "GRP-2",
                name: "Risques Cyber & IT",
                description:
                  "Groupe de risques liés à la sécurité des systèmes",
                aggregatedScore: 75,
                maxScore: 12,
                riskRefs: ["CY-001"],
              },
            ]

      setRiskGroups(dummyGroups)
      setIsGrouping(false)
    }, 1200)
  }

  const handleSendToFindings = (group: RiskGroup) => {
    setSendingToFindings(group.id)
    setTimeout(() => {
      alert(`✅ Findings créés pour le groupe : ${group.name}`)
      setSendingToFindings(null)
    }, 800)
  }

  const getRiskLevel = (score: number) =>
    score >= 20
      ? "critical"
      : score >= 12
        ? "high"
        : score >= 6
          ? "medium"
          : "low"

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t("organization.riskRegister.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeRisks.length} {t("organization.riskRegister.activeRisk")} ·{" "}
            {dismissedRisks.length} {t("organization.riskRegister.delete")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleAIGrouping("typology")}
            disabled={isGrouping}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            {isGrouping && groupMode === "typology" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Layers className="h-3.5 w-3.5" />
            )}
            {t("organization.riskRegister.groupByType")}
          </button>

          <button
            onClick={() => handleAIGrouping("root_cause")}
            disabled={isGrouping}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            {isGrouping && groupMode === "root_cause" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Brain className="h-3.5 w-3.5" />
            )}
            {t("organization.riskRegister.rootCause")}
          </button>

          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${
              showDismissed
                ? "bg-muted text-foreground"
                : "border border-input bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {showDismissed ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            {showDismissed
              ? `${t("organization.riskRegister.viewAssets")}`
              : ` ${t("organization.riskRegister.delete")}: ${dismissedRisks.length}`}
          </button>

          {!showDismissed && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" />{" "}
              {t("organization.riskRegister.addNew")}
            </button>
          )}
        </div>
      </div>

      {/* AI Grouping Results */}
      {riskGroups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {groupMode === "root_cause"
                ? "🔍 Analyse Root Cause"
                : "📊 Groupes par Typologie"}{" "}
              — {riskGroups.length} Groups
            </p>
            <button
              onClick={() => setRiskGroups([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("organization.riskRegister.close")}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {riskGroups.map((group) => (
              <div
                key={group.id}
                className="space-y-2 rounded-xl border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{group.name}</p>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {group.riskRefs.length}{" "}
                    {t("organization.riskRegister.risks")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {group.description}
                </p>
                {group.rootCause && (
                  <p className="text-xs text-accent">
                    <span className="font-semibold">
                      {" "}
                      {t("organization.riskRegister.rootCause")} :
                    </span>{" "}
                    {group.rootCause}
                  </p>
                )}
                {group.estimatedRiskReduction && (
                  <p className="text-[10px] font-medium text-primary">
                    ↓ {t("organization.riskRegister.resolution")} = -
                    {group.estimatedRiskReduction}%{" "}
                    {t("organization.riskRegister.risks")}
                  </p>
                )}

                <div className="flex flex-wrap gap-1">
                  {group.riskRefs.map((ref) => (
                    <span
                      key={ref}
                      className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold"
                    >
                      {ref}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleSendToFindings(group)}
                  disabled={sendingToFindings === group.id}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  {sendingToFindings === group.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  {t("organization.riskRegister.sendToFinding")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-xs"
          />
        </div>

        <select
          value={siteFilter || ""}
          onChange={(e) => setSiteFilter(e.target.value || null)}
          className="h-9 w-40 rounded-lg border border-input bg-card px-3 text-xs lg:w-52"
        >
          <option value="">{t("organization.riskRegister.allSite")}</option>
          {DUMMY_SITES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-xs"
        >
          <option value="">{t("organization.riskRegister.allCategory")}</option>
          {Object.entries(RISK_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <div className="flex gap-1">
          {(
            ["pagerank_score", "residual_score", "probability"] as SortKey[]
          ).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`rounded-md px-2 py-1 text-[10px] font-medium ${
                sortBy === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {key === "pagerank_score"
                ? "PageRank"
                : key === "residual_score"
                  ? "Score"
                  : "Prob."}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">
                  ID
                </th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground uppercase">
                  {t("organization.riskRegister.risks")}
                </th>
                <th className="hidden px-3 py-2.5 font-semibold text-muted-foreground sm:table-cell">
                  SITE
                </th>
                <th className="hidden px-3 py-2.5 font-semibold text-muted-foreground md:table-cell">
                  CAT
                </th>
                <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">
                  SCORE
                </th>
                <th className="hidden px-3 py-2.5 text-center font-semibold text-muted-foreground lg:table-cell">
                  PR
                </th>
                <th className="hidden px-3 py-2.5 text-center font-semibold text-muted-foreground lg:table-cell">
                  IMPACT
                </th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">
                  SOURCE
                </th>
                <th className="w-20 px-3 py-2.5 font-semibold text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((risk) => {
                const cat =
                  RISK_CATEGORIES[risk.category as keyof typeof RISK_CATEGORIES]
                const level = getRiskLevel(risk.residual_score)
                const isDismissed = risk.status === "dismissed"

                return (
                  <tr
                    key={risk.id}
                    className={`border-b transition-colors ${isDismissed ? "bg-muted/20 opacity-50" : "hover:bg-muted/30"}`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {risk.is_tipping_point && (
                          <span className="text-[10px] text-accent">⚡</span>
                        )}
                        <span
                          className="font-mono font-bold"
                          style={{
                            color: isDismissed ? "#888" : risk.color_hex,
                          }}
                        >
                          {risk.ref}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-32 px-3 py-2.5 lg:max-w-48">
                      <p className="truncate font-medium">{risk.name}</p>
                      <p className="hidden truncate text-[10px] text-muted-foreground sm:block">
                        {risk.description}
                      </p>
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <span className="text-[11px] text-muted-foreground">
                        {risk.site_name || "🏢 Groupe"}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: `${cat?.color}15`,
                          color: cat?.color,
                        }}
                      >
                        {cat?.label || risk.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          level === "critical"
                            ? "bg-destructive/15 text-destructive"
                            : level === "high"
                              ? "bg-orange-500/15 text-orange-600"
                              : level === "medium"
                                ? "bg-yellow-500/15 text-yellow-600"
                                : "bg-green-500/15 text-green-600"
                        }`}
                      >
                        {risk.residual_score}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-center font-mono font-bold lg:table-cell">
                      {risk.pagerank_score}
                    </td>
                    <td className="hidden px-3 py-2.5 text-center font-mono lg:table-cell">
                      {(risk.financial_impact_max / 1000).toFixed(1)}M
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-muted-foreground">
                      {risk.ai_generated ? "🤖 IA" : "Manuel"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        {isDismissed ? (
                          <button
                            onClick={() => handleRestore(risk)}
                            className="rounded p-1 hover:bg-primary/10 hover:text-primary"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => openEdit(risk)}
                              className="rounded p-1 hover:bg-muted"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDismiss(risk)}
                              className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl">
            <h2 className="text-lg font-bold">
              {editId
                ? `${t("organization.riskRegister.modify")}`
                : `${t("organization.riskRegister.addNewRisk")}`}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Form fields using React Hook Form */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    REF *
                  </label>
                  <input
                    {...register("ref", { required: true })}
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                    placeholder="CY-01"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("organization.riskRegister.category")}
                  </label>
                  <select
                    {...register("category")}
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                  >
                    {Object.entries(RISK_CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("organization.riskRegister.riskName")} *
                </label>
                <input
                  {...register("name", { required: true })}
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("organization.riskRegister.description")}
                </label>
                <textarea
                  {...register("description")}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("organization.riskRegister.inherentScore")}
                  </label>
                  <input
                    type="number"
                    {...register("inherent_score")}
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("organization.riskRegister.residualScore")}
                  </label>
                  <input
                    type="number"
                    {...register("residual_score")}
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("organization.riskRegister.probability")}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    {...register("probability")}
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  {t("organization.riskRegister.close")}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  {editId
                    ? `${t("organization.riskRegister.update")}`
                    : `${t("organization.riskRegister.addNew")}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
