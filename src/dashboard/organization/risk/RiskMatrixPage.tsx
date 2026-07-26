/* eslint-disable @typescript-eslint/no-explicit-any */
import RiskBadge from "@/components/dashboard/organization/RiskBadge"
import SiteFilter from "@/components/dashboard/organization/SiteFilter"
import { useGetAllRisksQuery } from "@/redux/apis/organization/risk.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import type { Risk } from "@/types/organization"
import { RISK_CATEGORIES } from "@/utils/riskConfig"
import { Grid3X3, Loader2, MapPin } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

type MatrixSize = 3 | 4 | 5
type GroupMode = "none" | "category"

const LABELS: Record<MatrixSize, { likelihood: string[]; impact: string[] }> = {
  3: {
    likelihood: ["Weak", "Moderate", "Pupil"],
    impact: ["Minor", "Moderate", "Major"],
  },
  4: {
    likelihood: ["Rare", "Unlikely", "Probable", "Quasi-certain"],
    impact: ["Negligible", "Moderate", "Major", "Catastrophic"],
  },
  5: {
    likelihood: [
      "Very Unlikely",
      "Unlikely",
      "Moderately Likely",
      "Probable",
      "Very Likely",
    ],
    impact: ["Negligible", "Minor", "Moderate", "Major", "Catastrophic"],
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
  const prob = Number(risk.probability) || 0
  const impact = (Number(risk.inherent_score) || 0) / 25
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

  const labels = LABELS[matrixSize]

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
            {filteredRisks.length} {t("organization.riskMatrix.des")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Matrix Size */}
          <div className="flex overflow-hidden rounded-lg border border-border">
            {[3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setMatrixSize(s as MatrixSize)}
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
              ["none", "Tous"],
              ["category", "Par type"],
            ].map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setGroupMode(mode as GroupMode)}
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
              Impact →
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
                            className={`${getMatrixColor(row, col, matrixSize)} flex h-16 cursor-pointer flex-col items-center justify-center rounded-lg text-xs font-bold text-white transition-all hover:scale-105 ${isSelected ? "scale-105 ring-2 ring-primary ring-offset-2" : ""} ${cellRisks.length ? "shadow-md" : "opacity-75"}`}
                            title={`${label} × ${labels.impact[col]} : ${cellRisks.length} risque(s)`}
                          >
                            <span className="text-lg font-bold">
                              {(row + 1) * (col + 1)}
                            </span>
                            {cellRisks.length > 0 && (
                              <span className="mt-0.5 text-[9px] opacity-90">
                                {cellRisks.length} risque
                                {cellRisks.length > 1 ? "s" : ""}
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
                    color: "bg-green-500",
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
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">
            {selectedCell
              ? `${selectedRisks.length} Risk(s) — Score ${(selectedCell.row + 1) * (selectedCell.col + 1)}`
              : t("organization.riskMatrix.noRiskSelected")}
          </h3>

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
            <p className="font-mono text-xs text-primary">{risk.id}</p>
            {risk.ai_generated && (
              <span className="rounded bg-blue-100 px-1.5 text-[9px] text-blue-700">
                IA
              </span>
            )}
          </div>
          <p className="text-sm font-medium">{risk.name}</p>
        </div>
        <RiskBadge
          level={
            Number(risk.residual_score) > 12
              ? "critical"
              : Number(risk.residual_score) > 8
                ? "high"
                : Number(risk.residual_score) > 4
                  ? "medium"
                  : "low"
          }
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
              : undefined
          })()}
        </span>
        <span>PR: {Number(risk.pagerank_score).toFixed(0)}</span>
      </div>
    </div>
  )
}
