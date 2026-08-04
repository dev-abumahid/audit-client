/* eslint-disable @typescript-eslint/no-explicit-any */
import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import SiteFilter from "@/components/dashboard/organization/SiteFilter"
import { useGetAllRisksQuery } from "@/redux/apis/organization/risk.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import type { Risk } from "@/types/organization"
import { RISK_CATEGORIES } from "@/utils/riskConfig"
import { getRiskSeverityLevel } from "@/utils/riskScoring"
import { Grid3X3, Loader2, MapPin } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

type MatrixSize = 3 | 4 | 5
type GroupMode = "none" | "category"

// Axis tick labels are the same wording across matrix sizes wherever the
// underlying concept repeats (e.g. "Unlikely" appears in the 3x3, 4x4, and
// 5x5 matrices alike), so each distinct label maps to a single shared i18n
// key rather than a per-size one -- resolved with t() at render, mirroring
// CorrelationMatrixPage's AXIS_LABELS_MAP pattern.
const LABEL_KEYS: Record<
  MatrixSize,
  { likelihood: string[]; impact: string[] }
> = {
  3: {
    likelihood: [
      "likelihoodUnlikely",
      "likelihoodPossible",
      "likelihoodLikely",
    ],
    impact: ["impactMinor", "impactModerate", "impactMajor"],
  },
  4: {
    likelihood: [
      "likelihoodRare",
      "likelihoodUnlikely",
      "likelihoodProbable",
      "likelihoodQuasiCertain",
    ],
    impact: [
      "impactNegligible",
      "impactModerate",
      "impactMajor",
      "impactCatastrophic",
    ],
  },
  5: {
    likelihood: [
      "likelihoodVeryUnlikely",
      "likelihoodUnlikely",
      "likelihoodModeratelyLikely",
      "likelihoodProbable",
      "likelihoodVeryLikely",
    ],
    impact: [
      "impactNegligible",
      "impactMinor",
      "impactModerate",
      "impactMajor",
      "impactCatastrophic",
    ],
  },
}

function getMatrixColor(row: number, col: number, size: MatrixSize): string {
  const score = ((row + 1) / size) * ((col + 1) / size)
  if (score >= 0.64) return "bg-red-500"
  if (score >= 0.36) return "bg-orange-500"
  if (score >= 0.16) return "bg-yellow-500"
  return "bg-green-500/70"
}

function mapRiskToCell(
  risk: Risk,
  size: MatrixSize
): { row: number; col: number } {
  // probability and inherent_score are both a 0-100 scale (aexa-ai's
  // risk-generation prompts spec both as "number 0-100"), not 0-1 or 1-25 --
  // normalize each to a 0-1 fraction before mapping onto the grid. This used
  // to multiply a 0-100 probability directly by `max` (any risk with
  // probability >= ~13 clamped straight to the top likelihood row) and
  // divide inherent_score by 25 then multiply by max again (double-scaled,
  // clamping to the max impact column for any inherent_score >= 32) --
  // between the two, nearly every real risk piled into one corner cell.
  const prob = (Number(risk.probability) || 0) / 100
  const impact = (Number(risk.inherent_score) || 0) / 100
  const max = size - 1
  const row = Math.min(max, Math.max(0, Math.round(prob * max)))
  const col = Math.min(max, Math.max(0, Math.round(impact * max)))
  return { row, col }
}

