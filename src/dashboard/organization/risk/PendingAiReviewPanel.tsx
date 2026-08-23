// docs/design-docs/ai-risk-review-approval-workflow.md -- AI-generated
// risks land as review_status=PENDING_REVIEW, not straight into the
// confirmed register. This panel is where they get approved or dismissed,
// individually or in bulk. Self-contained (own query, own selection state)
// rather than reusing useRiskBulkActions, since that hook's mutations
// (delete/status-update) and reset-on-filter-change semantics don't match
// approve/dismiss's much simpler, filter-independent shape.
import CitationConfidenceBadge from "@/components/dashboard/organization/CitationConfidenceBadge"
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import {
  useApproveRiskMutation,
  useBulkApproveRisksMutation,
  useBulkDismissRisksMutation,
  useDismissRiskMutation,
  useGetAllRisksQuery,
} from "@/redux/apis/organization/risk.api"
import { Bot, Check, ChevronDown, ChevronUp, Loader2, X } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

interface PendingAiReviewPanelProps {
  canWrite: boolean
}

// design-docs/site-ai-risk-register-generation.md §3 -- "the single most
// important trust signal" per that doc's own review notes. Surfaces which
// pending suggestions to scrutinize closest before approving. The badge
// itself is CitationConfidenceBadge (shared with RiskDetails.tsx/
// RiskRegisterPage.tsx as of the round-1 cross-view-integration fix -- this
// signal used to exist only here and vanish the moment a risk was approved).
const CONFIDENCE_RANK: Record<string, number> = {
  none: 0,
  ai_estimate: 1,
  curated_verified: 2,
}

