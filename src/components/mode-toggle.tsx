import { Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ModeToggle() {
  const { t } = useTranslation()
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          {/* transition-transform, not transition-all: on the landing
              page's collapsible mobile nav, this icon sits inside a
              container whose `visibility` toggles when the menu opens/
              closes. transition-all was also interpolating that (and any
              other inherited property change), letting a frame of the icon
              paint through before the ancestor's visibility change took
              effect. Scoping to transform (the only thing that actually
              needs to animate here) removes that stray paint. */}
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
          <span className="sr-only">{t("common.toggleTheme")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          {t("common.light")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          {t("common.dark")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          {t("common.system")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
