import { Loader2, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type {
  ComplianceAttestation,
  ComplianceEditHistoryEntry,
  ComplianceObligation,
} from "@/redux/apis/organization/compliance.api"
import { useModalA11y } from "@/hooks/useModalA11y"
import { formatLocaleDate } from "@/utils/formatDate"

interface AttestHistoryModalProps {
  obligation: ComplianceObligation
  onClose: () => void
  entries: ComplianceAttestation[]
  isLoading: boolean
  isError: boolean
  statusLabel: (key: string) => string
  statusBadgeClass: (key: string) => string
  // Quality-bar-loop industry-standards gap: this modal grew a second tab
  // rather than a new sibling modal -- less invasive to the already-reviewed
  // attestation-history surface than adding a whole new modal + dropdown
  // item, and reuses the same historyObligation/openHistory state the
  // attestation tab already relies on (CompliancePage.tsx). editEntries is
  // fetched alongside attestation entries (same skip-until-open convention),
  // not lazily on tab switch, matching the eager-fetch pattern the
  // attestation tab already established.
  editEntries: ComplianceEditHistoryEntry[]
  isLoadingEditHistory: boolean
  isErrorEditHistory: boolean
  editFieldLabel: (field: string) => string
  editValueLabel: (field: string, value: unknown) => string
}

type HistoryTab = "attestations" | "edits"

// Attestation + edit history modal (aexa-server#250, quality-bar-loop
// industry-standards gap). attested_by/edited_by are shown as-is (a raw
// accountId) -- OrgMember's own shape only exposes account.email/profile,
// not the underlying accountId to resolve a display name against, so name
// resolution isn't possible with the endpoints this frontend currently has.
// Same constraint as RiskOverrideBadge's overriddenBy rendering.
export default function AttestHistoryModal({
  obligation,
  onClose,
  entries,
  isLoading,
  isError,
  statusLabel,
  statusBadgeClass,
  editEntries,
  isLoadingEditHistory,
  isErrorEditHistory,
  editFieldLabel,
  editValueLabel,
}: AttestHistoryModalProps) {
  const { t, i18n } = useTranslation()
  const modalRef = useModalA11y(true, onClose)
  const [tab, setTab] = useState<HistoryTab>("attestations")

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="attest-history-modal-title"
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="attest-history-modal-title"
            className="text-lg font-bold text-foreground"
          >
            {t("organization.compliance.attest.historyModalTitle", {
              title: obligation.title,
            })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("organization.compliance.attest.historyModalClose")}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div role="tablist" className="mb-3 flex gap-1 border-b border-border">
          <button
            type="button"
            role="tab"
            id="history-tab-attestations"
            aria-selected={tab === "attestations"}
            aria-controls="history-panel-attestations"
            onClick={() => setTab("attestations")}
            className={`focus-ring -mb-px flex h-11 items-center border-b-2 px-3 text-sm font-medium ${
              tab === "attestations"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("organization.compliance.attest.tabLabel")}
          </button>
          <button
            type="button"
            role="tab"
            id="history-tab-edits"
            aria-selected={tab === "edits"}
            aria-controls="history-panel-edits"
            onClick={() => setTab("edits")}
            className={`focus-ring -mb-px flex h-11 items-center border-b-2 px-3 text-sm font-medium ${
              tab === "edits"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("organization.compliance.editHistory.tabLabel")}
          </button>
        </div>

        {tab === "attestations" && (
          <div
            id="history-panel-attestations"
            role="tabpanel"
            aria-labelledby="history-tab-attestations"
          >
            {isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && isError && (
              <p role="alert" className="py-8 text-center text-sm text-destructive">
                {t("organization.compliance.attest.historyLoadError")}
              </p>
            )}

            {!isLoading && !isError && entries.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("organization.compliance.attest.historyEmpty")}
              </p>
            )}

            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(
                        entry.status_at_attestation
                      )}`}
                    >
                      {statusLabel(entry.status_at_attestation)}
                    </span>
                    <span className="text-muted-foreground">
                      {formatLocaleDate(entry.attested_at, i18n.language, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {t("organization.compliance.attest.attestedByLabel", {
                      accountId: entry.attested_by,
                    })}
                  </p>
                  {entry.note && (
                    <p className="mt-1 text-muted-foreground">{entry.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "edits" && (
          <div
            id="history-panel-edits"
            role="tabpanel"
            aria-labelledby="history-tab-edits"
          >
            {isLoadingEditHistory && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoadingEditHistory && isErrorEditHistory && (
              <p role="alert" className="py-8 text-center text-sm text-destructive">
                {t("organization.compliance.editHistory.loadError")}
              </p>
            )}

            {!isLoadingEditHistory &&
              !isErrorEditHistory &&
              editEntries.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("organization.compliance.editHistory.empty")}
                </p>
              )}

            <div className="space-y-2">
              {editEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                      {t("organization.compliance.editHistory.fieldsChangedLabel", {
                        count: Object.keys(entry.changes).length,
                      })}
                    </span>
                    <span className="text-muted-foreground">
                      {formatLocaleDate(entry.edited_at, i18n.language, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {Object.entries(entry.changes).map(([field, diff]) => (
                      <li key={field} className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {editFieldLabel(field)}:
                        </span>{" "}
                        {editValueLabel(field, diff.old)}
                        {" → "}
                        {editValueLabel(field, diff.new)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-muted-foreground">
                    {t("organization.compliance.editHistory.editedByLabel", {
                      accountId: entry.edited_by,
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
