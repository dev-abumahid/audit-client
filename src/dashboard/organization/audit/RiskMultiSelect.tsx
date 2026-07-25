import type { LinkedRisk } from "@/redux/apis/organization/audit.api"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

// aexa-frontend#165: a self-contained searchable checkbox dropdown for picking
// the real Risk records an audit engagement covers, replacing the old
// comma-separated free-text input. No multi-select component existed in the
// codebase (only ui/dropdown-menu, which is a single-action menu), so this is a
// small purpose-built control rather than a new dependency — a filter box plus
// a checkbox list, with selected risks shown as removable chips.
export interface RiskOption {
  id: string
  name: string
  category: string
}

interface RiskMultiSelectProps {
  options: RiskOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  isLoading?: boolean
}

export default function RiskMultiSelect({
  options,
  selectedIds,
  onChange,
  isLoading = false,
}: RiskMultiSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  // Close the dropdown when clicking outside it.
  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedOptions = useMemo(
    () => options.filter((o) => selectedSet.has(o.id)),
    [options, selectedSet]
  )

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) || o.category.toLowerCase().includes(q)
    )
  }, [options, filter])

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((sid) => sid !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chips */}
      {selectedOptions.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {selectedOptions.map((risk) => (
            <span
              key={risk.id}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
            >
              {risk.name}
              <button
                type="button"
                aria-label={t("organization.audit.riskSelect.removeRisk", {
                  name: risk.name,
                })}
                onClick={() => toggle(risk.id)}
                className="rounded-full hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-muted/40"
      >
        <span>
          {selectedOptions.length > 0
            ? t("organization.audit.riskSelect.linked", {
                count: selectedOptions.length,
              })
            : t("organization.audit.riskSelect.selectPlaceholder")}
        </span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
          <div className="relative border-b border-border p-2">
            <Search className="absolute top-1/2 left-4 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("organization.audit.riskSelect.searchPlaceholder")}
              className="h-8 w-full rounded-md border border-input bg-background pr-2 pl-8 text-xs"
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {isLoading && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {t("organization.audit.riskSelect.loading")}
              </p>
            )}
            {!isLoading && filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {options.length === 0
                  ? t("organization.audit.riskSelect.noneYet")
                  : t("organization.audit.riskSelect.noMatch")}
              </p>
            )}
            {!isLoading &&
              filtered.map((risk) => {
                const checked = selectedSet.has(risk.id)
                return (
                  <button
                    type="button"
                    key={risk.id}
                    onClick={() => toggle(risk.id)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 text-foreground">{risk.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {risk.category}
                    </span>
                  </button>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}

// Convenience re-export so callers can accept the API's LinkedRisk shape too.
export type { LinkedRisk }
