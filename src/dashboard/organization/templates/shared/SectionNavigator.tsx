import { useTranslation } from "react-i18next"

interface SectionNavigatorProps {
  sections: { id: string; title: string }[]
  activeIndex: number
  onSelect: (index: number) => void
}

// Sticky jump-to-section sidebar, matching the pattern already used in
// InspectionReport.tsx's report view — extracted here so the template
// create/edit pages (which render every section in one continuous scroll,
// unlike RunInspection.tsx's one-page-at-a-time navigator) get the same
// "jump to a section" affordance instead of a long scroll.
export default function SectionNavigator({
  sections,
  activeIndex,
  onSelect,
}: SectionNavigatorProps) {
  const { t } = useTranslation()

  if (sections.length === 0) return null

  return (
    <aside className="sticky top-24 hidden h-fit max-h-[calc(100vh-6rem)] w-64 shrink-0 flex-col overflow-y-auto lg:flex">
      <p className="mb-2 px-3 text-xs font-bold tracking-widest text-muted-foreground uppercase">
        {t("organization.templates.shared.sectionsLabel")}
      </p>
      <nav
        className="space-y-1"
        aria-label={t("organization.templates.shared.sectionsLabel")}
      >
        {sections.map((section, idx) => {
          const isActive = activeIndex === idx
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(idx)}
              aria-current={isActive ? "true" : undefined}
              className={`focus-ring flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-card hover:text-foreground hover:shadow-sm"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isActive
                    ? "bg-white/25 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {idx + 1}
              </span>
              <span className="line-clamp-2 flex-1 text-xs leading-tight font-medium">
                {section.title ||
                  t("organization.templates.shared.sectionFallback", {
                    number: idx + 1,
                  })}
              </span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
