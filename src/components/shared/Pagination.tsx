import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { ReactNode } from "react"

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** "Showing 1-20 of 45" / "Page 2 of 5" -- left-aligned, page-specific copy
   * varies per caller so it's passed in rather than baked into this component. */
  label?: ReactNode
  prevAriaLabel: string
  nextAriaLabel: string
  className?: string
}

// Single pagination UI reused across AuditPage/TemplatesPage/InspectionTable,
// which previously each hand-rolled a visibly different implementation
// (numbered buttons vs a bare "page/total" pill, Button primitive vs raw
// <button>s, different active-state styling) for the same control.
const MAX_VISIBLE_PAGES = 5

function getPageNumbers(page: number, totalPages: number): number[] {
  let start = Math.max(1, page - Math.floor(MAX_VISIBLE_PAGES / 2))
  const end = Math.min(totalPages, start + MAX_VISIBLE_PAGES - 1)
  if (end - start + 1 < MAX_VISIBLE_PAGES) {
    start = Math.max(1, end - MAX_VISIBLE_PAGES + 1)
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  label,
  prevAriaLabel,
  nextAriaLabel,
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div
      className={`flex flex-col items-center justify-between gap-4 sm:flex-row ${className}`}
    >
      {label && <p className="text-sm text-muted-foreground">{label}</p>}

      {/* quality-bar-loop round 2 (Templates, mobile, round-1 finding):
          `size="icon-sm"` resolves to a 24x24px square (buttonVariants'
          `size-6`), well under the 44px touch-target guideline -- same
          bug class fixed on 9+ pages this session, but caught here at
          the SHARED component level rather than per-page, so this one
          fix corrects it for every one of this component's 9 consumer
          pages at once (AuditPage/TemplatesPage/InspectionTable/
          CompliancePage/AllFindingsPage/SitesEntities/RiskRegisterPage/
          AdminOrganization/AdminTransactions). Later promoted to the
          shared `size="icon-touch"` variant (44x44px) instead of an ad
          hoc `h-11 w-11` className override, once that variant existed. */}
      {/* flex-wrap: the 44px touch-target buttons above (7 of them at
          MAX_VISIBLE_PAGES=5) need ~332px, which can exceed the available
          width on a narrow phone inside a padded container -- wrapping
          keeps every button reachable instead of clipping/overflowing.
          Found by review (PR #673). */}
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Button
          variant="outline"
          size="icon-touch"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={prevAriaLabel}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {getPageNumbers(page, totalPages).map((pageNum) => (
          <Button
            key={pageNum}
            variant={pageNum === page ? "default" : "ghost"}
            size="icon-touch"
            onClick={() => onPageChange(pageNum)}
            aria-current={pageNum === page ? "page" : undefined}
          >
            {pageNum}
          </Button>
        ))}

        <Button
          variant="outline"
          size="icon-touch"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={nextAriaLabel}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
