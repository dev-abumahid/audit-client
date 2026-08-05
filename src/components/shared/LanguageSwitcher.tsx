import { useTranslation } from "react-i18next"

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <div className="flex items-center gap-1 p-3">
      <div className="flex overflow-hidden rounded-md border border-sidebar-border">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`focus-ring px-4 py-3 text-[10px] font-semibold transition-colors ${
              i18n.language?.startsWith(lang.code)
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  )
}
