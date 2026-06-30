import { useGetMeQuery } from "@/redux/apis/auth.api"
import { Building2, HelpCircle, Upload, User } from "lucide-react"
import { useState } from "react"
import KnowledgeBaseUploadingForm from "./KnowledgeBaseUploadingForm"

type TabType = "profile" | "knowledge"

export default function OrgSettingPage() {
  const [activeTab, setActiveTab] = useState<TabType>("profile")
  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: "profile", label: "User Settings", icon: <User size={18} /> },
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
              {/* Profile Card */}
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="relative h-32 bg-gradient-to-r from-primary/20 to-primary/5"></div>
                <div className="relative px-6 pb-6">
                  <div className="-mt-12 flex items-end justify-between">
                    <div className="flex items-end gap-4">
                      <div className="relative">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-background bg-primary/10">
                          {orgData?.organizationProfile?.organizationLogo ? (
                            <img
                              src={
                                orgData?.organizationProfile?.organizationLogo
                              }
                              alt="Organization Logo"
                              className="size-16 rounded-full"
                            />
                          ) : (
                            <span className="text-3xl font-bold text-primary">
                              TL
                            </span>
                          )}
                        </div>
                        <button className="absolute right-0 bottom-0 rounded-full bg-primary p-1.5 text-primary-foreground shadow-lg">
                          <Upload size={14} />
                        </button>
                      </div>
                    </div>
                    <button className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/20">
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>

              {/* Organization Info */}
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
