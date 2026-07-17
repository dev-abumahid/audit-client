import { useGetMeQuery } from "@/redux/apis/auth.api"
import { Building2, HelpCircle, User, Users } from "lucide-react"
import { useState } from "react"
import KnowledgeBaseUploadingForm from "./KnowledgeBaseUploadingForm"
import PasswordChangeForm from "./PasswordChangeForm"
import PersonalInfoForm from "./PersonalInfoForm"
import TeamMembersTab from "./TeamMembersTab"

type TabType = "profile" | "team" | "knowledge"

export default function OrgSettingPage() {
  const [activeTab, setActiveTab] = useState<TabType>("profile")
  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: "profile", label: "User Settings", icon: <User size={18} /> },
    { key: "team", label: "Team", icon: <Users size={18} /> },
    {
      key: "knowledge",
      label: "Knowledge Base",
      icon: <HelpCircle size={18} />,
    },
  ]

  // rtk query state
  const { data } = useGetMeQuery(undefined)
  const orgData = data?.data

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Organization Settings
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your organization profile, team members, and preferences
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="mb-6 border-b border-border">
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
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
            <div className="space-y-6">
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
                  profilePhoto={orgData.profile?.profilePhoto}
                />
              )}

              <PasswordChangeForm />

              {/* Organization Info — still read-only: no backend route
                  exists to update organizationName/organizationLogo (see
                  above), so there's nothing to wire yet. */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Building2 size={20} /> Organization Information
                </h3>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                      Organization Name
                    </label>
                    <p className="text-foreground">
                      {orgData?.organizationProfile.organizationName}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                      Email Domain
                    </label>
                    <p className="text-foreground">{orgData?.email}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Team Tab */}
          {activeTab === "team" && <TeamMembersTab />}

          {/* Knowledge Base Tab */}
          {activeTab === "knowledge" && (
            <div className="space-y-6">
              <KnowledgeBaseUploadingForm />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