export default function RiskMatrixPage() {
  const { t } = useTranslation()
  const { data: riskResponse, isLoading } = useGetAllRisksQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
    siteId: "",
    category: "",
  })
  const { data: siteResponse } = useGetAllSitesQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
  })
  // ?? [] creates a fresh array reference every render when data is still
  // undefined, which would defeat filteredRisks' useMemo below — memoized
  // so the empty-array fallback is referentially stable too.
  const risks: Risk[] = useMemo(() => riskResponse?.data ?? [], [riskResponse])
  const sites: { id: string; name: string }[] = siteResponse?.data ?? []
  const [matrixSize, setMatrixSize] = useState<MatrixSize>(5)
  const [siteFilter, setSiteFilter] = useState<string | null>(null)
  const [groupMode, setGroupMode] = useState<GroupMode>("none")
  const [selectedCell, setSelectedCell] = useState<{
    row: number
    col: number
  } | null>(null)

  const filteredRisks = useMemo(() => {
    if (!siteFilter) return risks
    return risks.filter((r) => r.site_id === siteFilter)
  }, [risks, siteFilter])

  const riskGrid = useMemo(() => {
    const grid: Record<string, any[]> = {}
    filteredRisks.forEach((risk) => {
      const { row, col } = mapRiskToCell(risk, matrixSize)
      const key = `${row}-${col}`
      if (!grid[key]) grid[key] = []
      grid[key].push(risk)
    })
    return grid
  }, [filteredRisks, matrixSize])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedRisks = selectedCell
    ? riskGrid[`${selectedCell.row}-${selectedCell.col}`] || []
    : []

  const groupedSelectedRisks = useMemo(() => {
    if (groupMode === "none") return null
    const groups: Record<string, any[]> = {}
    selectedRisks.forEach((risk) => {
      const key = risk.category
      if (!groups[key]) groups[key] = []
      groups[key].push(risk)
    })
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
  }, [selectedRisks, groupMode])

  const labelKeys = LABEL_KEYS[matrixSize]
  const labels = {
    likelihood: labelKeys.likelihood.map((k) =>
      t(`organization.riskMatrix.${k}`)
    ),
    impact: labelKeys.impact.map((k) => t(`organization.riskMatrix.${k}`)),
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              {t("organization.riskMatrix.title")}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("organization.riskMatrix.des", {
              count: filteredRisks.length,
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Matrix Size */}
          <div className="flex overflow-hidden rounded-lg border border-border">
            {[3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setMatrixSize(s as MatrixSize)}
                aria-pressed={matrixSize === s}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  matrixSize === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {s}×{s}
              </button>
            ))}
          </div>

          {/* Group Mode */}
          <div className="flex overflow-hidden rounded-lg border border-border">
            {[
              ["none", t("organization.correlationMatrix.groupAll")],
              ["category", t("organization.correlationMatrix.groupByType")],
            ].map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setGroupMode(mode as GroupMode)}
                aria-pressed={groupMode === mode}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  groupMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <SiteFilter
            value={siteFilter}
            onChange={setSiteFilter}
            className="w-56"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Risk Matrix */}
        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t("organization.riskMatrix.impactAxis")}
            </span>
          </div>

          <div className="overflow-auto">
            <div className="min-w-105">
              {/* Impact Labels (Top) */}
              <div className="flex">
                <div className="w-28 shrink-0" />
                <div
                  className="mb-2 grid flex-1 gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${matrixSize}, 1fr)` }}
                >
                  {labels.impact.map((label, i) => (
                    <div
                      key={i}
                      className="text-center text-[10px] font-medium text-muted-foreground"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Matrix Rows */}
              {[...labels.likelihood].reverse().map((label, reversedRow) => {
                const row = matrixSize - 1 - reversedRow
                return (
                  <div key={row} className="mb-2 flex items-center">
                    <div className="w-28 pr-3 text-right text-[10px] font-medium text-muted-foreground">
                      {label}
                    </div>
                    <div
                      className="grid flex-1 gap-1.5"
                      style={{
                        gridTemplateColumns: `repeat(${matrixSize}, 1fr)`,
                      }}
                    >
                      {labels.impact.map((_, col) => {
                        const cellKey = `${row}-${col}`
                        const cellRisks = riskGrid[cellKey] || []
                        const isSelected =
                          selectedCell?.row === row && selectedCell?.col === col

                        return (
                          <button
                            key={col}
                            onClick={() =>
                              setSelectedCell(
                                cellRisks.length ? { row, col } : null
                              )
                            }
                            aria-pressed={isSelected}
                            aria-label={t("organization.riskMatrix.cellAriaLabel", {
                              count: cellRisks.length,
                              likelihood: label,
                              impact: labels.impact[col],
                            })}
                            className={`${getMatrixColor(row, col, matrixSize)} flex h-16 cursor-pointer flex-col items-center justify-center rounded-lg text-xs font-bold text-white transition-all hover:scale-105 ${isSelected ? "scale-105 ring-2 ring-primary ring-offset-2" : ""} ${cellRisks.length ? "shadow-md" : "opacity-75"}`}
                            title={`${label} × ${labels.impact[col]} : ${t("organization.riskMatrix.cellCount", { count: cellRisks.length })}`}
                          >
                            <span className="text-lg font-bold">
                              {(row + 1) * (col + 1)}
                            </span>
                            {cellRisks.length > 0 && (
                              <span className="mt-0.5 text-[9px] opacity-90">
                                {t("organization.riskMatrix.cellCount", {
                                  count: cellRisks.length,
                                })}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Legend */}
              <div className="mt-6 flex flex-wrap gap-4">
                {[
                  {
                    color: "bg-red-500",
                    label: t("organization.riskMatrix.critical"),
                  },
                  {
                    color: "bg-orange-500",
                    label: t("organization.riskMatrix.major"),
                  },
                  {
                    color: "bg-yellow-500",
                    label: t("organization.riskMatrix.moderate"),
                  },
                  {
                    color: "bg-green-500/70",
                    label: t("organization.riskMatrix.weak"),
                  },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`h-3 w-3 rounded ${color}`} />
                    <span className="text-xs text-muted-foreground">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Details Panel */}
        {/* aexa-frontend#472 -- this was an h3 with no h2 anywhere on the
            page (h1 above it, nothing in between), breaking heading-level
            order for screen-reader users. It's the only sub-heading on this
            page, so promoting it to h2 (rather than inserting a separate
            empty h2) is the smallest correct fix. */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">
            {selectedCell
              ? t("organization.riskMatrix.selectedCellHeading", {
                  count: selectedRisks.length,
                  score: (selectedCell.row + 1) * (selectedCell.col + 1),
                })
              : t("organization.riskMatrix.noRiskSelected")}
          </h2>

          {selectedRisks.length > 0 ? (
            <div className="max-h-130 space-y-3 overflow-y-auto pr-1">
              {groupMode === "category" && groupedSelectedRisks
                ? groupedSelectedRisks.map(([cat, catRisks]) => (
                    <div key={cat}>
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              RISK_CATEGORIES[
                                cat as keyof typeof RISK_CATEGORIES
                              ]?.color,
                          }}
                        />
                        <span className="text-xs font-semibold">
                          {(() => {
                            const labelKey =
                              RISK_CATEGORIES[
                                cat as keyof typeof RISK_CATEGORIES
                              ]?.labelKey
                            return labelKey
                              ? t(`organization.riskCategories.${labelKey}`)
                              : cat
                          })()}{" "}
                          ({catRisks.length})
                        </span>
                      </div>
                      {catRisks.map((risk) => (
                        <RiskCard
                          key={risk.id}
                          risk={risk}
                          sites={sites}
                        />
                      ))}
                    </div>
                  ))
                : selectedRisks.map((risk) => (
                    <RiskCard key={risk.id} risk={risk} sites={sites} />
                  ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Grid3X3 className="mb-3 h-12 w-12 opacity-30" />
              <p>{t("organization.riskMatrix.selectRiskHint")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RiskCard({
  risk,
  sites,
}: {
  risk: Risk
  sites: { id: string; name: string }[]
}) {
  const { t } = useTranslation()
  const siteName = sites.find((s) => s.id === risk.site_id)?.name

  return (
    <div className="space-y-2 rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-mono text-xs text-primary">{risk.ref}</p>
            {risk.ai_generated && (
              <span className="rounded bg-blue-100 px-1.5 text-[9px] text-blue-700">
                {t("organization.riskRegister.aiGenerated")}
              </span>
            )}
          </div>
          <p className="text-sm font-medium">{risk.name}</p>
        </div>
        <RiskBadge
          level={getRiskSeverityLevel(risk.residual_score)}
          size="sm"
        />
      </div>

      {siteName && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {siteName}
        </div>
      )}

      <p className="line-clamp-2 text-xs text-muted-foreground">
        {risk.description}
      </p>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor:
                RISK_CATEGORIES[risk.category as keyof typeof RISK_CATEGORIES]
                  ?.color,
            }}
          />
          {(() => {
            const labelKey =
              RISK_CATEGORIES[risk.category as keyof typeof RISK_CATEGORIES]
                ?.labelKey
            return labelKey
              ? t(`organization.riskCategories.${labelKey}`)
              : risk.category
          })()}
        </span>
        <span>
          {t("organization.riskMatrix.pagerankAbbrLabel")}{" "}
          {Number(risk.pagerank_score).toFixed(0)}
        </span>
      </div>
    </div>
  )
}
