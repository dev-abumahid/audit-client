import { DUMMY_SITES } from "@/data/site"
import type { Site } from "@/types/organization"
import { Building, ChevronDown } from "lucide-react"
import { useState } from "react"

interface SiteFilterProps {
  value: string | null // null = all/group, site id otherwise
  onChange: (siteId: string | null) => void
  className?: string
}

export default function SiteFilter({
  value,
  onChange,
  className = "",
}: SiteFilterProps) {
  const [sites] = useState<Site[]>(DUMMY_SITES)

  if (sites.length === 0) return null

  return (
    <div className={`relative ${className}`}>
      <Building className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <select
        value={value || "__group__"}
        onChange={(e) =>
          onChange(e.target.value === "__group__" ? null : e.target.value)
        }
        className="h-9 w-full appearance-none rounded-lg border border-input bg-card pr-8 pl-9 text-xs font-medium text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
      >
        <option value="__group__">🏢 Vue Groupe (tous sites)</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            📍 {s.name}
            {s.country ? ` (${s.country})` : ""}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
