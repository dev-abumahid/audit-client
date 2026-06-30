import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react"

interface SaveStatusIndicatorProps {
  status: "idle" | "saving" | "saved" | "error"
  hasChanges: boolean
}

export function SaveStatusIndicator({
  status,
  hasChanges,
}: SaveStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "saving":
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          text: "Saving changes...",
          className: "text-blue-600",
        }
      case "saved":
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          text: "All changes saved",
          className: "text-green-600",
        }
      case "error":
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: "Auto-save failed",
          className: "text-red-600",
        }
      default:
        return {
          icon: hasChanges ? (
            <Save className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4 opacity-50" />
          ),
          text: hasChanges ? "Unsaved changes" : "All changes saved",
          className: hasChanges ? "text-yellow-600" : "text-gray-500",
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
