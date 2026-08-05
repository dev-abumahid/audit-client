import React, { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import GeneralInformation from "./GeneralInformation"
import PricingPlans from "./PricingPlans"

const AdminSettings: React.FC = () => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<
    "Company Settings" | "Subscription & Plans"
  >("Company Settings")
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const tabs = [
    {
      label: t("admin.settings.tabCompany"),
      value: "Company Settings" as const,
      id: "company",
    },
    {
      label: t("admin.settings.tabSubscription"),
      value: "Subscription & Plans" as const,
      id: "subscription",
    },
  ] as const

  const activeTabId = tabs.find((tab) => tab.value === activeTab)?.id

  // Roving-tabindex keyboard navigation, per the ARIA APG tabs pattern: with
  // tabIndex={0} only on the active tab (below), Tab alone can no longer
  // reach the inactive one, so Arrow/Home/End have to move focus (and
  // activate, since these are simple/automatic-activation tabs) or the
  // inactive tab becomes completely keyboard-unreachable -- a regression
  // from the plain <button> list this replaced, every button of which was
  // natively Tab-focusable. Only ArrowLeft/ArrowRight are wired up (not
  // ArrowUp/ArrowDown): this is a horizontal-only tablist, and the APG
  // reserves the vertical arrows for vertical (or grid) tablists.
  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex: number | null = null
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % tabs.length
        break
      case "ArrowLeft":
        nextIndex = (index - 1 + tabs.length) % tabs.length
        break
      case "Home":
        nextIndex = 0
        break
      case "End":
        nextIndex = tabs.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    const nextTab = tabs[nextIndex]
    setActiveTab(nextTab.value)
    tabRefs.current[nextTab.id]?.focus()
  }

  const renderContent = () => {
    switch (activeTab) {
      case "Company Settings":
        return <GeneralInformation />
      case "Subscription & Plans":
        return <PricingPlans />
      default:
        return <GeneralInformation />
    }
  }

  return (
    <div className="flex-1 bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {t("admin.settings.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("admin.settings.subtitle")}
          </p>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label={t("admin.settings.title")}
          className="mb-6 flex border-b border-border"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.value}
              ref={(el) => {
                tabRefs.current[tab.id] = el
              }}
              id={`admin-settings-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={activeTab === tab.value}
              aria-controls="admin-settings-tabpanel"
              tabIndex={activeTab === tab.value ? 0 : -1}
              onClick={() => setActiveTab(tab.value)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              className={`-mb-px border-b-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Card */}
        <div
          id="admin-settings-tabpanel"
          role="tabpanel"
          aria-labelledby={`admin-settings-tab-${activeTabId}`}
          tabIndex={0}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default AdminSettings
