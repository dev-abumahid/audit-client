import { formatLocaleDate } from "@/utils/formatDate"
import { useTranslation } from "react-i18next"

interface Props {
  /** Whether this score is currently manually overridden (`*_is_override`). */
  isOverride: boolean
  /** Whether the override is stale (`*_override_stale`) -- an underlying
   * input changed after the override was set. */
  isStale: boolean
  overriddenBy: string | null | undefined
  overriddenAt: string | null | undefined
  /** e.g. "Inherent Score" / "Residual Score" -- distinguishes which score
   * this badge is about when both appear side by side. */
  label: string
}

/**
 * aexa-frontend#269 -- the visible-but-not-obtrusive half of the
 * derive-with-override-and-staleness pattern: a small badge next to a score,
 * shown whenever that score carries a manual override, in one of two states:
 *
 * - STALE (amber, `override-stale-badge`): the override is still in force,
 *   but an underlying input (probability/impact for inherent_score,
 *   inherent_score/control_*_eff for residual_score) changed since it was
 *   set, per aexa-server risk_scoring.ts's resolveInherentFields /
 *   resolveResidualFields monotonic staleness rule -- it needs
 *   re-confirmation, not silent trust.
 * - OVERRIDDEN (blue, `override-active-badge`): a fresh, non-stale override
 *   is in force. Shown so "who changed this and why" (surfaced via the
 *   `title` tooltip on hover, matching this codebase's existing
 *   `title={t(...)}` tooltip convention -- see KriDashboardPage.tsx -- there
 *   is no dedicated Tooltip UI component in this app) doesn't disappear the
 *   moment the staleness flag clears.
 *
 * Renders nothing when the score isn't overridden at all -- the common case,
 * and deliberately not "buried": both states render inline next to the
 * score, not behind an expand/collapse.
 *
 * `overriddenBy` is shown as the raw accountId, not a resolved name -- there
 * is no server endpoint to resolve an accountId to a display name from this
 * frontend, the same constraint CompliancePage.tsx's attested_by rendering
 * already documents for RiskApproval's submittedById/decidedById.
 */
export default function RiskOverrideBadge({
  isOverride,
  isStale,
  overriddenBy,
  overriddenAt,
  label,
}: Props) {
  const { t, i18n } = useTranslation()

  if (!isOverride) return null

  const tooltip = t("organization.riskRegister.overrideTooltip", {
    label,
    by: overriddenBy || t("organization.riskRegister.overrideUnknownActor"),
    date: overriddenAt
      ? formatLocaleDate(overriddenAt, i18n.language, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : t("organization.riskRegister.overrideUnknownDate"),
  })

  if (isStale) {
    return (
      <span
        data-testid="override-stale-badge"
        title={tooltip}
        className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600"
      >
        {t("organization.riskRegister.overrideStaleBadge", { label })}
      </span>
    )
  }

  return (
    <span
      data-testid="override-active-badge"
      title={tooltip}
      className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-600"
    >
      {t("organization.riskRegister.overrideActiveBadge", { label })}
    </span>
  )
}
