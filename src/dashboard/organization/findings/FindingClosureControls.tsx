import {
  useMyActiveFindingAssignmentIds,
  useMyAssignedInspectionIds,
} from "@/hooks/useMyAssignments"
import { useMyOrgRole } from "@/hooks/useMyOrgRole"
import { useGetMeQuery } from "@/redux/apis/auth.api"
import {
  useApproveFindingClosureMutation,
  useGetFindingClosureStateQuery,
  useRejectFindingClosureMutation,
  useSubmitFindingForClosureMutation,
} from "@/redux/apis/organization/findingClosure.api"
import type { ClosureDisplayState, IAction } from "@/types/finding"
import { useModalA11y } from "@/hooks/useModalA11y"
import { canWriteFinding } from "@/utils/assignmentScope"
import { formatLocaleDate } from "@/utils/formatDate"
import { AlertTriangle, Check, Send, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

// Tailwind classes + i18n label key per display state, same pattern as
// RiskApprovalControls' BADGE_STYLES.
const BADGE_STYLES: Record<
  ClosureDisplayState,
  { className: string; labelKey: string }
> = {
  NOT_SUBMITTED: {
    className: "bg-muted text-muted-foreground",
    labelKey: "organization.findings.closure.badgeNotSubmitted",
  },
  PENDING_APPROVAL: {
    className: "bg-yellow-500/15 text-yellow-600",
    labelKey: "organization.findings.closure.badgePending",
  },
  APPROVED: {
    className: "bg-green-500/15 text-green-600",
    labelKey: "organization.findings.closure.badgeApproved",
  },
  REJECTED: {
    className: "bg-destructive/15 text-destructive",
    labelKey: "organization.findings.closure.badgeRejected",
  },
}

interface Props {
  action: IAction
}

/**
 * Per-finding closure badge + role-gated maker-checker actions
 * (aexa-server#252 / aexa-frontend#214): submit-for-closure (COMPLETE or
 * CANT_DO) for anyone who can write to the finding, and Approve/Reject for
 * ADMIN/LEAD_AUDITOR on a pending one. Mirrors RiskApprovalControls.tsx's
 * structure. Role gating here is a UX convenience only -- every action is
 * re-checked server-side (assertCanWriteToAction / assertCanWriteOrgResource,
 * plus the self-approval guard).
 *
 * Once action.status is already COMPLETE/CANT_DO there is no "reopen" flow
 * on the backend -- this component just shows the closed state, no submit
 * controls, matching that reality rather than offering a control that would
 * always fail.
 */
export default function FindingClosureControls({ action }: Props) {
  const { t, i18n } = useTranslation()
  const role = useMyOrgRole()
  const { data: me, isLoading: isMeLoading } = useGetMeQuery()
  const { data: closureData, isLoading: isClosureLoading } =
    useGetFindingClosureStateQuery(action.id)

  const [submitForClosure, { isLoading: isSubmitting }] =
    useSubmitFindingForClosureMutation()
  const [approveClosure, { isLoading: isApproving }] =
    useApproveFindingClosureMutation()
  const [rejectClosure, { isLoading: isRejecting }] =
    useRejectFindingClosureMutation()

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  // Round 13 (#506) -- role="dialog"/focus-trap/Escape for the reject modal,
  // same pattern RiskApprovalControls' Reject modal uses (#488).
  const rejectModalRef = useModalA11y(showRejectModal, () => {
    setShowRejectModal(false)
    setRejectReason("")
  })

  const isClosed = action.status === "COMPLETE" || action.status === "CANT_DO"
  const status: ClosureDisplayState = closureData?.data?.status ?? "NOT_SUBMITTED"
  const closure = closureData?.data?.closure ?? null
  const badge = BADGE_STYLES[status]

  // aexa-frontend#270: canSubmit used to be role-only (ADMIN/LEAD_AUDITOR/
  // LIGHT_USER unconditionally), so an unassigned LEAD_AUDITOR or a
  // LIGHT_USER with no (or a revoked/pending) FindingAssignment for THIS
  // finding saw a Submit control the server's assertCanWriteToAction would
  // 403 on. canWriteFinding mirrors that exact server rule: ADMIN always;
  // LEAD_AUDITOR only if assigned to the finding's parent inspection;
  // LIGHT_USER only with a live (ACTIVE, non-revoked) FindingAssignment for
  // this exact finding. `lightUserDegradeDefault: true` preserves this
  // component's own pre-#270 default (any LIGHT_USER could submit) for the
  // "assignment data hasn't loaded/failed" case, matching this issue's
  // graceful-degradation requirement -- other call sites that previously
  // excluded LIGHT_USER entirely keep `false` (canWriteFinding's own
  // default) instead.
  const assignedInspectionIds = useMyAssignedInspectionIds()
  const activeFindingAssignmentIds = useMyActiveFindingAssignmentIds()
  const canSubmit = canWriteFinding(
    role,
    action.id,
    action.inspectionId,
    assignedInspectionIds,
    activeFindingAssignmentIds,
    true
  )
  const canDecideRole = role === "ADMIN" || role === "LEAD_AUDITOR"
  const canResubmit = status === "NOT_SUBMITTED" || status === "REJECTED"
  const isPending = status === "PENDING_APPROVAL"
  const hasEvidence = action.attachments.length > 0

  // Same conservative-default pattern as RiskApprovalControls: neither the
  // decide buttons nor the awaiting-reviewer message render until `me`
  // resolves, since this component can't tell submitter apart from reviewer
  // until then.
  const isSubmitter =
    !isMeLoading && !!me?.data?.id && me.data.id === closure?.submittedById
  const canDecide = !isMeLoading && canDecideRole && isPending && !isSubmitter
  const showAwaitingReviewer =
    !isMeLoading && canDecideRole && isPending && isSubmitter

  const handleSubmit = async (requestedStatus: "COMPLETE" | "CANT_DO") => {
    try {
      const res = await submitForClosure({
        actionId: action.id,
        requestedStatus,
      }).unwrap()
      if (res.success) {
        toast.success(t("organization.findings.closure.submitSuccess"))
      } else {
        toast.error(
          res.message || t("organization.findings.closure.submitFailed")
        )
      }
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ||
          t("organization.findings.closure.submitFailed")
      )
    }
  }

  const handleApprove = async () => {
    if (!closure) return
    try {
      const res = await approveClosure(closure.id).unwrap()
      if (res.success) {
        toast.success(t("organization.findings.closure.approveSuccess"))
      } else {
        toast.error(
          res.message || t("organization.findings.closure.approveFailed")
        )
      }
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ||
          t("organization.findings.closure.approveFailed")
      )
    }
  }

  const handleReject = async () => {
    if (!closure) return
    if (!rejectReason.trim()) {
      toast.error(t("organization.findings.closure.rejectReasonRequired"))
      return
    }
    try {
      const res = await rejectClosure({
        closureId: closure.id,
        decisionNote: rejectReason.trim(),
      }).unwrap()
      if (res.success) {
        toast.success(t("organization.findings.closure.rejectSuccess"))
        setShowRejectModal(false)
        setRejectReason("")
      } else {
        toast.error(
          res.message || t("organization.findings.closure.rejectFailed")
        )
      }
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ||
          t("organization.findings.closure.rejectFailed")
      )
    }
  }

  if (isClosureLoading) return null

  return (
    <div className="flex flex-col items-start gap-1.5 rounded-lg border border-border bg-card p-3">
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
      >
        {t(badge.labelKey)}
      </span>

      {!isClosed && canSubmit && canResubmit && (
        <>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => handleSubmit("COMPLETE")}
              disabled={isSubmitting || !hasEvidence}
              className="flex items-center gap-1 rounded border border-input px-1.5 py-0.5 text-[10px] font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-2.5 w-2.5" />
              {t("organization.findings.closure.submitComplete")}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit("CANT_DO")}
              disabled={isSubmitting || !hasEvidence}
              className="flex items-center gap-1 rounded border border-input px-1.5 py-0.5 text-[10px] font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-2.5 w-2.5" />
              {t("organization.findings.closure.submitCantDo")}
            </button>
          </div>
          {!hasEvidence && (
            <p className="flex max-w-[260px] items-center gap-1 text-[10px] text-muted-foreground">
              <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
              {t("organization.findings.closure.evidenceRequired")}
            </p>
          )}
        </>
      )}

      {canDecide && (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isApproving}
            className="flex items-center gap-1 rounded border border-green-500/40 px-1.5 py-0.5 text-[10px] font-medium text-green-600 hover:bg-green-500/10 disabled:opacity-50"
          >
            <Check className="h-2.5 w-2.5" />
            {t("organization.findings.closure.approve")}
          </button>
          <button
            type="button"
            onClick={() => setShowRejectModal(true)}
            disabled={isRejecting}
            className="flex items-center gap-1 rounded border border-destructive/40 px-1.5 py-0.5 text-[10px] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <X className="h-2.5 w-2.5" />
            {t("organization.findings.closure.reject")}
          </button>
        </div>
      )}

      {showAwaitingReviewer && (
        <p className="max-w-[260px] text-[10px] text-muted-foreground italic">
          {t("organization.findings.closure.awaitingOtherReviewer")}
        </p>
      )}

      {status === "REJECTED" && closure?.decisionNote && (
        <p className="max-w-[260px] text-[10px] text-destructive">
          {t("organization.findings.closure.rejectionReason", {
            reason: closure.decisionNote,
          })}
        </p>
      )}

      {status === "APPROVED" && closure?.decidedAt && (
        <p className="text-[10px] text-muted-foreground">
          {t("organization.findings.closure.decidedOn", {
            date: formatLocaleDate(closure.decidedAt, i18n.language),
          })}
        </p>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            ref={rejectModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`finding-closure-reject-modal-title-${action.id}`}
            className="w-full max-w-md space-y-3 rounded-2xl border bg-card p-5 shadow-xl"
          >
            <h2
              id={`finding-closure-reject-modal-title-${action.id}`}
              className="text-base font-bold"
            >
              {t("organization.findings.closure.rejectModalTitle")}
            </h2>
            <label
              htmlFor="finding-closure-reject-reason"
              className="text-xs font-medium text-muted-foreground"
            >
              {t("organization.findings.closure.rejectReasonLabel")}
            </label>
            <textarea
              id="finding-closure-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t(
                "organization.findings.closure.rejectReasonPlaceholder"
              )}
              className="min-h-24 w-full rounded-lg border bg-muted px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason("")
                }}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                {t("organization.findings.closure.cancel")}
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isRejecting}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-50"
              >
                {t("organization.findings.closure.rejectConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
