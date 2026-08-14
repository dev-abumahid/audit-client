import { Loader2, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type {
  ComplianceAttestation,
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
}

// Attestation history modal (aexa-server#250). attested_by is shown as-is (a
// raw accountId) -- OrgMember's own shape only exposes account.email/profile,
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
}: AttestHistoryModalProps) {
  const { t, i18n } = useTranslation()
  const modalRef = useModalA11y(true, onClose)

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
    </div>
  )
}
