import { useGetRiskApprovalStateQuery } from "@/redux/apis/organization/riskApproval.api"
import { useGetSingleRiskQuery } from "@/redux/apis/organization/risk.api"
import { formatLocaleDate } from "@/utils/formatDate"
import { RISK_CATEGORIES, riskCategoryLabel } from "@/utils/riskConfig"
import { getRiskSeverityLevel } from "@/utils/riskScoring"
import { severityBadgeClasses } from "@/utils/severityStyles"
import type { LineOfDefense } from "@/types/organization"
import {
  AlertCircle,
  Bot,
  Building2,
  ChevronLeft,
  Gauge,
  Shield,
  User,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router"
import RiskApprovalControls from "./RiskApprovalControls"
import RiskOverrideBadge from "./RiskOverrideBadge"

// aexa-frontend#529: the root-cause fix behind #167's cross-linking theme --
// Risk had no addressable detail page, so every inbound reference from
// Audit's linked-risks, Intelligence's "View Risk", KRI, or Governance
// degraded to "go find it in the register list yourself" (see #165, which
// documents the exact limitation this page removes).
//
// Deliberately read-only: this page's job is to give every cross-link a
// real destination, not to duplicate RiskRegisterPage.tsx's ~500-line
// inline edit form. "Manage in Register" routes back to the register, which
// already owns editing -- rebuilding that here would be scope creep beyond
// what #529 asked for. Approval actions ARE included (via the existing
// RiskApprovalControls, unchanged) since those are a single self-contained
// component, not a form to duplicate.
const LINE_OF_DEFENSE_KEY: Record<LineOfDefense, string> = {
  FIRST: "organization.threeLinesOfDefense.lines.first",
  SECOND: "organization.threeLinesOfDefense.lines.second",
  THIRD: "organization.threeLinesOfDefense.lines.third",
  GOVERNING_BODY: "organization.threeLinesOfDefense.lines.governingBody",
}

// Round-1 review finding: velocity/trend/status were rendered as raw
// backend enum values instead of going through the same translated labels
// RiskRegisterPage.tsx's edit-form <select> options already use for these
// exact fields -- fixed here to stay consistent (and translated) rather
// than leaking raw strings like "increasing"/"open" into the French UI.
const VELOCITY_KEY: Record<string, string> = {
  critical: "organization.riskRegister.velocityCritical",
  high: "organization.riskRegister.velocityHigh",
  medium: "organization.riskRegister.velocityMedium",
  low: "organization.riskRegister.velocityLow",
}
const TREND_KEY: Record<string, string> = {
  increasing: "organization.riskRegister.trendIncreasing",
  decreasing: "organization.riskRegister.trendDecreasing",
  none: "organization.riskRegister.trendNone",
}
const STATUS_KEY: Record<string, string> = {
  open: "organization.riskRegister.statusOpen",
  in_progress: "organization.riskRegister.statusInProgress",
  completed: "organization.riskRegister.statusCompleted",
  closed: "organization.riskRegister.statusClosed",
}

export default function RiskDetails() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useGetSingleRiskQuery(id as string)
  // Single-risk fetches don't carry approval state (see risk.api.ts's
  // getSingleRisk comment) -- fetched separately and merged into what
  // RiskApprovalControls receives, so it sees the same real approval data
  // the register's per-row instance does, not an incorrectly-defaulted
  // "not submitted" state.
  const { data: approvalData } = useGetRiskApprovalStateQuery(id as string, {
    skip: !id,
  })

  const formatDate = (dateString: string) => {
    try {
      return formatLocaleDate(dateString, i18n.language, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    } catch {
      return dateString
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            {t("organization.riskRegister.detailsLoading")}
          </p>
        </div>
      </div>
    )
  }

  const risk = data?.data

  if (!risk) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            {t("organization.riskRegister.detailsNotFound")}
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="focus-ring mx-auto flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ChevronLeft className="h-4 w-4" />{" "}
            {t("organization.riskRegister.detailsGoBack")}
          </button>
        </div>
      </div>
    )
  }

  const riskForApproval = {
    ...risk,
    approval: approvalData?.data.approval ?? null,
    approvalStatus: approvalData?.data.status,
  }

  return (
    <div className="min-h-screen space-y-6 bg-background p-6">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="focus-ring mb-4 flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />{" "}
          {t("organization.riskRegister.detailsBack")}
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono-data text-xs text-muted-foreground">
                {risk.ref}
              </span>
              {(() => {
                const cat =
                  RISK_CATEGORIES[
                    risk.category as keyof typeof RISK_CATEGORIES
                  ]
                const catColor = cat?.color || "hsl(220, 10%, 46%)"
                return (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${catColor} 15%, transparent)`,
                      color: catColor,
                    }}
                  >
                    {riskCategoryLabel(t, risk.category)}
                  </span>
                )
              })()}
              {risk.ai_generated ? (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Bot className="h-3 w-3 shrink-0" />
                  {t("organization.riskRegister.aiGenerated")}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  {t("organization.riskRegister.manual")}
                </span>
              )}
            </div>
            <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground">
              {risk.name}
            </h1>
            {risk.description && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {risk.description}
              </p>
            )}
          </div>

          <button
            onClick={() => navigate("/organization/risks")}
            className="focus-ring shrink-0 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t("organization.riskRegister.detailsManageInRegister")}
          </button>
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            {t("organization.riskRegister.inherentScoreLabel")}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${severityBadgeClasses(
                getRiskSeverityLevel(risk.inherent_score)
              )}`}
            >
              {risk.inherent_score}
            </span>
            <RiskOverrideBadge
              isOverride={!!risk.inherent_is_override}
              isStale={!!risk.inherent_override_stale}
              overriddenBy={risk.inherent_overridden_by}
              overriddenAt={risk.inherent_overridden_at}
              label={t("organization.riskRegister.inherentScoreLabel")}
            />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            {t("organization.riskRegister.residualScoreLabel")}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${severityBadgeClasses(
                getRiskSeverityLevel(risk.residual_score)
              )}`}
            >
              {risk.residual_score}
            </span>
            <RiskOverrideBadge
              isOverride={!!risk.residual_is_override}
              isStale={!!risk.residual_override_stale}
              overriddenBy={risk.residual_overridden_by}
              overriddenAt={risk.residual_overridden_at}
              label={t("organization.riskRegister.residualScoreLabel")}
            />
          </div>
        </div>
      </div>

      {/* Assessment */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Gauge className="h-4 w-4 text-primary" />
          {t("organization.riskRegister.riskAssessmentTitle")}
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("organization.riskRegister.probabilityLabel")}
            </dt>
            <dd className="font-mono-data font-medium text-foreground">
              {risk.probability}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("organization.riskRegister.velocityLabel")}
            </dt>
            <dd className="font-medium text-foreground">
              {VELOCITY_KEY[risk.velocity]
                ? t(VELOCITY_KEY[risk.velocity])
                : risk.velocity}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("organization.riskRegister.trendLabel")}
            </dt>
            <dd className="font-medium text-foreground">
              {TREND_KEY[risk.trend] ? t(TREND_KEY[risk.trend]) : risk.trend}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("organization.riskRegister.statusLabel")}
            </dt>
            <dd className="font-medium text-foreground">
              {STATUS_KEY[risk.status]
                ? t(STATUS_KEY[risk.status])
                : risk.status}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("organization.riskRegister.pagerankScoreLabel")}
            </dt>
            <dd className="font-mono-data font-medium text-foreground">
              {risk.pagerank_score}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("organization.riskRegister.minImpactLabel")}
            </dt>
            <dd className="font-mono-data font-medium text-foreground">
              {(risk.financial_impact_min / 1000).toFixed(1)}M
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("organization.riskRegister.maxImpactLabel")}
            </dt>
            <dd className="font-mono-data font-medium text-foreground">
              {(risk.financial_impact_max / 1000).toFixed(1)}M
            </dd>
          </div>
        </dl>
      </div>

      {/* Controls + site + line of defense */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Shield className="h-4 w-4 text-primary" />
            {t("organization.riskRegister.controlEffectivenessTitle")}
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {t("organization.riskRegister.designEffectivenessLabel")}
              </dt>
              <dd className="font-mono-data font-medium text-foreground">
                {risk.control_design_eff}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {t("organization.riskRegister.operatingEffectivenessLabel")}
              </dt>
              <dd className="font-mono-data font-medium text-foreground">
                {risk.control_operating_eff}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            {t("organization.riskRegister.colSite")}
          </h2>
          <p className="flex items-center gap-1.5 text-sm text-foreground">
            {risk.site?.name ? (
              // aexa-frontend#541: same ?siteId=&search= pattern #533 used
              // for a Finding's site -- SitesEntities has no per-site
              // route, so this reuses its existing search-narrow +
              // auto-expand-and-highlight mechanism instead of building one.
              <Link
                to={`/organization/sites?siteId=${encodeURIComponent(risk.site.id)}&search=${encodeURIComponent(risk.site.name)}`}
                className="focus-ring text-primary hover:underline"
              >
                {risk.site.name}
              </Link>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                {t("organization.riskRegister.groupFallback")}
              </span>
            )}
          </p>
          <h2 className="mt-4 mb-1 text-sm font-semibold text-foreground">
            {t("organization.riskRegister.lineOfDefenseLabel")}
          </h2>
          <p className="text-sm text-foreground">
            {t(LINE_OF_DEFENSE_KEY[risk.line_of_defense])}
          </p>
        </div>
      </div>

      {/* Approval */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <User className="h-4 w-4 text-primary" />
          {t("organization.riskRegister.detailsApprovalTitle")}
        </h2>
        <RiskApprovalControls risk={riskForApproval} />
      </div>

      <p className="text-xs text-muted-foreground">
        {t("organization.riskRegister.detailsCreatedLabel")}:{" "}
        {formatDate(risk.createdAt)} ·{" "}
        {t("organization.riskRegister.detailsUpdatedLabel")}:{" "}
        {formatDate(risk.updatedAt)}
      </p>
    </div>
  )
}
