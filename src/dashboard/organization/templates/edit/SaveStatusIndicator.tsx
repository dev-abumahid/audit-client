import { severityTextClasses } from "@/utils/severityStyles"
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react"
import { useTranslation } from "react-i18next"

interface SaveStatusIndicatorProps {
  status: "idle" | "saving" | "saved" | "error"
  hasChanges: boolean
}

export function SaveStatusIndicator({
  status,
  hasChanges,
}: SaveStatusIndicatorProps) {
  const { t } = useTranslation()
  const getStatusConfig = () => {
    switch (status) {
      case "saving":
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          text: t("organization.templates.builder.savingChanges"),
          className: severityTextClasses("info"),
        }
      case "saved":
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          text: t("organization.templates.builder.allChangesSaved"),
          className: severityTextClasses("low"),
        }
      case "error":
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: t("organization.templates.builder.autoSaveFailed"),
          className: severityTextClasses("critical"),
        }
      default:
        return {
          icon: hasChanges ? (
            <Save className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4 opacity-50" />
          ),
          text: hasChanges
            ? t("organization.templates.builder.unsavedChanges")
            : t("organization.templates.builder.allChangesSaved"),
          className: hasChanges
            ? severityTextClasses("medium")
            : "text-muted-foreground",
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 shadow-sm backdrop-blur-sm">
      {config.icon}
      <span className="text-sm font-medium">{config.text}</span>
    </div>
  )
}
