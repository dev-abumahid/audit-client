import type { LinkedRisk } from "@/redux/apis/organization/audit.api"
import { riskCategoryLabel } from "@/utils/riskConfig"
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
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

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

  const closeDropdown = () => {
    setOpen(false)
    setActiveIndex(-1)
    // Return focus to the trigger on close (Escape or an option pick) so a
    // keyboard user doesn't lose their place once the panel unmounts.
    triggerRef.current?.focus()
  }

  const focusOption = (index: number) => {
    setActiveIndex(index)
    optionRefs.current[index]?.focus()
  }

  // Search input: Escape closes the panel, ArrowDown/ArrowUp hand off focus
  // into the option list (from -1, so ArrowDown lands on the first option).
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filtered.length === 0 && e.key !== "Escape") return
    switch (e.key) {
      case "Escape":
        e.preventDefault()
        closeDropdown()
        break
      case "ArrowDown":
        e.preventDefault()
        focusOption(0)
        break
      case "ArrowUp":
        e.preventDefault()
        focusOption(filtered.length - 1)
        break
      default:
        break
    }
  }

  // Options: Escape closes, ArrowDown/ArrowUp move between options (wrapping
  // back into the search box past either end), Home/End jump to the first/
  // last option -- the ARIA APG listbox pattern this control's
  // aria-haspopup="listbox" already implies.
  const handleOptionKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault()
        closeDropdown()
        break
      case "ArrowDown":
        e.preventDefault()
        if (index + 1 < filtered.length) focusOption(index + 1)
        break
      case "ArrowUp":
        e.preventDefault()
        if (index > 0) {
          focusOption(index - 1)
        } else {
          searchInputRef.current?.focus()
        }
        break
      case "Home":
        e.preventDefault()
        focusOption(0)
        break
      case "End":
        e.preventDefault()
        focusOption(filtered.length - 1)
        break
      default:
        break
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
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o)
          setActiveIndex(-1)
        }}
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
              ref={searchInputRef}
              autoFocus
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value)
                setActiveIndex(-1)
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={t("organization.audit.riskSelect.searchPlaceholder")}
              className="h-8 w-full rounded-md border border-input bg-background pr-2 pl-8 text-xs"
            />
          </div>
          <div
            role="listbox"
            aria-multiselectable="true"
            aria-label={t("organization.audit.riskSelect.selectPlaceholder")}
            className="max-h-52 overflow-y-auto py-1"
          >
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
              filtered.map((risk, index) => {
                const checked = selectedSet.has(risk.id)
                return (
                  <button
                    ref={(el) => {
                      optionRefs.current[index] = el
                    }}
                    type="button"
                    key={risk.id}
                    role="option"
                    aria-selected={checked}
                    tabIndex={activeIndex === index ? 0 : -1}
                    onClick={() => toggle(risk.id)}
                    onKeyDown={(e) => handleOptionKeyDown(e, index)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted focus:bg-muted focus:outline-none"
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
                      {riskCategoryLabel(t, risk.category)}
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
