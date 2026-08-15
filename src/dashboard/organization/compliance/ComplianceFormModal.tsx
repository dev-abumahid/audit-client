import { AlertTriangle, Loader2, Paperclip, Save, Upload, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { LineOfDefense, SiteSummary } from "@/types/organization"
import { useModalA11y } from "@/hooks/useModalA11y"
import {
  COMPLIANCE_DOMAINS,
  COMPLIANCE_RECURRENCE_KEYS as RECURRENCE_KEYS,
  COMPLIANCE_STATUS_KEYS as STATUS_KEYS,
} from "@/utils/complianceConfig"
import { COMPLIANCE_FRAMEWORK_CONTROLS } from "@/utils/complianceFrameworks"
import { formatDateOnlyForDisplay } from "@/dashboard/organization/findings/dueDateInput"
import { LINE_OF_DEFENSE_LABEL_KEY as LINE_OF_DEFENSE_KEY } from "@/utils/lineOfDefense"
import { severityBadgeClasses } from "@/utils/severityStyles"
import type { ComplianceFormState } from "./CompliancePage"

interface ComplianceFormModalProps {
  form: ComplianceFormState
  setForm: (updater: (prev: ComplianceFormState) => ComplianceFormState) => void
  editingId: string | null
  editingNextReviewDate: string | null
  sites: SiteSummary[]
  sitesError: boolean
  ownerSuggestions: string[]
  uploading: boolean
  onUploadAttachment: (file: File) => void
  onRemoveAttachment: (url: string) => void
  onClose: () => void
  onSave: () => void
  isSaving: boolean
  domainLabel: (key: string) => string
  statusLabel: (key: string) => string
}

// Create / Edit Obligation modal. Only ever mounted while `showForm` is true
// (parent renders `{showForm && <ComplianceFormModal .../>}`), so
// useModalA11y here is always called with isOpen=true -- see
// AttestConfirmModal's own comment for why that's equivalent to the
// previous isOpen-toggling-in-a-persistently-mounted-component behavior.
export default function ComplianceFormModal({
  form,
  setForm,
  editingId,
  editingNextReviewDate,
  sites,
  sitesError,
  ownerSuggestions,
  uploading,
  onUploadAttachment,
  onRemoveAttachment,
  onClose,
  onSave,
  isSaving,
  domainLabel,
  statusLabel,
}: ComplianceFormModalProps) {
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
        aria-labelledby="compliance-form-modal-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="compliance-form-modal-title"
            className="text-lg font-bold text-foreground"
          >
            {editingId
              ? t("organization.compliance.form.editTitle")
              : t("organization.compliance.form.newTitle")}
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

        <div className="space-y-3">
          <div>
            <label
              htmlFor="compliance-form-title"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              {t("organization.compliance.form.title")} *
            </label>
            <input
              id="compliance-form-title"
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          {/* quality-bar-loop round (mobile, fresh-panel finding): this
              stayed an unconditional 2-column grid even after round 2 gave
              the Status/Due-Date/Owner block below the same treatment --
              each cell measured well under 160px at 375px, tight for
              longer domain/site names. Same stack-to-one-column-below-sm
              fix as that sibling block. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="compliance-form-domain"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                {t("organization.compliance.form.domain")}
              </label>
              <select
                id="compliance-form-domain"
                value={form.domain}
                onChange={(e) =>
                  setForm((p) => ({ ...p, domain: e.target.value }))
                }
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.keys(COMPLIANCE_DOMAINS).map((key) => (
                  <option key={key} value={key}>
                    {domainLabel(key)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="compliance-form-site"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                {t("organization.compliance.form.site")}
              </label>
              <select
                id="compliance-form-site"
                value={form.site_id}
                onChange={(e) =>
                  setForm((p) => ({ ...p, site_id: e.target.value }))
                }
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">
                  {t("organization.compliance.form.orgWide")}
                </option>
                {sites.map((s) => (
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
          </div>

          <div>
            <label
              htmlFor="compliance-form-description"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {t("organization.compliance.form.description")}
            </label>
            <textarea
              id="compliance-form-description"
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="compliance-form-regulation-reference"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {t("organization.compliance.form.regulationReference")}
            </label>
            {/* Quality-bar-loop industry-standards finding: this was pure
                free text with no controlled framework/control catalog,
                unlike reference GRC tools (Vanta, Drata, OneTrust). A
                native <datalist> gives a searchable, curated catalog
                (src/utils/complianceFrameworks.ts) of real framework
                controls (GDPR/SOC2/ISO27001/HIPAA/PCI DSS/CCPA) while
                still accepting free text for obligations tied to a
                framework not in the list -- no backend schema change
                needed since regulation_reference stays a plain string. */}
            <input
              id="compliance-form-regulation-reference"
              list="compliance-framework-controls"
              value={form.regulation_reference}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  regulation_reference: e.target.value,
                }))
              }
              placeholder={t(
                "organization.compliance.form.regulationReferencePlaceholder"
              )}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            <datalist id="compliance-framework-controls">
              {COMPLIANCE_FRAMEWORK_CONTROLS.map((control) => (
                <option key={control.label} value={control.label}>
                  {control.title}
                </option>
              ))}
            </datalist>
          </div>

          {/* Round-3 industry-standards finding: line_of_defense was already
              returned/settable by the backend (Issue #97) but had no field
              anywhere in this form. */}
          <div>
            <label
              htmlFor="compliance-form-line-of-defense"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {t("organization.compliance.form.lineOfDefense")}
            </label>
            <select
              id="compliance-form-line-of-defense"
              value={form.line_of_defense}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  line_of_defense: e.target.value as LineOfDefense,
                }))
              }
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {(Object.keys(LINE_OF_DEFENSE_KEY) as LineOfDefense[]).map(
                (line) => (
                  <option key={line} value={line}>
                    {t(LINE_OF_DEFENSE_KEY[line])}
                  </option>
                )
              )}
            </select>
          </div>

          {/* quality-bar-loop round 2 (mobile, round-1 finding): this was an
              unconditional 3-column grid -- each cell measured only 92px
              wide at 375px, truncating the Status select ("In Progres") and
              overlapping the date input's calendar icon with its
              placeholder. Stacks to a single column below sm. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="compliance-form-status"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                {t("organization.compliance.form.status")}
              </label>
              <select
                id="compliance-form-status"
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({ ...p, status: e.target.value }))
                }
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {STATUS_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {statusLabel(key)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="compliance-form-due-date"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                {t("organization.compliance.form.dueDate")}
              </label>
              <input
                id="compliance-form-due-date"
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, due_date: e.target.value }))
                }
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="compliance-form-owner"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                {t("organization.compliance.form.owner")}
              </label>
              {/* quality-bar-loop round (industry-standards, fresh-panel
                  finding): owner was pure free text with no binding to a
                  real org member, unlike reference GRC tools where control
                  owners are real users. Same <datalist>-backed autocomplete
                  pattern already shipped for AuditPage's lead_auditor field
                  (round 6) -- free text still works (an owner can be an
                  external party not in this org), but nudges toward the
                  same canonical spelling every time instead of letting
                  "Jane Kimura" and "J. Kimura" silently fragment the same
                  person across obligations. */}
              <input
                id="compliance-form-owner"
                list="compliance-owner-suggestions"
                value={form.owner}
                onChange={(e) =>
                  setForm((p) => ({ ...p, owner: e.target.value }))
                }
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
              <datalist id="compliance-owner-suggestions">
                {ownerSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label
              htmlFor="compliance-form-recurrence"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {t("organization.compliance.form.recurrence")}
            </label>
            <select
              id="compliance-form-recurrence"
              value={form.recurrence}
              onChange={(e) =>
                setForm((p) => ({ ...p, recurrence: e.target.value }))
              }
              className="h-11 w-full max-w-50 rounded-md border border-input bg-background px-3 text-sm"
            >
              {RECURRENCE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key
                    ? t(`organization.compliance.recurrence.${key}`)
                    : t("organization.compliance.recurrence.oneTime")}
                </option>
              ))}
            </select>
            {/* next_review_date is derived server-side, never editable here --
                see the ComplianceObligation type's own comment. */}
            {editingId && editingNextReviewDate && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("organization.compliance.form.nextReview")}:{" "}
                {formatDateOnlyForDisplay(editingNextReviewDate, i18n.language)}
              </p>
            )}
          </div>

          {/* aexa-server#243: status "compliant" is server-side hard-gated on
              at least one attachment. Client-side warning only -- the actual
              enforcement (and the source of truth for whether this would
              actually be rejected) is assertCompliantHasEvidence on the
              backend. */}
          {form.status === "compliant" && form.attachments.length === 0 && (
            <div
              role="alert"
              className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${severityBadgeClasses("medium", { border: true })}`}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("organization.compliance.form.evidenceRequiredWarning")}
            </div>
          )}

          {/* Evidence attachments */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("organization.compliance.form.attachments")}
            </label>
            <div className="space-y-1">
              {form.attachments.map((url) => (
                <div
                  key={url}
                  className="flex items-center justify-between gap-2 rounded-md border border-input bg-background px-2 py-1 text-xs"
                >
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-1 truncate text-primary"
                  >
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="truncate">{url.split("/").pop()}</span>
                    <span className="sr-only">
                      {" "}
                      {t("organization.compliance.form.attachmentOpensInNewTab")}
                    </span>
                  </a>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(url)}
                    aria-label={t(
                      "organization.compliance.form.removeAttachment"
                    )}
                    className="focus-ring shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <label className="mt-1 flex cursor-pointer items-center gap-1 rounded-md bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80">
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              {t("organization.compliance.form.uploadEvidence")}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
                onChange={(e) =>
                  e.target.files?.[0] && onUploadAttachment(e.target.files[0])
                }
              />
            </label>
          </div>
        </div>

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
            onClick={onSave}
            disabled={isSaving || !form.title.trim()}
            className="focus-ring flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {editingId
              ? t("organization.compliance.form.update")
              : t("organization.compliance.form.create")}
          </button>
        </div>
      </div>
    </div>
  )
}
