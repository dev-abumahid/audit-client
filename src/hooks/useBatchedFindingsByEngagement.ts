import { useMemo } from "react"
import { useGetAllFindingsQuery } from "@/redux/apis/organization/findings.api"
import type { IAction } from "@/types/finding"

// Review-round finding on aexa-frontend#912: a single batched request
// (auditEngagementId joined across every completed engagement) shares the
// backend's MAX_LIMIT=100 cap across ALL of them combined, not per
// engagement -- on a page with e.g. 100 completed engagements (AuditPage's
// own isClientFiltered fetch already allows that many), their combined
// findings can easily exceed 100, silently zeroing out whichever
// engagements' rows the backend didn't get to first. Splitting into
// fixed-size chunks, each its own batched request, keeps the combined
// count per request bounded to CHUNK_SIZE engagements' worth of findings
// instead of up to 100 engagements' worth.
const CHUNK_SIZE = 20
// A hook can't call a variable number of other hooks (rules of hooks), so
// the chunk count is fixed rather than derived from engagementIds.length.
// MAX_CHUNKS * CHUNK_SIZE (100) matches AuditPage's own upstream cap on how
// many completed engagements can appear on one page today -- if that cap
// ever grows, MAX_CHUNKS must grow with it.
const MAX_CHUNKS = 5

const EMPTY_CHUNK: string[] = []

function chunk(ids: string[]): string[][] {
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + CHUNK_SIZE))
  }
  return chunks
}

function queryArgs(ids: string[]) {
  return {
    page: 1,
    limit: 100,
    searchTerm: "",
    siteId: "",
    auditEngagementId: ids.join(","),
  }
}

interface BatchedFindingsResult {
  findingsByEngagement: Map<string, IAction[]>
  isError: boolean
}

export function useBatchedFindingsByEngagement(
  engagementIds: string[]
): BatchedFindingsResult {
  const chunks = useMemo(() => chunk(engagementIds), [engagementIds])
  // Review-round finding on aexa-frontend#912: silently dropping the
  // overflow (chunks beyond the 5th) would under-report remediation status
  // for whichever engagements land there, with zero signal to a real user
  // -- a dev-only console.error alone isn't enough. `isOverflow` folds into
  // the returned `isError` below so it reaches the same page-level alert a
  // real fetch failure does, since both mean "some remediation status here
  // can't be trusted right now."
  const isOverflow = chunks.length > MAX_CHUNKS
  if (import.meta.env.DEV && isOverflow) {
    console.error(
      `useBatchedFindingsByEngagement: ${engagementIds.length} engagement ids exceed the ${MAX_CHUNKS * CHUNK_SIZE}-id cap this hook covers; ${chunks.length - MAX_CHUNKS} chunk(s) will be silently dropped. Raise MAX_CHUNKS.`
    )
  }
  const c0 = chunks[0] ?? EMPTY_CHUNK
  const c1 = chunks[1] ?? EMPTY_CHUNK
  const c2 = chunks[2] ?? EMPTY_CHUNK
  const c3 = chunks[3] ?? EMPTY_CHUNK
  const c4 = chunks[4] ?? EMPTY_CHUNK

  const q0 = useGetAllFindingsQuery(queryArgs(c0), { skip: c0.length === 0 })
  const q1 = useGetAllFindingsQuery(queryArgs(c1), { skip: c1.length === 0 })
  const q2 = useGetAllFindingsQuery(queryArgs(c2), { skip: c2.length === 0 })
  const q3 = useGetAllFindingsQuery(queryArgs(c3), { skip: c3.length === 0 })
  const q4 = useGetAllFindingsQuery(queryArgs(c4), { skip: c4.length === 0 })

  return useMemo(() => {
    const findingsByEngagement = new Map<string, IAction[]>()
    let isError = false
    for (const result of [q0, q1, q2, q3, q4]) {
      if (result.isError) isError = true
      for (const finding of result.data?.data ?? []) {
        if (!finding.auditEngagementId) continue
        const existing = findingsByEngagement.get(finding.auditEngagementId)
        if (existing) {
          existing.push(finding)
        } else {
          findingsByEngagement.set(finding.auditEngagementId, [finding])
        }
      }
    }
    return { findingsByEngagement, isError: isError || isOverflow }
  }, [q0, q1, q2, q3, q4, isOverflow])
}
