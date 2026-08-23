import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CircleCheck, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isHttpUrl } from "@/utils/isHttpUrl"
import type { SuggestedSupplier } from "@/redux/apis/organization/supplier.api"
import {
  useCreateNewSupplierMutation,
  useDiscoverSuppliersMutation,
  useGetAllSuppliersQuery,
} from "@/redux/apis/organization/supplier.api"

interface SupplierDiscoveryPanelProps {
  canWrite: boolean
}

// AI-discovery review flow for suppliers -- same "review and selectively
// import" shape as RegulatoryCoverageSuggestions.tsx, but a candidate here
// is a genuinely standalone resource (not a pre-fill for a separate form),
// so "Add" persists it directly via createNewSupplier with
// ai_generated: true and source_info carrying the grounded source_url
// (aexa-ai#227's "no guesses" verification -- every source_url that
// reaches this component was already independently confirmed server-side
// against real search-result data, never trusted from the model alone).
//
// Session-only status (index-keyed, mutually exclusive "added"/"dismissed"
// per candidate), deliberately not persisted -- same rationale as
// RegulatoryCoverageSuggestions: a stale judgment surviving across
// sessions as a company's real suppliers change would be worse than
// re-showing the suggestion next time.
export default function SupplierDiscoveryPanel({
  canWrite,
}: SupplierDiscoveryPanelProps) {
  const { t } = useTranslation()
  const [candidates, setCandidates] = useState<SuggestedSupplier[] | null>(null)
  const [status, setStatus] = useState<Map<number, "dismissed" | "added">>(
    () => new Map()
  )
  const [discoverSuppliers, { isLoading }] = useDiscoverSuppliersMutation()
  const [createNewSupplier, { isLoading: isAdding }] =
    useCreateNewSupplierMutation()

  // "Bulk-accept reviewed candidates" (quality-bar-loop feature scoping,
  // 2026-08-22): a checkbox per candidate, independent of the per-row
  // Add/Dismiss buttons, lets the user review several suggestions and
  // accept them all in one action instead of clicking Add on each. No
  // scope/domain input -- just the candidates already surfaced by the last
  // discovery run.
  const [selectedForBulk, setSelectedForBulk] = useState<Set<number>>(
    () => new Set()
  )
  const [isBulkAccepting, setIsBulkAccepting] = useState(false)
  const toggleBulkSelect = (index: number) => {
    setSelectedForBulk((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  // No dedup between this panel's AI-accept flow and the manual-add flow
  // (or a candidate re-offered across page visits) meant "Add" could
  // silently create a second row for a supplier that already exists.
  // Cross-checking against the org's real supplier list (not just this
  // session's local `status` map) closes that gap -- and since
  // createNewSupplier invalidates the same SUPPLIER cache tag this query
  // provides, a candidate flips to "already added" the moment it's
  // accepted, without a page reload. limit: 100 matches aexa-server's
  // paginationHelper MAX_LIMIT ceiling (issue #117) -- an org with more
  // suppliers than that could still see a rare missed duplicate; a full
  // org-wide dedup would need its own backend endpoint, out of scope here.
  const { data: existingSuppliersData, error: existingSuppliersError } =
    useGetAllSuppliersQuery({
      page: 1,
      limit: 100,
      searchTerm: "",
    })
  if (existingSuppliersError) {
    // Fails toward "dedup silently doesn't happen" rather than crashing the
    // whole panel -- but that degraded state is otherwise invisible, so at
    // least surface it for anyone debugging a real duplicate report.
    console.warn(
      "Supplier dedup check failed to load the existing supplier list -- AI-discovered candidates won't be checked against real duplicates this render.",
      existingSuppliersError
    )
  }
  const existingNames = new Set(
    (existingSuppliersData?.data ?? []).map((s) => s.name.trim().toLowerCase())
  )

  // Dismiss's own (removed) button is the focused element right before this
  // fires -- without moving focus, it drops to <body>. Same fix as
  // RegulatoryCoverageSuggestions.tsx's headingRef.
  const headingRef = useRef<HTMLHeadingElement>(null)

  const runDiscovery = async () => {
    setCandidates(null)
    setStatus(new Map())
    setSelectedForBulk(new Set())
    try {
      const res = await discoverSuppliers().unwrap()
      setCandidates(res.data.suppliers_information)
    } catch (err: unknown) {
      const isTimeout =
        typeof err === "object" && err !== null && "status" in err && err.status === 504
      const isMissingCompanyName =
        typeof err === "object" && err !== null && "status" in err && err.status === 400
      toast.error(
        t(
          isTimeout
            ? "organization.suppliers.discovery.timedOut"
            : isMissingCompanyName
              ? "organization.suppliers.discovery.missingCompanyName"
              : "organization.suppliers.discovery.failed"
        )
      )
    }
  }

  // silent skips the per-candidate toast -- used by acceptSelected below,
  // which shows one summary toast instead of firing N of them at once.
  // Returns whether the candidate ended up added -- acceptSelected's
  // success count reads this return value rather than the `status` state,
  // since setStatus's update wouldn't be visible yet on the very next loop
  // iteration (React batches the re-render, it doesn't apply synchronously).
  const acceptCandidate = async (
    candidate: SuggestedSupplier,
    index: number,
    silent = false
  ): Promise<boolean> => {
    if (!candidate.supplier_name) return false
    // Defense in depth against the Add button's own disabled state being
    // stale for a moment (e.g. a race with the existingNames refetch) --
    // never actually re-create a supplier that already exists.
    if (existingNames.has(candidate.supplier_name.trim().toLowerCase())) {
      setStatus((prev) => new Map(prev).set(index, "added"))
      return true
    }
    try {
      await createNewSupplier({
        name: candidate.supplier_name,
        country: candidate.supplier_country ?? undefined,
        notes: candidate.relationship ?? undefined,
        ai_generated: true,
        source_info: candidate.source_url ?? undefined,
      }).unwrap()
      setStatus((prev) => new Map(prev).set(index, "added"))
      if (!silent) toast.success(t("organization.suppliers.discovery.added"))
      return true
    } catch (err: unknown) {
      // A race the client-side existingNames check above didn't catch (the
      // dedup query hadn't refetched yet, a second tab, etc.) still hits
      // the backend's own uniqueness constraint -- treat that the same as
      // an already-known duplicate (mark added, so Add doesn't just 409
      // again on retry) rather than a generic failure.
      const isDuplicate =
        typeof err === "object" && err !== null && "status" in err && err.status === 409
      if (isDuplicate) {
        setStatus((prev) => new Map(prev).set(index, "added"))
        if (!silent) toast.error(t("organization.suppliers.discovery.addDuplicate"))
        return true
      }
      if (!silent) toast.error(t("organization.suppliers.discovery.addFailed"))
      return false
    }
  }

  const acceptSelected = async () => {
    if (selectedForBulk.size === 0) return
    setIsBulkAccepting(true)
    // Sequential, not Promise.all -- these all invalidate the same
    // dedup query (existingNames) and share a per-org unique-name
    // constraint server-side, so running them concurrently would let two
    // candidates with colliding names both pass the stale client-side
    // dedup check before either's create had landed.
    let succeeded = 0
    for (const index of selectedForBulk) {
      const entry = usableCandidates.find((c) => c.index === index)
      if (!entry) continue
      if (await acceptCandidate(entry.candidate, index, true)) succeeded += 1
    }
    setIsBulkAccepting(false)
    setSelectedForBulk(new Set())
    toast.success(
      t("organization.suppliers.discovery.bulkAcceptSuccess", { count: succeeded })
    )
  }

  // Candidates with no supplier_name are never shown as actionable rows --
  // filtering them out here first means "usable" reflects what the user
  // could ever have seen, so the empty-state copy below can tell "you
  // dismissed everything" apart from "nothing usable ever came back."
  const usableCandidates = (candidates ?? [])
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.supplier_name)
  const visibleCandidates = usableCandidates.filter(
    ({ index }) => status.get(index) !== "dismissed"
  )

  if (!canWrite) return null

  return (
    <div className="animate-slide-up rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="focus-ring rounded text-sm font-semibold text-foreground"
          >
            {t("organization.suppliers.discovery.title")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("organization.suppliers.discovery.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          size="touch"
          onClick={runDiscovery}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          {t("organization.suppliers.discovery.checkButton")}
        </Button>
      </div>

      <div className="mt-3" aria-live="polite">
        {isLoading && (
          <>
            <span className="sr-only">
              {t("organization.suppliers.discovery.checking")}
            </span>
            <ul className="flex flex-col gap-2" aria-hidden="true">
              {[0, 1].map((i) => (
                <li
                  key={i}
                  className="animate-pulse rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="h-3 w-1/3 rounded bg-muted" />
                  <div className="mt-2 h-2 w-2/3 rounded bg-muted" />
                </li>
              ))}
            </ul>
          </>
        )}
        {!isLoading &&
          candidates !== null &&
          (usableCandidates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("organization.suppliers.discovery.noneFound")}
            </p>
          ) : visibleCandidates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("organization.suppliers.discovery.allDismissed")}
            </p>
          ) : (
            <>
              {selectedForBulk.size > 0 && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-input bg-muted/30 px-3 py-2 text-xs"
                >
                  <span className="font-medium">
                    {t("organization.suppliers.discovery.selectedCount", {
                      count: selectedForBulk.size,
                    })}
                  </span>
                  <Button
                    type="button"
                    size="touch"
                    onClick={acceptSelected}
                    disabled={isBulkAccepting}
                    aria-busy={isBulkAccepting}
                  >
                    {isBulkAccepting ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <CircleCheck aria-hidden="true" />
                    )}
                    {t("organization.suppliers.discovery.bulkAcceptLabel", {
                      count: selectedForBulk.size,
                    })}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="touch"
                    onClick={() => setSelectedForBulk(new Set())}
                  >
                    {t("organization.suppliers.discovery.clearSelection")}
                  </Button>
                </div>
              )}
              <ul className="flex flex-col gap-2">
                {visibleCandidates.map(({ candidate, index }) => {
                const isAdded =
                  status.get(index) === "added" ||
                  (!!candidate.supplier_name &&
                    existingNames.has(candidate.supplier_name.trim().toLowerCase()))
                return (
                  <li
                    key={index}
                    className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        {!isAdded && (
                          <label className="relative -m-2 mt-0.5 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              checked={selectedForBulk.has(index)}
                              onChange={() => toggleBulkSelect(index)}
                              aria-label={t(
                                "organization.suppliers.discovery.selectFor",
                                { name: candidate.supplier_name }
                              )}
                              className="h-4 w-4"
                            />
                          </label>
                        )}
                        <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground">
                            {candidate.supplier_name}
                          </span>
                          {candidate.supplier_country && (
                            <Badge variant="secondary" size="xs" bordered>
                              {candidate.supplier_country}
                            </Badge>
                          )}
                        </div>
                        {candidate.relationship && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {candidate.relationship}
                          </p>
                        )}
                        {isHttpUrl(candidate.source_url) && (
                          <a
                            href={candidate.source_url ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="focus-ring mt-1 inline-block text-[11px] text-primary hover:underline"
                          >
                            {t("organization.suppliers.discovery.source")}
                            <span className="sr-only">
                              {" "}
                              {t("organization.suppliers.discovery.opensInNewTab")}
                            </span>
                          </a>
                        )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => acceptCandidate(candidate, index)}
                          disabled={isAdded || isAdding}
                          aria-label={t(
                            isAdded
                              ? "organization.suppliers.discovery.addedFor"
                              : "organization.suppliers.discovery.addFor",
                            { name: candidate.supplier_name }
                          )}
                          className="focus-ring flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:hover:bg-transparent"
                        >
                          {isAdded && (
                            <CircleCheck className="h-3 w-3" aria-hidden="true" />
                          )}
                          {t(
                            isAdded
                              ? "organization.suppliers.discovery.addedLabel"
                              : "organization.suppliers.discovery.addLabel"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStatus((prev) => new Map(prev).set(index, "dismissed"))
                            setSelectedForBulk((prev) => {
                              if (!prev.has(index)) return prev
                              const next = new Set(prev)
                              next.delete(index)
                              return next
                            })
                            headingRef.current?.focus()
                          }}
                          aria-label={t(
                            "organization.suppliers.discovery.dismissFor",
                            { name: candidate.supplier_name }
                          )}
                          className="focus-ring rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                        >
                          {t("organization.suppliers.discovery.dismiss")}
                        </button>
                      </div>
                    </div>
                  </li>
                )
                })}
              </ul>
            </>
          ))}
      </div>
    </div>
  )
}
