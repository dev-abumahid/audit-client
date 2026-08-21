import type { ComponentType, KeyboardEvent } from "react"
import { useRef, useState } from "react"

export interface DemoTab {
  id: string
  label: string
  Component: ComponentType
}

// v3 motion plan's "shared tab transition system" for the interactive demo
// tabs: outgoing panel fades out at `fast` speed, incoming panel fades in +
// translates up 4px at `standard` speed, container height held stable
// across the swap. Stability comes from CSS Grid stacking (every panel
// occupies the same [grid-area:1/1] cell, so the grid sizes to the tallest
// one) rather than a fixed/measured height, which would need a resize
// observer to stay correct as content changes. Inactive panels get `inert`
// (React 19 native prop) instead of unmounting, so a screen reader or
// keyboard user never lands on off-screen, non-visible content -- opacity
// alone doesn't remove an element from the tab order.
export default function DemoTabs({ tabs }: { tabs: DemoTab[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Review finding on PR #1016: role="tablist"/role="tab" implies the ARIA
  // APG tabs pattern (arrow-key navigation, roving tabindex), which basic
  // per-button onClick handlers alone don't provide -- each tab was its own
  // separate Tab stop instead. Left/Right (and Home/End) move focus AND
  // activate, matching the "automatic activation" variant of the pattern,
  // which is the simpler of the two APG-sanctioned options and fits a
  // small, always-cheap-to-render tab set like this one.
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (e.key === "ArrowRight") nextIndex = (index + 1) % tabs.length
    else if (e.key === "ArrowLeft")
      nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (e.key === "Home") nextIndex = 0
    else if (e.key === "End") nextIndex = tabs.length - 1
    if (nextIndex === null) return

    e.preventDefault()
    const nextTab = tabs[nextIndex]
    setActiveId(nextTab.id)
    tabRefs.current[nextTab.id]?.focus()
  }

  return (
    <div>
      <div role="tablist" className="mb-3 flex gap-1.5">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeId
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el
              }}
              type="button"
              role="tab"
              id={`demo-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`demo-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`focus-ring rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 ease-out ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="grid">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId
          const Panel = tab.Component
          return (
            <div
              key={tab.id}
              id={`demo-panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`demo-tab-${tab.id}`}
              inert={!isActive}
              className={`[grid-area:1/1] transition-all duration-200 ease-out motion-reduce:transition-none ${
                isActive
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-1 opacity-0"
              }`}
            >
              <Panel />
            </div>
          )
        })}
      </div>
    </div>
  )
}
