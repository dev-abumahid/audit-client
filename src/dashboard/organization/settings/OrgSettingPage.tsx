import { useGetMeQuery } from "@/redux/apis/auth.api"
import { Building2, HelpCircle, User, Users } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import KnowledgeBaseUploadingForm from "./KnowledgeBaseUploadingForm"
import PasswordChangeForm from "./PasswordChangeForm"
import PersonalInfoForm from "./PersonalInfoForm"
import TeamMembersTab from "./TeamMembersTab"

type TabType = "profile" | "team" | "knowledge"

export default function OrgSettingPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabType>("profile")
  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    {
      key: "profile",
      label: t("organization.settings.tabUserSettings"),
      icon: <User size={18} />,
    },
    {
      key: "team",
      label: t("organization.settings.tabTeam"),
      icon: <Users size={18} />,
    },
    {
      key: "knowledge",
      label: t("organization.settings.tabKnowledgeBase"),
      icon: <HelpCircle size={18} />,
    },
  ]

  // rtk query state
  const { data } = useGetMeQuery(undefined)
  const orgData = data?.data

  // Roving-tabindex tabs (tabIndex={-1} on inactive tabs below) means native
  // Tab can no longer reach them -- per the WAI-ARIA tabs pattern, Left/Right
  // (and Home/End) arrow keys must move focus and switch tabs instead, or a
  // keyboard-only user has no way to reach the other tabs at all (#500).
  const tabRefs = useRef<Record<TabType, HTMLButtonElement | null>>({
    profile: null,
    team: null,
    knowledge: null,
  })

  const focusAndActivateTab = (key: TabType) => {
    setActiveTab(key)
    tabRefs.current[key]?.focus()
  }

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    tabList: { key: TabType }[]
  ) => {
    let nextIndex: number | null = null
    switch (e.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % tabList.length
        break
      case "ArrowLeft":
        nextIndex = (index - 1 + tabList.length) % tabList.length
        break
      case "Home":
        nextIndex = 0
        break
      case "End":
        nextIndex = tabList.length - 1
        break
      default:
        return
    }
    e.preventDefault()
    focusAndActivateTab(tabList[nextIndex].key)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {t("organization.settings.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("organization.settings.subtitle")}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="mb-6 border-b border-border">
          <nav
            className="flex gap-1 overflow-x-auto"
            role="tablist"
            aria-label={t("organization.settings.title")}
          >
            {tabs.map((tab, index) => (
              <button
                key={tab.key}
                ref={(el) => {
                  tabRefs.current[tab.key] = el
                }}
                id={`org-settings-tab-${tab.key}`}
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-controls={`org-settings-tabpanel-${tab.key}`}
                tabIndex={activeTab === tab.key ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={(e) => handleTabKeyDown(e, index, tabs)}
                className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="animate-fade-in">
          {/* User Settings Tab */}
          {activeTab === "profile" && (
            <div
              id="org-settings-tabpanel-profile"
              role="tabpanel"
              aria-labelledby="org-settings-tab-profile"
              tabIndex={0}
              className="space-y-6"
            >
              {/* Personal info: editable full name + avatar, backed by the
                  real PATCH /api/profile route. This replaces the old
                  "Profile Card" (org-logo upload button + Delete Account),
                  neither of which had any backing route — see #78/#66 for
                  why they were removed rather than implemented:
                  - Org logo/name have no update endpoint anywhere in
                    aexa-server (OrganizationProfile is only ever created,
                    at signup/invite-accept, never updated) — building that
                    is real backend work, out of scope for "wire UI to
                    existing route."
                  - Account deletion has zero backend support (no route,
                    and Account.isDeleted is only ever read, never set by
                    any endpoint) — an irreversible action with no existing
                    implementation needs its own scoped ticket (soft-delete
                    semantics, org-anchor-account cascade behavior, session
                    invalidation), not a button bolted onto this one. */}
              {orgData && (
                <PersonalInfoForm
                  initialFullName={orgData.profile?.fullName ?? ""}
                  profilePhoto={orgData.profile?.profilePhoto ?? undefined}
                />
              )}

              <PasswordChangeForm />

              {/* Organization Info — still read-only: no backend route
                  exists to update organizationName/organizationLogo (see
                  above), so there's nothing to wire yet. */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Building2 size={20} />{" "}
                  {t("organization.settings.orgInformation")}
                </h2>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                      {t("organization.settings.orgName")}
                    </label>
                    <p className="text-foreground">
                      {orgData?.organizationProfile?.organizationName}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                      {t("organization.settings.emailDomain")}
                    </label>
                    <p className="text-foreground">{orgData?.email}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Team Tab */}
          {activeTab === "team" && (
            <div
              id="org-settings-tabpanel-team"
              role="tabpanel"
              aria-labelledby="org-settings-tab-team"
              tabIndex={0}
            >
              <TeamMembersTab />
            </div>
          )}

          {/* Knowledge Base Tab */}
          {activeTab === "knowledge" && (
            <div
              id="org-settings-tabpanel-knowledge"
              role="tabpanel"
              aria-labelledby="org-settings-tab-knowledge"
              tabIndex={0}
              className="space-y-6"
            >
              <KnowledgeBaseUploadingForm />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