export default function PendingAiReviewPanel({
  canWrite,
}: PendingAiReviewPanelProps) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDismissed, setShowDismissed] = useState(false)
  // Round-2 quality-bar-loop finding (industry-standards, "the crux of this
  // axis"): a reviewer previously had no way to see WHY the AI proposed a
  // risk before approving/dismissing it -- description/regulatory_citation_
  // note already exist on every Risk but were never rendered here. A Set
  // (not a single id) so more than one row can stay expanded while
  // comparing several pending suggestions.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  // Round-3 quality-bar-loop finding (industry-standards + UX, 3 judges):
  // bulk approve/dismiss fired their mutation on click with zero
  // confirmation -- irreversible for a whole selection at once. Gate both
  // behind a shared confirm dialog rather than firing directly.
  const [pendingBulkAction, setPendingBulkAction] = useState<
    "approve" | "dismiss" | null
  >(null)
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // limit:100 -- same "approximate above N, review queues don't
  // realistically accumulate hundreds of untouched rows" precedent as
  // SitesEntities.tsx's dashboard tiles.
  const { data: pendingData, isLoading: pendingLoading } = useGetAllRisksQuery({
    page: 1,
    limit: 100,
    searchTerm: "",
    siteId: "",
    category: "",
    reviewStatus: "PENDING_REVIEW",
  })
  const { data: dismissedData, isLoading: dismissedLoading } =
    useGetAllRisksQuery(
      {
        page: 1,
        limit: 100,
        searchTerm: "",
        siteId: "",
        category: "",
        reviewStatus: "DISMISSED",
      },
      { skip: !showDismissed }
    )

  const pendingRisks = useMemo(() => {
    const rows = pendingData?.data ?? []
    // Lowest-confidence first -- the rows most likely to need a close look
    // surface at the top instead of being buried under a long list.
    return [...rows].sort(
      (a, b) =>
        (CONFIDENCE_RANK[a.citation_confidence ?? "none"] ?? 0) -
        (CONFIDENCE_RANK[b.citation_confidence ?? "none"] ?? 0)
    )
  }, [pendingData])
  const dismissedRisks = dismissedData?.data ?? []

  // Review finding (PR #1066): the empty-state early return below unmounts
  // the confirm dialog without ever calling setOpen(false) if the list
  // empties while it's still open -- resetting here (not just on confirm/
  // cancel) means a later non-empty render can't reopen it against a stale
  // selection. Adjusting state during render (React's documented pattern
  // for "reset when a value changes"), not in an effect, since an effect
  // body would call setState after commit and cause an extra render pass.
  const [prevPendingCount, setPrevPendingCount] = useState(
    pendingRisks.length
  )
  if (pendingRisks.length !== prevPendingCount) {
    setPrevPendingCount(pendingRisks.length)
    if (pendingRisks.length === 0) setPendingBulkAction(null)
  }

  const [approveRisk, { isLoading: isApproving }] = useApproveRiskMutation()
  const [dismissRisk, { isLoading: isDismissing }] = useDismissRiskMutation()
  const [bulkApproveRisks, { isLoading: isBulkApproving }] =
    useBulkApproveRisksMutation()
  const [bulkDismissRisks, { isLoading: isBulkDismissing }] =
    useBulkDismissRisksMutation()

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Every mutation shares one disabled gate across per-row AND bulk
  // buttons -- without this, a user could click a row's own Approve while
  // that same row is selected, then immediately click "Approve all",
  // firing two mutations for the same risk concurrently (round-1 review
  // finding).
  const anyReviewActionInFlight =
    isApproving || isDismissing || isBulkApproving || isBulkDismissing

  const extractErrorMessage = (err: unknown, fallback: string): string =>
    (err as { data?: { message?: string } })?.data?.message || fallback

  const handleApprove = async (id: string) => {
    try {
      await approveRisk(id).unwrap()
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch (err) {
      toast.error(
        extractErrorMessage(
          err,
          t("organization.riskRegister.pendingReview.approveFailed")
        )
      )
    }
  }

  const handleDismiss = async (id: string) => {
    try {
      const result = await dismissRisk(id).unwrap()
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      const refs = result.data?.referencedBy
      const referencedCount = refs
        ? refs.kris +
          refs.complianceObligations +
          refs.auditEngagements +
          refs.riskLinks
        : 0
      if (referencedCount > 0) {
        toast.warning(
          t("organization.riskRegister.pendingReview.dismissedButReferenced", {
            count: referencedCount,
          })
        )
      }
    } catch (err) {
      toast.error(
        extractErrorMessage(
          err,
          t("organization.riskRegister.pendingReview.dismissFailed")
        )
      )
    }
  }

  const handleBulkApprove = async () => {
    try {
      await bulkApproveRisks(Array.from(selectedIds)).unwrap()
      setSelectedIds(new Set())
      setPendingBulkAction(null)
    } catch (err) {
      toast.error(
        extractErrorMessage(
          err,
          t("organization.riskRegister.pendingReview.approveFailed")
        )
      )
    }
  }

  const handleBulkDismiss = async () => {
    try {
      await bulkDismissRisks(Array.from(selectedIds)).unwrap()
      setSelectedIds(new Set())
      setPendingBulkAction(null)
    } catch (err) {
      toast.error(
        extractErrorMessage(
          err,
          t("organization.riskRegister.pendingReview.dismissFailed")
        )
      )
    }
  }

  // Round-8 quality-bar-loop finding (code quality): the same
  // pendingBulkAction === "approve" ? ... : ... discriminant was repeated
  // 7 times across the DeleteAlertModal props below -- collapsing it into
  // one lookup means adding a new field only touches one place instead of
  // both branches of every ternary.
  const bulkActionConfig: Record<
    "approve" | "dismiss",
    {
      loading: boolean
      title: string
      description: string
      confirmLabel: string
      loadingLabel: string
      onConfirm: () => void
      variant: "default" | "destructive"
    }
  > = {
    approve: {
      loading: isBulkApproving,
      title: t("organization.riskRegister.pendingReview.confirmBulkApproveTitle"),
      description: t(
        "organization.riskRegister.pendingReview.confirmBulkApproveDescription",
        { count: selectedIds.size }
      ),
      confirmLabel: t("organization.riskRegister.pendingReview.approveAll"),
      loadingLabel: t("organization.riskRegister.pendingReview.approvingAll"),
      onConfirm: handleBulkApprove,
      variant: "default",
    },
    dismiss: {
      loading: isBulkDismissing,
      title: t("organization.riskRegister.pendingReview.confirmBulkDismissTitle"),
      description: t(
        "organization.riskRegister.pendingReview.confirmBulkDismissDescription",
        { count: selectedIds.size }
      ),
      confirmLabel: t("organization.riskRegister.pendingReview.dismissAll"),
      loadingLabel: t("organization.riskRegister.pendingReview.dismissingAll"),
      onConfirm: handleBulkDismiss,
      variant: "destructive",
    },
  }

  if (pendingLoading) return null
  if (pendingRisks.length === 0 && !showDismissed) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-2 text-xs text-muted-foreground">
        <span>{t("organization.riskRegister.pendingReview.empty")}</span>
        <button
          type="button"
          onClick={() => setShowDismissed(true)}
          aria-expanded={false}
          className="focus-ring flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted"
        >
          {t("organization.riskRegister.pendingReview.showDismissed")}
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div
      className="rounded-lg border border-amber-500/30 bg-amber-500/5"
      aria-live="polite"
    >
      {pendingRisks.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              <span className="text-sm font-semibold text-foreground">
                {t("organization.riskRegister.pendingReview.heading", {
                  count: pendingRisks.length,
                })}
              </span>
            </div>
            {canWrite && selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {t("organization.riskRegister.pendingReview.selectedCount", {
                    count: selectedIds.size,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingBulkAction("approve")}
                  disabled={anyReviewActionInFlight}
                  className="focus-ring flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isBulkApproving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  {t("organization.riskRegister.pendingReview.approveAll")}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingBulkAction("dismiss")}
                  disabled={anyReviewActionInFlight}
                  className="focus-ring flex items-center gap-1 rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {isBulkDismissing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                  {t("organization.riskRegister.pendingReview.dismissAll")}
                </button>
              </div>
            )}
          </div>
          <ul className="divide-y divide-amber-500/10">
            {pendingRisks.map((risk) => {
              const hasEvidence = Boolean(
                risk.description || risk.regulatory_citation_note
              )
              const isExpanded = expandedIds.has(risk.id)
              return (
                <li key={risk.id}>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    {canWrite && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(risk.id)}
                        onChange={() => toggleSelect(risk.id)}
                        aria-label={t(
                          "organization.riskRegister.pendingReview.selectRisk",
                          { name: risk.name }
                        )}
                        className="h-4 w-4 shrink-0 rounded border-input"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {hasEvidence ? (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(risk.id)}
                            aria-expanded={isExpanded}
                            className="focus-ring flex min-w-0 items-center gap-1 rounded text-left"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate text-sm font-medium text-foreground">
                              {risk.name}
                            </span>
                          </button>
                        ) : (
                          <span className="truncate text-sm font-medium text-foreground">
                            {risk.name}
                          </span>
                        )}
                        <CitationConfidenceBadge
                          confidence={risk.citation_confidence}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {risk.category}
                      </span>
                    </div>
                    {canWrite && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApprove(risk.id)}
                          disabled={anyReviewActionInFlight}
                          className="focus-ring flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {t("organization.riskRegister.pendingReview.approve")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismiss(risk.id)}
                          disabled={anyReviewActionInFlight}
                          className="focus-ring flex items-center gap-1 rounded-md border border-input bg-card px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          {t("organization.riskRegister.pendingReview.dismiss")}
                        </button>
                      </div>
                    )}
                  </div>
                  {hasEvidence && isExpanded && (
                    <div className="mx-4 mb-2.5 rounded-md border border-amber-500/20 bg-card px-3 py-2 text-xs text-muted-foreground">
                      {risk.description && <p>{risk.description}</p>}
                      {risk.regulatory_citation_note && (
                        <p className={risk.description ? "mt-1.5" : undefined}>
                          <span className="font-medium text-foreground">
                            {t(
                              "organization.riskRegister.pendingReview.regulatoryCitationNote"
                            )}
                            :{" "}
                          </span>
                          {risk.regulatory_citation_note}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
      <div className="px-4 py-2">
        <button
          type="button"
          onClick={() => setShowDismissed((prev) => !prev)}
          aria-expanded={showDismissed}
          className="focus-ring flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {showDismissed ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          {t("organization.riskRegister.pendingReview.showDismissed")}
        </button>
        {showDismissed && (
          <ul className="mt-2 space-y-1">
            {dismissedLoading && (
              <li className="text-xs text-muted-foreground">
                {t("organization.riskRegister.loading")}
              </li>
            )}
            {!dismissedLoading && dismissedRisks.length === 0 && (
              <li className="text-xs text-muted-foreground">
                {t("organization.riskRegister.pendingReview.noDismissed")}
              </li>
            )}
            {dismissedRisks.map((risk) => (
              <li
                key={risk.id}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <X className="h-3 w-3 shrink-0" />
                <span className="truncate line-through">{risk.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Review finding (PR #1070): falling back to {} while the dialog's
          ~100ms close animation still has it mounted snapped every prop to
          DeleteAlertModal's generic defaults (red icon, "Delete" copy) for
          that duration -- the old per-prop ternaries never had this gap,
          since any non-"approve" value (including null) fell through to the
          dismiss branch. Falling back to "dismiss" here restores that exact
          behavior instead of a bare empty object. */}
      <DeleteAlertModal
        open={pendingBulkAction !== null}
        setOpen={(value) => {
          if (!value) setPendingBulkAction(null)
        }}
        {...bulkActionConfig[pendingBulkAction ?? "dismiss"]}
      />
    </div>
  )
}
