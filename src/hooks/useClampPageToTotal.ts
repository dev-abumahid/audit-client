import { useEffect } from "react"

// aexa-frontend#265: the delete-path counterpart to #234/#243. Those fixed
// page state going out-of-range when a FILTER change shrinks totalPages
// (the caller proactively resets to page 1 on filter change). Deleting the
// last item on the last page shrinks totalPages the same way, but no filter
// changed, so none of that proactive reset logic runs -- the user is left
// stranded on a page beyond the new totalPages, seeing an empty list with
// pagination hidden (every one of these list pages gates its pager on
// totalPages > 1).
//
// This hook is a safety net rather than a proactive reset: it only reacts
// after totalPages has actually shrunk below the current page, and it
// intentionally does nothing when totalPages is 0 or otherwise not a valid
// positive number -- several call sites derive totalPages from data that is
// still `undefined` while a query is loading/refetching (e.g. RTK Query
// returns `data: undefined` for an as-yet-uncached arg combination), and a
// naive "page > totalPages" check would misfire on that transient state and
// yank the user back to page 1 mid-navigation. Guarding on totalPages > 0
// means the effect only ever acts once real, loaded pagination data confirms
// the current page is actually out of range.
export function useClampPageToTotal(
  page: number,
  totalPages: number,
  setPage: (page: number) => void
) {
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(Math.max(1, totalPages))
    }
  }, [page, totalPages, setPage])
}
