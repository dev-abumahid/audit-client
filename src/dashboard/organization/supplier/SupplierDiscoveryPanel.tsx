import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CircleCheck, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
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

  const acceptCandidate = async (candidate: SuggestedSupplier, index: number) => {
    if (!candidate.supplier_name) return
    // Defense in depth against the Add button's own disabled state being
    // stale for a moment (e.g. a race with the existingNames refetch) --
    // never actually re-create a supplier that already exists.
    if (existingNames.has(candidate.supplier_name.trim().toLowerCase())) {
      setStatus((prev) => new Map(prev).set(index, "added"))
      return
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
      toast.success(t("organization.suppliers.discovery.added"))
    } catch {
      toast.error(t("organization.suppliers.discovery.addFailed"))
    }
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
        <button
          type="button"
          onClick={runDiscovery}
          disabled={isLoading}
          aria-busy={isLoading}
          className="focus-ring flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {t("organization.suppliers.discovery.checkButton")}
        </button>
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
          ))}
      </div>
    </div>
  )
}
