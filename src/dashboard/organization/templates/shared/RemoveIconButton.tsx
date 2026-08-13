import { Button } from "@/components/ui/button"
import { Trash2, X } from "lucide-react"

interface RemoveIconButtonProps {
  onClick: () => void
  disabled?: boolean
  label: string
  className?: string
  icon?: "trash" | "x"
  iconSize?: number
  // Review finding on PR #803: the two logo-remove call sites (EditTemplatePage,
  // CreateTemplatePage) were a fixed 24px (`h-6 w-6`) box before this
  // extraction; defaulting every caller to `icon-xs` (20px) silently shrank
  // them. Exposed so those two call sites can opt into the matching 24px box.
  size?: "icon-xs" | "icon-sm"
}

// Extracted from 6 near-identical hand-rolled `bg-red-500 hover:bg-red-600`
// circular remove buttons (EditSortableQuestionRow, EditTemplatePage x2,
// PageSection, SortableQuestionRow, CreateTemplatePage) -- all with no
// dark: variant, unlike the shared Button component's own destructive
// variant. Callers still supply their own `className` for absolute
// positioning, since that varies per call site.
export function RemoveIconButton({
  onClick,
  disabled,
  label,
  className,
  icon = "trash",
  iconSize = 12,
  size = "icon-xs",
}: RemoveIconButtonProps) {
  const Icon = icon === "x" ? X : Trash2

  return (
    <Button
      type="button"
      variant="destructive"
      size={size}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-full ${className ?? ""}`}
    >
      <Icon size={iconSize} />
    </Button>
  )
}
