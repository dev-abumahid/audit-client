import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import GeneralInformation from "./GeneralInformation"
import PricingPlans from "./PricingPlans"

const AdminSettings: React.FC = () => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<
    "Company Settings" | "Subscription & Plans"
  >("Company Settings")

  const tabs = [
    {
      label: t("admin.settings.tabCompany"),
      value: "Company Settings" as const,
    },
    {
      label: t("admin.settings.tabSubscription"),
      value: "Subscription & Plans" as const,
    },
  ] as const

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
          <h1 className="text-3xl font-semibold text-foreground">
            {t("admin.settings.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("admin.settings.subtitle")}
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
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
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default AdminSettings
