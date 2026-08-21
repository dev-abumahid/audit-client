import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"
import { SEVERITY_STYLES, type SeverityLevel } from "@/utils/severityStyles"

// aexa-frontend theme-improvement-initiative Phase A2 -- a real shared
// primitive for the severity/status pill markup that ~20 files hand-rolled
// independently (raw `<span>`s with duplicated `rounded-full px-2...`
// composition), several of which already imported `severityStyles.ts` for
// SOME of their badges but not others (partial adoption, not clean
// holdouts). This component owns the *markup* (rounded-full pill, padding,
// font sizing) so callers stop reinventing it; the *color* math still lives
// entirely in severityStyles.ts -- the `critical`/`high`/`medium`/`low`/
// `info`/`neutral` variants below are generated FROM `SEVERITY_STYLES`, not
// duplicated, so this file can never drift out of sync with the WCAG-AA
// contrast values documented there.
//
// Generic variants (`primary`/`secondary`/`destructive`/`success`) cover the
// non-severity status pills found alongside severity ones in the same
// audit (role badges, active/suspended/expired member-status pills) --
// these intentionally don't route through severityStyles, since that file's
// contract is specifically the 5-bucket risk/status severity concept, not
// general UI tinting.
const severityVariantClasses = Object.fromEntries(
  (Object.keys(SEVERITY_STYLES) as SeverityLevel[]).map((level) => [
    level,
    `${SEVERITY_STYLES[level].bg} ${SEVERITY_STYLES[level].text}`,
  ])
) as Record<SeverityLevel, string>

const severityBorderedVariantClasses = Object.fromEntries(
  (Object.keys(SEVERITY_STYLES) as SeverityLevel[]).map((level) => [
    level,
    `border ${SEVERITY_STYLES[level].border}`,
  ])
) as Record<SeverityLevel, string>

// Border classes for the 4 generic (non-severity) variants, parallel to
// severityBorderedVariantClasses above. Found missing by an independent
// review of this PR: `bordered` silently no-op'd for every variant except
// the 6 severity levels, since compoundVariants only covered those --
// `<Badge variant="primary" bordered>` rendered with no border at all,
// a latent footgun for the next caller (no current call site in this repo
// passes `bordered` on a generic variant, so it wasn't user-visible yet).
const genericBorderedVariantClasses = {
  primary: "border border-primary/30",
  secondary: "border border-border",
  destructive: "border border-destructive/30",
  success: "border border-green-500/30 dark:border-green-400/30",
} as const

// eslint-disable-next-line react-refresh/only-export-components
export const badgeVariants = cva(
  "group/badge inline-flex w-fit items-center justify-center rounded-full whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-primary/10 text-primary",
        secondary: "bg-muted text-muted-foreground",
        destructive: "bg-destructive/10 text-destructive",
        success: "bg-green-500/10 text-green-600 dark:text-green-400",
        ...severityVariantClasses,
      },
      size: {
        // Matches RiskOverrideBadge.tsx's pre-migration markup exactly.
        xs: "gap-1 px-2 py-0.5 text-[10px] font-semibold",
        // Matches RiskBadge.tsx's `size="sm"` pre-migration markup exactly.
        sm: "gap-1.5 px-2 py-0.5 text-[11px] font-medium",
        // Matches RiskBadge.tsx's `size="md"` and the settings-page status
        // pills' (TeamMembersTab/ExternalMembersSection) pre-migration
        // markup exactly.
        md: "gap-1.5 px-2.5 py-1 text-xs font-medium",
      },
      // Empty base variant: `bordered` contributes no classes on its own --
      // it only exists here so cva recognizes it as a typed prop. All real
      // border styling comes from the compoundVariants below, one per
      // variant (severity + generic), so every variant gets a border color
      // that matches its own text/background instead of one generic border.
      bordered: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      ...(Object.keys(severityBorderedVariantClasses) as SeverityLevel[]).map(
        (level) => ({
          variant: level,
          bordered: true as const,
          class: severityBorderedVariantClasses[level],
        })
      ),
      ...(
        Object.keys(genericBorderedVariantClasses) as Array<
          keyof typeof genericBorderedVariantClasses
        >
      ).map((variant) => ({
        variant,
        bordered: true as const,
        class: genericBorderedVariantClasses[variant],
      })),
    ],
    defaultVariants: {
      variant: "secondary",
      size: "md",
      bordered: false,
    },
  }
)

function Badge({
  className,
  variant = "secondary",
  size = "md",
  bordered = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant, size, bordered, className }))}
      {...props}
    />
  )
}

export { Badge }
