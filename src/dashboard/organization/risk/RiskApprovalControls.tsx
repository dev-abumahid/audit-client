import { useMyOrgRole } from "@/hooks/useMyOrgRole"
import { useGetMeQuery } from "@/redux/apis/auth.api"
import {
  useApproveRiskMutation,
  useRejectRiskMutation,
  useSubmitRiskForApprovalMutation,
} from "@/redux/apis/organization/riskApproval.api"
import type { Risk, RiskApprovalDisplayState } from "@/types/organization"
import { Check, Send, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

// Tailwind classes + i18n label key per display state. Kept as one map so the
// badge stays a pure function of approvalStatus.
const BADGE_STYLES: Record<
  RiskApprovalDisplayState,
  { className: string; labelKey: string }
> = {
  NOT_SUBMITTED: {
    className: "bg-muted text-muted-foreground",
    labelKey: "organization.riskRegister.approval.badgeNotSubmitted",
  },
  PENDING_APPROVAL: {
    className: "bg-yellow-500/15 text-yellow-600",
    labelKey: "organization.riskRegister.approval.badgePending",
  },
  APPROVED: {
    className: "bg-green-500/15 text-green-600",
    labelKey: "organization.riskRegister.approval.badgeApproved",
  },
  REJECTED: {
    className: "bg-destructive/15 text-destructive",
    labelKey: "organization.riskRegister.approval.badgeRejected",
  },
}

interface Props {
  risk: Risk
}

/**
 * Per-risk approval badge + role-gated maker-checker actions (aexa-frontend#95):
 * a "Submit for Approval" action for Lead Auditors/Admins on a not-yet-approved
 * risk, and Approve/Reject actions for Admins on a pending one. Role gating is a
 * UX convenience; every action is re-checked server-side.
 */
export default function RiskApprovalControls({ risk }: Props) {
  const { t } = useTranslation()
  const role = useMyOrgRole()
  const { data: me, isLoading: isMeLoading } = useGetMeQuery()

  const [submitForApproval, { isLoading: isSubmitting }] =
    useSubmitRiskForApprovalMutation()
  const [approveRisk, { isLoading: isApproving }] = useApproveRiskMutation()
  const [rejectRisk, { isLoading: isRejecting }] = useRejectRiskMutation()

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  const status: RiskApprovalDisplayState = risk.approvalStatus ?? "NOT_SUBMITTED"
  const badge = BADGE_STYLES[status]

  const canSubmit = role === "ADMIN" || role === "LEAD_AUDITOR"
  const isAdmin = role === "ADMIN"
  const canResubmit = status === "NOT_SUBMITTED" || status === "REJECTED"
  const isPending = status === "PENDING_APPROVAL"
  // Server-side self-approval guard (risk.approval.service.ts) already blocks
  // this with a 403 -- without this check, an admin who submitted their own
  // risk would still see live Approve/Reject buttons that 403 on every click,
  // reading as a bug to exactly the user this control is meant to protect.
  // Both isSubmitter and canDecide default to false while `me` is still
  // loading, so this window shows neither the buttons (which could 403 for
  // the real submitter) nor the "awaiting another admin" message (which
  // would be a false claim for a real non-submitter reviewer) -- same
  // conservative-default pattern useMyOrgRole already uses for its own
  // loading state, just applied one level up since this component can't
  // tell submitter apart from reviewer until `me` resolves.
  const isSubmitter =
    !isMeLoading &&
    !!me?.data?.id &&
    me.data.id === risk.approval?.submittedById
  const canDecide = !isMeLoading && isAdmin && isPending && !isSubmitter
  const showAwaitingReviewer = !isMeLoading && isAdmin && isPending && isSubmitter

  const handleSubmit = async () => {
    try {
      const res = await submitForApproval(risk.id).unwrap()
      if (res.success) {
        toast.success(t("organization.riskRegister.approval.submitSuccess"))
      } else {
        toast.error(
          res.message || t("organization.riskRegister.approval.submitFailed")
        )
      }
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ||
          t("organization.riskRegister.approval.submitFailed")
      )
    }
  }

  const handleApprove = async () => {
    if (!risk.approval) return
    try {
      const res = await approveRisk(risk.approval.id).unwrap()
      if (res.success) {
        toast.success(t("organization.riskRegister.approval.approveSuccess"))
      } else {
        toast.error(
          res.message || t("organization.riskRegister.approval.approveFailed")
        )
      }
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ||
          t("organization.riskRegister.approval.approveFailed")
      )
    }
  }

  const handleReject = async () => {
    if (!risk.approval) return
    if (!rejectReason.trim()) {
      toast.error(t("organization.riskRegister.approval.rejectReasonRequired"))
      return
    }
    try {
      const res = await rejectRisk({
        approvalId: risk.approval.id,
        decisionNote: rejectReason.trim(),
      }).unwrap()
      if (res.success) {
        toast.success(t("organization.riskRegister.approval.rejectSuccess"))
        setShowRejectModal(false)
        setRejectReason("")
      } else {
        toast.error(
          res.message || t("organization.riskRegister.approval.rejectFailed")
        )
      }
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ||
          t("organization.riskRegister.approval.rejectFailed")
      )
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
      >
        {t(badge.labelKey)}
      </span>

      <div className="flex flex-wrap gap-1">
        {canSubmit && canResubmit && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1 rounded border border-input px-1.5 py-0.5 text-[10px] font-medium hover:bg-muted disabled:opacity-50"
          >
            <Send className="h-2.5 w-2.5" />
            {t("organization.riskRegister.approval.submit")}
          </button>
        )}

        {canDecide && (
          <>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isApproving}
              className="flex items-center gap-1 rounded border border-green-500/40 px-1.5 py-0.5 text-[10px] font-medium text-green-600 hover:bg-green-500/10 disabled:opacity-50"
            >
              <Check className="h-2.5 w-2.5" />
              {t("organization.riskRegister.approval.approve")}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              disabled={isRejecting}
              className="flex items-center gap-1 rounded border border-destructive/40 px-1.5 py-0.5 text-[10px] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <X className="h-2.5 w-2.5" />
              {t("organization.riskRegister.approval.reject")}
            </button>
          </>
        )}
      </div>

      {showAwaitingReviewer && (
        <p className="max-w-[220px] text-[10px] text-muted-foreground italic">
          {t("organization.riskRegister.approval.awaitingOtherReviewer")}
        </p>
      )}

      {status === "REJECTED" && risk.approval?.decisionNote && (
        <p className="max-w-[220px] text-[10px] text-destructive">
          {t("organization.riskRegister.approval.rejectionReason", {
            reason: risk.approval.decisionNote,
          })}
        </p>
      )}

      {(status === "APPROVED" || status === "REJECTED") &&
        risk.approval?.decidedAt && (
          <p className="text-[10px] text-muted-foreground">
            {t("organization.riskRegister.approval.decidedOn", {
              date: new Date(risk.approval.decidedAt).toLocaleDateString(),
            })}
          </p>
        )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-3 rounded-2xl border bg-card p-5 shadow-xl">
            <h2 className="text-base font-bold">
              {t("organization.riskRegister.approval.rejectModalTitle")}
            </h2>
            <label className="text-xs font-medium text-muted-foreground">
              {t("organization.riskRegister.approval.rejectReasonLabel")}
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t(
                "organization.riskRegister.approval.rejectReasonPlaceholder"
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
                {t("organization.riskRegister.approval.cancel")}
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isRejecting}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-50"
              >
                {t("organization.riskRegister.approval.rejectConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
