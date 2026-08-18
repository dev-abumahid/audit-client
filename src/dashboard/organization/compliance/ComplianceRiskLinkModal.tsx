import { Link2, Loader2, PlusCircle, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useModalA11y } from "@/hooks/useModalA11y"
import type { ComplianceObligation } from "@/redux/apis/organization/compliance.api"
import {
  useCreateRiskFromObligationMutation,
  useLinkRiskToObligationMutation,
} from "@/redux/apis/organization/compliance.api"
import { useGetAllRisksQuery } from "@/redux/apis/organization/risk.api"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import { submitWithToast } from "@/utils/submitWithToast"

interface ComplianceRiskLinkModalProps {
  obligation: ComplianceObligation
  onClose: () => void
}

type Mode = "create" | "existing"

const SEVERITY_OPTIONS = ["critical", "high", "medium", "low"] as const

// aexa-server#346 -- Point 1 of the ticket: creating a regulatory obligation
// didn't create or link a Risk, so regulatory items never flowed into the
// Risk Register. This modal is the UI half of that fix, offered as a
// deliberately OPTIONAL action (not every obligation is itself a distinct
// risk, per the CEO feedback this ticket quotes) rather than an automatic
// side effect of every obligation create.
//
// Two modes, mirroring the two backend endpoints:
//   - "create": POST /compliance/:id/create-risk -- spawns a brand-new Risk
//     pre-filled from this obligation (same "promotion" shape
//     IntelligencePage's Create Risk button already uses for scraped
//     items -- see intelligence.service.ts's create_risk_from_item_into_db).
//   - "existing": POST /compliance/:id/link-risk -- attaches a Risk that
//     already exists in the register, for the case where the regulatory
//     risk was entered independently and just needs tying back to its
//     source obligation.
// Only ever mounted while an obligation is selected (parent renders
// `{riskLinkObligation && <ComplianceRiskLinkModal .../>}`), same
// always-isOpen-true useModalA11y convention as this folder's other modals.
export default function ComplianceRiskLinkModal({
  obligation,
  onClose,
}: ComplianceRiskLinkModalProps) {
  const { t } = useTranslation()
  const modalRef = useModalA11y(true, onClose)
  const [mode, setMode] = useState<Mode>("create")
  const [siteId, setSiteId] = useState("")
  const [severity, setSeverity] = useState<(typeof SEVERITY_OPTIONS)[number] | "">("")
  const [selectedRiskId, setSelectedRiskId] = useState("")

  const { data: sitesData, isError: sitesError } = useGetAllSitesQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
  })
  // Existing-risk picker only needs to fetch once the "existing" tab is
  // actually open -- same idle-until-needed convention as this page's other
  // on-demand queries (e.g. attestation/edit history).
  const { data: risksData, isFetching: risksLoading } = useGetAllRisksQuery(
    { page: 1, limit: 100, searchTerm: "", siteId: "", category: "" },
    { skip: mode !== "existing" }
  )

  const [createRiskFromObligation, { isLoading: isCreating }] =
    useCreateRiskFromObligationMutation()
  const [linkRiskToObligation, { isLoading: isLinking }] =
    useLinkRiskToObligationMutation()
  const isSubmitting = isCreating || isLinking

  // Review finding: this used to call the mutation and toast.success
  // unconditionally, never checking `res.success` -- an RTK Query mutation
  // can resolve with HTTP 200 and `{ success: false, message: "..." }`
  // (manage_response.ts on the backend), which would have shown a
  // false-positive success toast and closed the modal without actually
  // creating/linking anything. submitWithToast (shared with CompliancePage.tsx,
  // its original home) branches on `res.success` correctly and only calls
  // `onClose` (via `onSuccess`) on a real success.
  const handleCreate = () =>
    submitWithToast(
      () =>
        createRiskFromObligation({
          obligationId: obligation.id,
          siteId: siteId || undefined,
          severity: severity || undefined,
        }).unwrap(),
      t("organization.compliance.riskLink.toast.createSuccess"),
      t("organization.compliance.riskLink.toast.createFailed"),
      onClose
    )

  const handleLinkExisting = () => {
    if (!selectedRiskId) return
    return submitWithToast(
      () =>
        linkRiskToObligation({
          obligationId: obligation.id,
          riskId: selectedRiskId,
        }).unwrap(),
      t("organization.compliance.riskLink.toast.linkSuccess"),
      t("organization.compliance.riskLink.toast.linkFailed"),
      onClose
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compliance-risk-link-modal-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2
            id="compliance-risk-link-modal-title"
            className="text-lg font-bold text-foreground"
          >
            {t("organization.compliance.riskLink.modalTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("organization.compliance.form.close")}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          {t("organization.compliance.riskLink.modalSubtitle", {
            title: obligation.title,
          })}
        </p>

        {/* Review finding: this segmented control had no role="tab"/
            aria-selected, so a screen reader announced it as two unrelated
            buttons rather than a tab group. */}
        <div
          role="tablist"
          aria-label={t("organization.compliance.riskLink.modalTitle")}
          className="mb-3 flex gap-1 rounded-lg border border-input bg-muted p-1"
        >
          <button
            type="button"
            role="tab"
            id="risk-link-tab-create"
            aria-selected={mode === "create"}
            aria-controls="risk-link-tabpanel"
            onClick={() => setMode("create")}
            className={`flex h-9 flex-1 items-center justify-center gap-1 rounded-md text-xs font-medium ${
              mode === "create"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            {t("organization.compliance.riskLink.createNewTab")}
          </button>
          <button
            type="button"
            role="tab"
            id="risk-link-tab-existing"
            aria-selected={mode === "existing"}
            aria-controls="risk-link-tabpanel"
            onClick={() => setMode("existing")}
            className={`flex h-9 flex-1 items-center justify-center gap-1 rounded-md text-xs font-medium ${
              mode === "existing"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            {t("organization.compliance.riskLink.linkExistingTab")}
          </button>
        </div>

        {mode === "create" ? (
          <div
            id="risk-link-tabpanel"
            role="tabpanel"
            aria-labelledby="risk-link-tab-create"
            className="space-y-3"
          >
            <div>
              <label
                htmlFor="risk-link-site"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                {t("organization.compliance.riskLink.siteLabel")}
              </label>
              <select
                id="risk-link-site"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">
                  {/* Falls back to the obligation's own site, then the
                      org's earliest site -- see
                      compliance.service.ts's loadObligationAndTargetSite. */}
                  {t("organization.compliance.riskLink.siteAuto")}
                </option>
                {sitesData?.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {sitesError && (
                <p role="alert" className="mt-1 text-[11px] text-destructive">
                  {t("organization.compliance.sitesLoadError")}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="risk-link-severity"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                {t("organization.compliance.riskLink.severityLabel")}
              </label>
              <select
                id="risk-link-severity"
                value={severity}
                onChange={(e) =>
                  setSeverity(e.target.value as (typeof SEVERITY_OPTIONS)[number] | "")
                }
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">
                  {t("organization.compliance.riskLink.selectSeverity")}
                </option>
                {SEVERITY_OPTIONS.map((level) => (
                  <option key={level} value={level}>
                    {t(`riskLevel.${level}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div
            id="risk-link-tabpanel"
            role="tabpanel"
            aria-labelledby="risk-link-tab-existing"
          >
            <label
              htmlFor="risk-link-existing"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {t("organization.compliance.riskLink.existingRiskLabel")}
            </label>
            <select
              id="risk-link-existing"
              value={selectedRiskId}
              onChange={(e) => setSelectedRiskId(e.target.value)}
              disabled={risksLoading}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">
                {t("organization.compliance.riskLink.selectRisk")}
              </option>
              {risksData?.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.ref ? `${r.ref} — ${r.name}` : r.name}
                </option>
              ))}
            </select>
            {!risksLoading && risksData?.data?.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("organization.compliance.riskLink.noRisksFound")}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring flex h-11 items-center rounded-lg border border-input px-4 text-sm text-muted-foreground hover:bg-muted"
          >
            {t("organization.compliance.form.cancel")}
          </button>
          <button
            type="button"
            onClick={mode === "create" ? handleCreate : handleLinkExisting}
            disabled={isSubmitting || (mode === "existing" && !selectedRiskId)}
            className="focus-ring flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create"
              ? t("organization.compliance.riskLink.create")
              : t("organization.compliance.riskLink.link")}
          </button>
        </div>
      </div>
    </div>
  )
}
