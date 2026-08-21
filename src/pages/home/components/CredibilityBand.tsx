import { useRevealOnScroll } from "@/hooks/useRevealOnScroll"
import React from "react"
import { useTranslation } from "react-i18next"

// Landing overhaul (theme-improvement-initiative), v2/v3 plan: replaces a
// cut "Built for modern GRC teams" trust band that made unverifiable claims
// with no numbers behind them. Every stat here is a structural fact about
// the real product (module count, real role names, the real 5x5 matrix
// scale) rather than a usage/customer metric that would need real
// production data this codebase doesn't have -- same honesty discipline as
// TestimonialsSection's "illustrative example" labeling, just for a
// different kind of claim. Deliberately quiet per the v3 motion plan: one
// plain fade-in, no per-stat stagger -- this reads as evidence, not a
// feature showcase.
const CredibilityBand: React.FC = () => {
  const { t } = useTranslation()
  const [revealRef, revealVisible] = useRevealOnScroll<HTMLDivElement>()

  const stats = [0, 1, 2].map((i) => ({
    value: t(`home.credibilityBand.stats.${i}.value`),
    label: t(`home.credibilityBand.stats.${i}.label`),
  }))

  return (
    <div
      ref={revealRef}
      className={`border-y border-border bg-background px-4 py-8 transition-opacity duration-500 ease-out motion-reduce:transition-none sm:px-6 lg:px-8 ${
        revealVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-7xl flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="flex flex-1 items-baseline gap-3 py-3 sm:justify-center sm:px-6 sm:py-0 sm:first:pl-0 sm:last:pr-0"
          >
            <span className="font-mono-data text-xl font-bold text-foreground sm:text-2xl">
              {stat.value}
            </span>
            <span className="text-xs text-muted-foreground sm:text-sm">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CredibilityBand
