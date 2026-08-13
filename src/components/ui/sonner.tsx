import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useTheme } from "../theme-provider"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      // Error uses CircleAlert (a circle with "!") rather than an X-shaped
      // icon (e.g. OctagonX/CircleX) -- with `closeButton` now enabled,
      // an X-shaped type icon sitting right next to the actual close "X"
      // button read as a duplicate close control.
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <CircleAlertIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          // --popover/--popover-foreground/--border are bare HSL triplets
          // ("222 22% 11%", no hsl() wrapper) -- sonner's own stylesheet
          // assigns these custom properties directly as `background: var(...)`
          // with no wrapper of its own, so passing the bare triplet is an
          // invalid CSS color value and gets silently dropped, falling back
          // to sonner's default black/white theme instead of this app's.
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
