import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import SourceBadge from "@/components/dashboard/organization/SourceBadge"
import type { Risk, Site } from "@/types/organization"
import { RISK_CATEGORIES } from "@/utils/riskConfig"
import {
  Brain,
  Building,
  Check,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  PlusCircle,
  Save,
  Trash2,
  Upload,
  Users,
  X,
  XCircle,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { SiteForm } from "./type"

const DUMMY_SITES: Site[] = [
  {
    id: "site_001",
    organization_id: "org_123",
    user_id: "user_456",
    name: "Dhaka Manufacturing Plant",
    location: "Dhaka",
    country: "Bangladesh",
    activity: "Manufacturing",
    revenue: 12500000,
    employees_count: 350,
    site_type: "Factory",
    risk_level: "medium",
    is_active: true,
    ai_generated: false,
    is_edited: true,
    custom_fields: {
      energy_source: "Grid",
      shift_pattern: "24/7",
    },
    lat: 23.8103,
    lng: 90.4125,
    certifications: ["ISO 9001", "ISO 14001"],
    is_headquarters: false,
    revenue_contribution: 0.35,
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-03-10T14:30:00Z",
  },
  {
    id: "site_002",
    organization_id: "org_123",
    user_id: "user_789",
    name: "Paris Headquarters",
    location: "Paris",
    country: "France",
    activity: "Corporate",
    revenue: 45000000,
    employees_count: 120,
    site_type: "Head Office",
    risk_level: "low",
    is_active: true,
    ai_generated: true,
    is_edited: false,
    custom_fields: {
      building_type: "Office",
      floors: 8,
    },
    lat: 48.8566,
    lng: 2.3522,
    certifications: ["ISO 27001"],
    is_headquarters: true,
    revenue_contribution: 0.65,
    created_at: "2024-11-01T08:00:00Z",
    updated_at: "2025-02-20T12:00:00Z",
  },
]

const DUMMY_RISKS: Record<string, Risk[]> = {
  "1": [
    {
      id: "risk_001",
      organization_id: "org_123",
      user_id: "user_456",
      ref: "R-001",
      name: "Supply Chain Disruption",
      description:
        "Potential delays in raw material imports due to geopolitical instability.",
      category: "Operational",
      inherent_score: 8.5,
      residual_score: 6.2,
      pagerank_score: 0.78,
      is_tipping_point: true,
      financial_impact_min: 500000,
      financial_impact_max: 2500000,
      probability: 0.65,
      velocity: "High",
      trend: "Increasing",
      status: "Open",
      owner: "John Doe",
      color_hex: "#FF5733",
      ai_generated: false,
      is_edited: true,
      site_id: "site_001",
      source_info: "Internal audit Q1",
      control_design_eff: 0.7,
      control_operating_eff: 0.6,
      created_at: "2025-01-10T09:00:00Z",
      updated_at: "2025-03-12T11:45:00Z",
    },
    {
      id: "risk_002",
      organization_id: "org_123",
      user_id: "user_789",
      ref: "R-002",
      name: "Cybersecurity Breach",
      description:
        "Unauthorized access to internal systems and sensitive data.",
      category: "IT",
      inherent_score: 9.2,
      residual_score: 5.8,
      pagerank_score: 0.85,
      is_tipping_point: true,
      financial_impact_min: 1000000,
      financial_impact_max: 5000000,
      probability: 0.55,
      velocity: "Very High",
      trend: "Stable",
      status: "Mitigated",
      owner: "Alice Martin",
      color_hex: "#C70039",
      ai_generated: true,
      is_edited: false,
      site_id: "site_002",
      source_info: "External threat intelligence",
      control_design_eff: 0.8,
      control_operating_eff: 0.75,
      created_at: "2024-12-05T07:30:00Z",
      updated_at: "2025-02-25T16:20:00Z",
    },
  ],
  "2": [
    {
      id: "risk_003",
      organization_id: "org_123",
      user_id: "user_456",
      ref: "R-003",
      name: "Regulatory Compliance Failure",
      description: null,
      category: "Compliance",
      inherent_score: 7.0,
      residual_score: 4.5,
      pagerank_score: 0.62,
      is_tipping_point: false,
      financial_impact_min: 200000,
      financial_impact_max: 1200000,
      probability: 0.4,
      velocity: "Medium",
      trend: "Decreasing",
      status: "Under Review",
      owner: null,
      color_hex: "#FFC300",
      ai_generated: false,
      is_edited: true,
      site_id: null,
      source_info: null,
      control_design_eff: 0.65,
      control_operating_eff: 0.7,
      created_at: "2025-02-01T10:15:00Z",
      updated_at: "2025-03-18T13:00:00Z",
    },
  ],
}

export default function SitesEntities() {
  const { t } = useTranslation()
  const [sites] = useState<Site[]>(DUMMY_SITES)
  const [siteRisks] = useState<Record<string, Risk[]>>(DUMMY_RISKS)
  const [showForm, setShowForm] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [form, setForm] = useState<SiteForm>({
    name: "",
    location: "",
    country: "",
    activity: "",
    revenue: 0,
    employees_count: 0,
    site_type: "production",
    risk_level: "medium",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [expandedSite, setExpandedSite] = useState<string | null>(null)
  const [showRiskForm, setShowRiskForm] = useState<string | null>(null)
  const [riskForm, setRiskForm] = useState({
    ref: "",
    name: "",
    category: "operational",
    description: "",
  })

  const totalRevenue = sites.reduce(
    (sum, site) => sum + Number(site.revenue),
    0
  )
  const totalEmployees = sites.reduce(
    (sum, site) => sum + Number(site.employees_count),
    0
  )

  const getRiskLevel = (
    score: number
  ): "critical" | "high" | "medium" | "low" =>
    score > 14 ? "critical" : score > 10 ? "high" : score > 6 ? "medium" : "low"

  // Dummy handlers (no real API calls)
  const openCreate = () => {
    setEditingSite(null)
    setForm({
      name: "",
      location: "",
      country: "",
      activity: "",
      revenue: 0,
      employees_count: 0,
      site_type: "production",
      risk_level: "medium",
    })
    setShowForm(true)
  }

  const openEdit = (site: Site) => {
    setEditingSite(site)
    setForm({
      name: site.name,
      location: site.location || "",
      country: site.country || "",
      activity: site.activity || "",
      revenue: site.revenue,
      employees_count: site.employees_count,
      site_type: site.site_type,
      risk_level: site.risk_level,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setIsSaving(true)
    // Simulate save
    setTimeout(() => {
      toast.success("Site save")
      setShowForm(false)
      setIsSaving(false)
    }, 800)
  }

  const handleDelete = (id: string) => {
    console.log(id)
    // Simulate delete
    toast("Site supprimé")
  }

  const handleAnalyzeSite = (site: Site) => {
    toast(`Analyse IA lancée pour ${site.name}`)
    setExpandedSite(site.id)
  }

  const handleAddManualRisk = (siteId: string) => {
    console.log(siteId)
    if (!riskForm.ref || !riskForm.name) return
    toast("Risque ajouté manuellement")
    setShowRiskForm(null)
    setRiskForm({ ref: "", name: "", category: "operational", description: "" })
  }

  const handleConfirmRisk = (risk: Risk) => {
    console.log(risk)
    toast("Risque confirmé")
  }

  const handleRejectRisk = (risk: Risk) => {
    console.log(risk)
    toast("Risque rejeté")
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("organization.site&entities.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organization.site&entities.description")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
            <Upload className="h-4 w-4" /> {t("organization.site&entities.csv")}
          </button>

          <button className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20">
            <Brain className="h-4 w-4" />{" "}
            {t("organization.site&entities.aiDiscovery")}
          </button>

          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />{" "}
            {t("organization.site&entities.newSite")}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            icon: Building,
            value: sites.length,
            label: `${t("organization.site&entities.activeSite")}`,
          },
          {
            icon: MapPin,
            value: new Set(sites.map((s) => s.country).filter(Boolean)).size,
            label: `${t("organization.site&entities.pays")}`,
          },
          {
            icon: DollarSign,
            value: `€${(totalRevenue / 1000000).toFixed(1)}M`,
            label: `${t("organization.site&entities.caTotal")}`,
          },
          {
            icon: Users,
            value: totalEmployees.toLocaleString(),
            label: `${t("organization.site&entities.employees")}`,
          },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <kpi.icon className="h-5 w-5 text-primary" />
              <span className="font-mono text-3xl font-bold text-foreground">
                {kpi.value}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Sites List */}
      <div className="space-y-4">
        {sites.map((site) => {
          const risks = siteRisks[site.id] || []
          const pendingRisks = risks.filter((r) => r.status === "pending")
          const confirmedRisks = risks.filter((r) => r.status !== "pending")
          const isExpanded = expandedSite === site.id

          return (
            <div
              key={site.id}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              {/* Site Header */}
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-lg font-semibold text-foreground">
                        {site.name}
                      </p>
                      <SourceBadge
                        aiGenerated={site.ai_generated}
                        isEdited={site.is_edited}
                      />
                      <span
                        className={`rounded-full px-3 py-0.5 text-xs font-medium capitalize ${
                          site.risk_level === "critical"
                            ? "bg-destructive/10 text-destructive"
                            : site.risk_level === "high"
                              ? "bg-orange-500/10 text-orange-500"
                              : site.risk_level === "medium"
                                ? "bg-yellow-500/10 text-yellow-500"
                                : "bg-green-500/10 text-green-500"
                        }`}
                      >
                        {site.risk_level}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {site.country} • {site.activity} • {confirmedRisks.length}{" "}
                      risque{confirmedRisks.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setShowRiskForm(site.id)
                      setRiskForm({
                        ref: "",
                        name: "",
                        category: "operational",
                        description: "",
                      })
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs hover:bg-muted"
                  >
                    <PlusCircle className="h-4 w-4" />{" "}
                    {t("organization.site&entities.addRisk")}
                  </button>

                  <button
                    onClick={() => handleAnalyzeSite(site)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary hover:bg-primary/20"
                  >
                    <Brain className="h-4 w-4" />{" "}
                    {t("organization.site&entities.analyzeAi")}
                  </button>

                  <button
                    onClick={() => openEdit(site)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(site.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  {risks.length > 0 && (
                    <button
                      onClick={() =>
                        setExpandedSite(isExpanded ? null : site.id)
                      }
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Manual Risk Form */}
              {showRiskForm === site.id && (
                <div className="border-t border-border bg-muted/50 p-5">
                  <p className="mb-3 text-sm font-medium">
                    {t("organization.site&entities.addRiskTitle")}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      value={riskForm.ref}
                      onChange={(e) =>
                        setRiskForm((f) => ({ ...f, ref: e.target.value }))
                      }
                      placeholder="REF-001"
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    />
                    <input
                      value={riskForm.name}
                      onChange={(e) =>
                        setRiskForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="Example risk"
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    />
                    <select
                      value={riskForm.category}
                      onChange={(e) =>
                        setRiskForm((f) => ({ ...f, category: e.target.value }))
                      }
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {Object.entries(RISK_CATEGORIES).map(([key, cat]) => (
                        <option key={key} value={key}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={riskForm.description}
                    onChange={(e) =>
                      setRiskForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Description..."
                    className="mt-3 h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={() => setShowRiskForm(null)}
                      className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                    >
                      {t("organization.site&entities.cancel")}
                    </button>
                    <button
                      onClick={() => handleAddManualRisk(site.id)}
                      className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
                    >
                      {t("organization.site&entities.add")}
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded Risks Section */}
              {isExpanded && risks.length > 0 && (
                <div className="border-t border-border bg-muted/30 p-5">
                  {pendingRisks.length > 0 && (
                    <div className="mb-6">
                      <p className="mb-3 text-xs font-semibold tracking-widest text-accent uppercase">
                        {t("organization.site&entities.aiPendingRisk")}
                      </p>
                      {pendingRisks.map((risk) => (
                        <div
                          key={risk.id}
                          className="mb-3 flex flex-col gap-4 rounded-xl border border-accent/30 bg-accent/5 p-4 sm:flex-row"
                        >
                          <div>
                            <span
                              className="font-mono font-bold"
                              style={{ color: risk.color_hex }}
                            >
                              {risk.ref}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{risk.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {risk.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <RiskBadge
                              level={getRiskLevel(Number(risk.residual_score))}
                              label={risk.residual_score.toString()}
                            />
                            <button
                              onClick={() => handleConfirmRisk(risk)}
                              className="rounded-lg bg-green-500/10 p-2 text-green-600 hover:bg-green-500/20"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleRejectRisk(risk)}
                              className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/20"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {confirmedRisks.length > 0 && (
                    <div>
                      <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                        {t("organization.site&entities.confirmedRisk")}
                      </p>
                      <div className="space-y-2">
                        {confirmedRisks.map((risk) => (
                          <div
                            key={risk.id}
                            className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
                          >
                            <span
                              className="font-mono text-xs font-bold"
                              style={{ color: risk.color_hex }}
                            >
                              {risk.ref}
                            </span>
                            <div className="flex-1 text-sm">{risk.name}</div>
                            <RiskBadge
                              level={getRiskLevel(Number(risk.residual_score))}
                              label={risk.residual_score.toString()}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {sites.length === 0 && (
          <div className="rounded-2xl border border-border bg-card py-20 text-center">
            <Building className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">
              {t("organization.site&entities.noSite")}
            </p>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingSite ? "Modifier le site" : "Nouveau site"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("organization.site&entities.siteName")} *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                  placeholder="Example Site"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("organization.site&entities.pays")}
                  </label>
                  <input
                    value={form.country}
                    onChange={(e) =>
                      setForm({ ...form, country: e.target.value })
                    }
                    className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("organization.site&entities.siteType")}
                  </label>
                  <select
                    value={form.site_type}
                    onChange={(e) =>
                      setForm({ ...form, site_type: e.target.value })
                    }
                    className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                  >
                    <option value="headquarters">
                      {t("organization.site&entities.headOffice")}
                    </option>
                    <option value="production">
                      {t("organization.site&entities.production")}
                    </option>
                    <option value="warehouse">
                      {t("organization.site&entities.warehouse")}
                    </option>
                    <option value="other">
                      {t("organization.site&entities.other")}
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("organization.site&entities.activity")}
                </label>
                <input
                  value={form.activity}
                  onChange={(e) =>
                    setForm({ ...form, activity: e.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                {t("organization.site&entities.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !form.name.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {editingSite
                  ? `${t("organization.site&entities.update")}`
                  : `${t("organization.site&entities.add")}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
