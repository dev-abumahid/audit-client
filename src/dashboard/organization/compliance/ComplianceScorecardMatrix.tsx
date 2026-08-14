import { Link } from "react-router"
import { useTranslation } from "react-i18next"
import type {
  ComplianceMatrixCell,
  ComplianceScoreBand,
  ComplianceScorecard,
} from "@/redux/apis/organization/compliance.api"

interface ComplianceScorecardMatrixProps {
  scorecard: ComplianceScorecard | undefined
  scorecardError: boolean
  matrixDomains: string[]
  matrixSiteKeys: string[]
  cellFor: (siteKey: string, domain: string) => ComplianceMatrixCell | undefined
  domainLabel: (key: string) => string
  siteName: (siteId: string | null) => string | null
  bandClasses: Record<ComplianceScoreBand, string>
}

// Round 14 (code quality finding, fresh full-panel re-score): extracted from
// CompliancePage.tsx, same "was still ~60 lines inline" gap the obligation
// row (ComplianceObligationRow.tsx) had -- same round, same extraction
// pattern already proven for this session's modal decompositions.
export default function ComplianceScorecardMatrix({
  scorecard,
  scorecardError,
  matrixDomains,
  matrixSiteKeys,
  cellFor,
  domainLabel,
  siteName,
  bandClasses,
}: ComplianceScorecardMatrixProps) {
  const { t } = useTranslation()

  if (!scorecard || scorecard.matrix.length === 0) {
    return scorecardError ? (
      <div role="alert" className="p-6 text-center text-xs text-destructive">
        {t("organization.compliance.scorecard.loadError")}
      </div>
    ) : (
      <div className="p-6 text-center text-xs text-muted-foreground">
        {t("organization.compliance.scorecard.noData")}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left font-semibold text-muted-foreground">
              {t("organization.compliance.scorecard.site")}
            </th>
            {matrixDomains.map((d) => (
              <th
                key={d}
                className="px-2 py-1 text-center font-semibold text-muted-foreground"
              >
                {domainLabel(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrixSiteKeys.map((siteKey) => (
            <tr key={siteKey}>
              <td className="px-2 py-1 font-medium text-foreground">
                {/* aexa-frontend#553: siteKey (the real site id) was already
                    available but rendered as plain text -- reuses the
                    established ?siteId=&search= pattern (#533/#541).
                    "__org__" is a synthetic bucket, not a real site, so it's
                    never linked. */}
                {siteKey === "__org__" ? (
                  t("organization.compliance.scorecard.orgWide")
                ) : (
                  <Link
                    to={`/organization/sites?siteId=${encodeURIComponent(siteKey)}&search=${encodeURIComponent(siteName(siteKey) ?? "")}`}
                    className="focus-ring text-primary hover:underline"
                  >
                    {siteName(siteKey)}
                  </Link>
                )}
              </td>
              {matrixDomains.map((d) => {
                const cell = cellFor(siteKey, d)
                return (
                  <td key={d} className="px-1 py-1 text-center">
                    <span
                      className={`font-mono-data inline-block min-w-12 rounded-md border px-2 py-1 ${
                        bandClasses[cell?.band ?? "none"]
                      }`}
                      title={cell ? `${cell.compliant}/${cell.total}` : undefined}
                    >
                      {cell ? `${cell.compliant}/${cell.total}` : "—"}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
