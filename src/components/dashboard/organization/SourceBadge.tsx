import { Bot, Pencil, User } from "lucide-react"
import { useTranslation } from "react-i18next"

interface SourceBadgeProps {
  aiGenerated: boolean
  isEdited: boolean
  size?: "sm" | "md"
}

export default function SourceBadge({
  aiGenerated,
  isEdited,
  size = "sm",
}: SourceBadgeProps) {
  const { t } = useTranslation()
  const sizeClasses =
    size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"

  if (aiGenerated && isEdited) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-accent/15 font-medium text-accent ${sizeClasses}`}
      >
        <Pencil className={iconSize} />
        {t("common.sourceBadge.modifiedAi")}
      </span>
    )
  }

  if (aiGenerated) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-primary/10 font-medium text-primary ${sizeClasses}`}
      >
        <Bot className={iconSize} />
        {t("common.sourceBadge.ai")}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-muted font-medium text-muted-foreground ${sizeClasses}`}
    >
      <User className={iconSize} />
      {t("common.sourceBadge.manual")}
    </span>
  )
}
