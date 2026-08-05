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
    // Raw --accent text on its own 15%-tint bg measures ~2.1:1, well under
    // AA -- --accent shares its hue with --risk-medium, same failure as
    // RiskBadge's medium level, same fix.
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-amber-500/15 font-medium text-amber-800 dark:bg-amber-400/15 dark:text-amber-400 ${sizeClasses}`}
      >
        <Pencil className={iconSize} />
        {t("common.sourceBadge.modifiedAi")}
      </span>
    )
  }

  if (aiGenerated) {
    // Raw --primary text on background measures ~3.53:1 in light mode,
    // under AA -- same fix already applied to the landing page's eyebrow
    // labels and NavBar outline buttons (text-teal-700 override, dark mode
    // is fine at ~6.5:1 so only light needs the swap).
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-primary/10 font-medium text-teal-700 dark:text-primary ${sizeClasses}`}
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
