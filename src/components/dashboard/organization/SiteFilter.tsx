import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import { Building2, MapPin } from "lucide-react"
import { useTranslation } from "react-i18next"

interface SiteFilterProps {
  value: string | null // null = all/group, site id otherwise
  onChange: (siteId: string | null) => void
  className?: string
  // PREVIEW-PROTO addition: when a caller already has the site list (e.g.
  // RiskMatrixView, which fetches it for its own RiskCard site-name
  // lookups), passing it here skips this component's own
  // useGetAllSitesQuery entirely via RTK Query's `skip` option -- avoiding
  // a redundant second fetch of the same data in real usage, and, as a
  // side effect, letting a caller render this component with injected
  // mock data and no live API call at all (the preview use case). Omitting
  // it preserves the original self-fetching behavior byte for byte.
  sitesOverride?: { id: string; name: string; country?: string | null }[]
}

// Radix Select requires a non-empty string value for every item -- "" would
// collide with its own "no selection" sentinel -- so null (the "all sites,
// grouped" state) is represented as this sentinel string at the Select layer
// and translated back to null in onValueChange.
const GROUP_VALUE = "__group__"

export default function SiteFilter({
  value,
  onChange,
  className = "",
  sitesOverride,
}: SiteFilterProps) {
  const { t } = useTranslation()
  const { data, isLoading: isQueryLoading } = useGetAllSitesQuery(
    {
      page: 1,
      limit: 100,
      searchTerm: "",
    },
    { skip: sitesOverride !== undefined }
  )
  const isLoading = sitesOverride !== undefined ? false : isQueryLoading
  const sites: { id: string; name: string; country?: string | null }[] =
    sitesOverride ?? data?.data ?? []

  // Only hide once we actually know there are no sites — hiding during the
  // loading window too (as a naive `sites.length === 0` check would, since
  // `sites` is `[]` before the query resolves) makes the filter pop in and
  // shift the toolbar layout it sits in on every page load. Found by
  // independent review.
  if (!isLoading && sites.length === 0) return null

  return (
    <Select
      value={value || GROUP_VALUE}
      onValueChange={(v) => onChange(v === GROUP_VALUE ? null : v)}
      disabled={isLoading}
    >
      <SelectTrigger className={`h-9 w-full text-xs font-medium ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={GROUP_VALUE}>
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          {t("organization.siteFilter.groupView")}
        </SelectItem>
        {sites.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            {s.name}
            {s.country ? ` (${s.country})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
