import { Bot, Building2, Check, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SEVERITY_STYLES } from "@/utils/severityStyles"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  useCommitOnboardingMutation,
  useGenerateOnboardingBaselineMutation,
  useIdentifyCompanyMutation,
} from "@/redux/apis/organization/onboarding.api"
import type {
  CommitRequest,
  CommitResult,
  CompanyProfile,
  DraftKri,
  DraftRisk,
} from "@/types/onboarding"

type Step = "entry" | "confirm" | "generating" | "review" | "done"

interface ConfirmSite {
  site_name: string
  site_location: string
  site_primary_activity: string
  site_country: string
  site_revenue: string
  site_employees: string
  site_type: string
  source_info: string
  selected: boolean
}

interface ReviewKri extends DraftKri {
  selected: boolean
}
interface ReviewRisk extends Omit<DraftRisk, "kris"> {
  selected: boolean
  kris: ReviewKri[]
}
interface ReviewSite {
  site_name: string
  site_location: string
  site_primary_activity: string
  site_country: string
  site_revenue: string
  site_employees: string
  site_type: string
  source_info: string
  risks: ReviewRisk[]
}

interface OnboardingWizardProps {
  onClose: () => void
  onCreated?: (result: CommitResult) => void
}

const toNum = (value: string): number => {
  const parsed = parseInt(String(value).replace(/[^\d-]/g, ""), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

const errMessage = (error: unknown, fallback: string): string => {
  const data = (error as { data?: { message?: string } } | undefined)?.data
  return data?.message || fallback
}

// The AI-generated badge, matching the "🤖 AI" convention used across the
// Risk Register / Sites views.
function AiBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
      <Bot className="h-3 w-3" /> {label}
    </span>
  )
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onClose,
  onCreated,
}) => {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>("entry")

  // Entry form — company name required, admin credentials required (they back
  // the new tenant's Account), sector/country optional pre-fills.
  const [companyName, setCompanyName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [sector, setSector] = useState("")
  const [country, setCountry] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [confirmSites, setConfirmSites] = useState<ConfirmSite[]>([])
  const [employeeBand, setEmployeeBand] = useState("")

  const [reviewSites, setReviewSites] = useState<ReviewSite[]>([])
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null)

  const [identify, { isLoading: isIdentifying }] = useIdentifyCompanyMutation()
  const [generate, { isLoading: isGenerating }] =
    useGenerateOnboardingBaselineMutation()
  const [commit, { isLoading: isCommitting }] = useCommitOnboardingMutation()

  // --- Stage 1: Identify -----------------------------------------------------
  const handleAnalyze = async () => {
    setFormError(null)
    if (!companyName.trim() || !email.trim() || !password.trim()) {
      setFormError(t("admin.onboarding.errors.required"))
      return
    }
    if (password.length < 8) {
      setFormError(t("admin.onboarding.errors.passwordLength"))
      return
    }
    try {
      const res = await identify({ company_name: companyName.trim() }).unwrap()
      const data = res.data
      setProfile(data)
      setSector((prev) => prev || data.sector || "")
      setCountry((prev) => prev || data.hq_country || data.country || "")
      setEmployeeBand(data.employee_band || "")
      setConfirmSites(
        (data.sites_information || []).map((s) => ({
          site_name: s.site_name || "",
          site_location: s.site_location || "",
          site_primary_activity: s.site_primary_activity || "",
          site_country: s.site_country || data.hq_country || "",
          site_revenue: s.site_revenue || "",
          site_employees: s.site_employees || "",
          site_type: s.site_type || "",
          source_info: s.source_info || "",
          selected: true,
        }))
      )
      setStep("confirm")
    } catch (error) {
      toast.error(errMessage(error, t("admin.onboarding.errors.identify")))
    }
  }

  const updateConfirmSite = (
    index: number,
    patch: Partial<ConfirmSite>
  ): void => {
    setConfirmSites((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    )
  }

  const addConfirmSite = () => {
    setConfirmSites((prev) => [
      ...prev,
      {
        site_name: "",
        site_location: "",
        site_primary_activity: "",
        site_country: country,
        site_revenue: "",
        site_employees: "",
        site_type: "",
        source_info: "",
        selected: true,
      },
    ])
  }

  const selectedConfirmSites = useMemo(
    () => confirmSites.filter((s) => s.selected && s.site_name.trim()),
    [confirmSites]
  )

  // --- Stage 3: Generate -----------------------------------------------------
  const handleGenerate = async () => {
    if (selectedConfirmSites.length === 0) {
      toast.error(t("admin.onboarding.errors.noSites"))
      return
    }
    setStep("generating")
    try {
      const res = await generate({
        sector: sector || null,
        country: country || null,
        sites: selectedConfirmSites.map((s) => ({
          site_name: s.site_name,
          site_location: s.site_location || null,
          site_primary_activity: s.site_primary_activity || null,
          site_country: s.site_country || null,
          site_revenue: s.site_revenue || null,
          site_employees: s.site_employees || null,
          site_type: s.site_type || null,
          source_info: s.source_info || null,
        })),
      }).unwrap()

      const drafts = res.data.sites || []
      setReviewSites(
        drafts.map((d) => {
          const source = selectedConfirmSites.find(
            (s) => s.site_name === (d as { site_name?: string }).site_name
          )
          return {
            site_name: (d as { site_name?: string }).site_name || "",
            site_location: source?.site_location || "",
            site_primary_activity: source?.site_primary_activity || "",
            site_country: source?.site_country || "",
            site_revenue: source?.site_revenue || "",
            site_employees: source?.site_employees || "",
            site_type: source?.site_type || "",
            source_info: source?.source_info || "",
            risks: (d.risks || []).map((r) => ({
              ...r,
              selected: true,
              kris: (r.kris || []).map((k) => ({ ...k, selected: true })),
            })),
          }
        })
      )
      setStep("review")
    } catch (error) {
      toast.error(errMessage(error, t("admin.onboarding.errors.generate")))
      setStep("confirm")
    }
  }

  // --- Review editing --------------------------------------------------------
  const updateRisk = (
    siteIdx: number,
    riskIdx: number,
    patch: Partial<ReviewRisk>
  ): void => {
    setReviewSites((prev) =>
      prev.map((site, si) =>
        si !== siteIdx
          ? site
          : {
              ...site,
              risks: site.risks.map((r, ri) =>
                ri === riskIdx ? { ...r, ...patch } : r
              ),
            }
      )
    )
  }

  const updateKri = (
    siteIdx: number,
    riskIdx: number,
    kriIdx: number,
    patch: Partial<ReviewKri>
  ): void => {
    setReviewSites((prev) =>
      prev.map((site, si) =>
        si !== siteIdx
          ? site
          : {
              ...site,
              risks: site.risks.map((r, ri) =>
                ri !== riskIdx
                  ? r
                  : {
                      ...r,
                      kris: r.kris.map((k, ki) =>
                        ki === kriIdx ? { ...k, ...patch } : k
                      ),
                    }
              ),
            }
      )
    )
  }

  const selectedCounts = useMemo(() => {
    let risks = 0
    let kris = 0
    reviewSites.forEach((site) =>
      site.risks.forEach((r) => {
        if (r.selected) {
          risks += 1
          r.kris.forEach((k) => {
            if (k.selected) kris += 1
          })
        }
      })
    )
    return { risks, kris }
  }, [reviewSites])

  // --- Stage 4: Commit -------------------------------------------------------
  const handleCommit = async () => {
    const payload: CommitRequest = {
      organizationName: companyName.trim(),
      email: email.trim(),
      password,
      sector: sector || null,
      country: country || null,
      sites: reviewSites.map((site) => ({
        name: site.site_name,
        location: site.site_location || null,
        country: site.site_country || null,
        activity: site.site_primary_activity || null,
        revenue: toNum(site.site_revenue),
        employees_count: toNum(site.site_employees),
        site_type: site.site_type || "other",
        source_info: site.source_info || null,
        risks: site.risks
          .filter((r) => r.selected && r.name.trim())
          .map((r) => ({
            name: r.name,
            description: r.description || null,
            category: r.category || "Operational",
            inherent_score: r.inherent_score ?? null,
            residual_score: r.residual_score ?? null,
            probability: r.probability ?? null,
            velocity: r.velocity ?? null,
            trend: r.trend ?? null,
            status: r.status || "open",
            source_info: r.source_info || null,
            kris: r.kris
              .filter((k) => k.selected && k.name.trim())
              .map((k) => ({
                name: k.name,
                unit: k.unit || "",
                current_value: k.current_value || 0,
                alert_threshold: k.alert_threshold || 0,
                target_value: k.target_value || 0,
                frequency: k.frequency || null,
              })),
          })),
      })),
    }

    try {
      const res = await commit(payload).unwrap()
      setCommitResult(res.data)
      setStep("done")
      onCreated?.(res.data)
    } catch (error) {
      toast.error(errMessage(error, t("admin.onboarding.errors.commit")))
    }
  }

  // --- Render ---------------------------------------------------------------
  const inputCls =
    "w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
  const labelCls = "mb-1.5 block text-sm font-medium text-muted-foreground"

  // Steps where the wizard is holding meaningful, non-trivial work (confirmed
  // sites, an AI-generated draft mid-review, or an in-flight generate/commit
  // request) — an accidental Escape or outside click here would silently
  // discard several minutes of AI generation with no way back. "entry" (just
  // a not-yet-submitted form) and "done" (already committed) have nothing at
  // risk, so those keep the plain Escape/outside-click-to-dismiss behavior
  // aexa-frontend#407 asked for. Same guard pattern as
  // CreateNewFindingModal.tsx.
  const hasUnsavedWizardProgress =
    step === "confirm" || step === "generating" || step === "review"

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => {
          if (hasUnsavedWizardProgress) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (hasUnsavedWizardProgress) e.preventDefault()
        }}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xl sm:max-w-3xl"
      >
        <DialogHeader className="mb-6 flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle className="text-xl font-semibold text-foreground">
              {t("admin.onboarding.title")}
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={() => {
              // Same guard as the Dialog's onEscapeKeyDown/onInteractOutside
              // below — the visible X must not be able to silently discard
              // an in-progress AI-generation run that Escape/outside-click
              // are already blocked from discarding.
              if (hasUnsavedWizardProgress) return
              onClose()
            }}
            aria-label={t("admin.onboarding.close")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Step: Entry */}
          {step === "entry" && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                {t("admin.onboarding.entry.subtitle")}
              </p>
              <div>
                <label className={labelCls}>
                  {t("admin.onboarding.entry.companyName")} *
                </label>
                <input
                  className={inputCls}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t(
                    "admin.onboarding.entry.companyNamePlaceholder"
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    {t("admin.onboarding.entry.adminEmail")} *
                  </label>
                  <input
                    className={inputCls}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t(
                      "admin.onboarding.entry.adminEmailPlaceholder"
                    )}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {t("admin.onboarding.entry.adminPassword")} *
                  </label>
                  <input
                    className={inputCls}
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {t("admin.onboarding.entry.sector")}
                  </label>
                  <input
                    className={inputCls}
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder={t("admin.onboarding.entry.optional")}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {t("admin.onboarding.entry.country")}
                  </label>
                  <input
                    className={inputCls}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder={t("admin.onboarding.entry.optional")}
                  />
                </div>
              </div>
              {formError && (
                <p className={`text-sm ${SEVERITY_STYLES.critical.text}`}>
                  {formError}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  {t("admin.onboarding.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isIdentifying}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {isIdentifying && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {t("admin.onboarding.entry.analyze")}
                </button>
              </div>
            </div>
          )}

          {/* Step: Confirm */}
          {step === "confirm" && profile && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                {t("admin.onboarding.confirm.subtitle")}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>
                    {t("admin.onboarding.confirm.sector")}
                  </label>
                  <input
                    className={inputCls}
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                  />
                  {profile.sector_source && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t("admin.onboarding.confirm.source")}:{" "}
                      {profile.sector_source}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>
                    {t("admin.onboarding.confirm.country")}
                  </label>
                  <input
                    className={inputCls}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                  {profile.hq_country_source && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t("admin.onboarding.confirm.source")}:{" "}
                      {profile.hq_country_source}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>
                    {t("admin.onboarding.confirm.employeeBand")}
                  </label>
                  <input
                    className={inputCls}
                    value={employeeBand}
                    onChange={(e) => setEmployeeBand(e.target.value)}
                  />
                  {profile.employee_band_source && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t("admin.onboarding.confirm.source")}:{" "}
                      {profile.employee_band_source}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("admin.onboarding.confirm.discoveredSites")}
                  </h3>
                  <button
                    type="button"
                    onClick={addConfirmSite}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("admin.onboarding.confirm.addSite")}
                  </button>
                </div>
                {confirmSites.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("admin.onboarding.confirm.noSites")}
                  </p>
                )}
                <div className="space-y-3">
                  {confirmSites.map((site, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-background p-3"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-2"
                          checked={site.selected}
                          onChange={(e) =>
                            updateConfirmSite(i, { selected: e.target.checked })
                          }
                          aria-label={t("admin.onboarding.confirm.includeSite")}
                        />
                        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                          <input
                            className={inputCls}
                            value={site.site_name}
                            onChange={(e) =>
                              updateConfirmSite(i, {
                                site_name: e.target.value,
                              })
                            }
                            placeholder={t("admin.onboarding.confirm.siteName")}
                          />
                          <input
                            className={inputCls}
                            value={site.site_location}
                            onChange={(e) =>
                              updateConfirmSite(i, {
                                site_location: e.target.value,
                              })
                            }
                            placeholder={t(
                              "admin.onboarding.confirm.siteLocation"
                            )}
                          />
                          <input
                            className={inputCls}
                            value={site.site_primary_activity}
                            onChange={(e) =>
                              updateConfirmSite(i, {
                                site_primary_activity: e.target.value,
                              })
                            }
                            placeholder={t(
                              "admin.onboarding.confirm.sitePrimaryActivity"
                            )}
                          />
                          <input
                            className={inputCls}
                            value={site.site_country}
                            onChange={(e) =>
                              updateConfirmSite(i, {
                                site_country: e.target.value,
                              })
                            }
                            placeholder={t(
                              "admin.onboarding.confirm.siteCountry"
                            )}
                          />
                          <input
                            className={inputCls}
                            value={site.site_revenue}
                            onChange={(e) =>
                              updateConfirmSite(i, {
                                site_revenue: e.target.value,
                              })
                            }
                            placeholder={t(
                              "admin.onboarding.confirm.siteRevenue"
                            )}
                          />
                          <input
                            className={inputCls}
                            value={site.site_employees}
                            onChange={(e) =>
                              updateConfirmSite(i, {
                                site_employees: e.target.value,
                              })
                            }
                            placeholder={t(
                              "admin.onboarding.confirm.siteEmployees"
                            )}
                          />
                          <input
                            className={inputCls}
                            value={site.site_type}
                            onChange={(e) =>
                              updateConfirmSite(i, {
                                site_type: e.target.value,
                              })
                            }
                            placeholder={t(
                              "admin.onboarding.confirm.siteType"
                            )}
                          />
                        </div>
                      </div>
                      {site.source_info && (
                        <p className="mt-1 pl-7 text-[11px] text-muted-foreground">
                          {t("admin.onboarding.confirm.source")}:{" "}
                          {site.source_info}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("entry")}
                  className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  {t("admin.onboarding.back")}
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={selectedConfirmSites.length === 0 || isGenerating}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {t("admin.onboarding.confirm.continue")}
                </button>
              </div>
            </div>
          )}

          {/* Step: Generating */}
          {step === "generating" && (
            <div className="flex flex-col items-center gap-4 py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {t("admin.onboarding.generating.message")}
              </p>
            </div>
          )}

          {/* Step: Review */}
          {step === "review" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
                {t("admin.onboarding.review.notice")}
              </div>
              <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
                {reviewSites.map((site, si) => (
                  <div key={si} className="rounded-xl border border-border p-3">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {site.site_name || t("admin.onboarding.review.unnamed")}
                    </h3>
                    {site.risks.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t("admin.onboarding.review.noRisks")}
                      </p>
                    )}
                    <div className="space-y-3">
                      {site.risks.map((risk, ri) => (
                        <div
                          key={ri}
                          className="rounded-lg border border-border bg-background p-3"
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-1.5"
                              checked={risk.selected}
                              onChange={(e) =>
                                updateRisk(si, ri, {
                                  selected: e.target.checked,
                                })
                              }
                              aria-label={t(
                                "admin.onboarding.review.includeRisk"
                              )}
                            />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  className={`${inputCls} font-medium`}
                                  value={risk.name}
                                  onChange={(e) =>
                                    updateRisk(si, ri, { name: e.target.value })
                                  }
                                />
                                <AiBadge
                                  label={t("admin.onboarding.aiBadge")}
                                />
                              </div>
                              <div className="flex gap-2">
                                <input
                                  className={`${inputCls} max-w-[200px]`}
                                  value={risk.category}
                                  onChange={(e) =>
                                    updateRisk(si, ri, {
                                      category: e.target.value,
                                    })
                                  }
                                  placeholder={t(
                                    "admin.onboarding.review.category"
                                  )}
                                />
                              </div>
                              <textarea
                                className={inputCls}
                                rows={2}
                                value={risk.description || ""}
                                onChange={(e) =>
                                  updateRisk(si, ri, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder={t(
                                  "admin.onboarding.review.description"
                                )}
                              />

                              {risk.kris.length > 0 && (
                                <div className="mt-1 space-y-1.5 border-l-2 border-primary/20 pl-3">
                                  <p className="text-[11px] font-medium text-muted-foreground">
                                    {t("admin.onboarding.review.kris")}
                                  </p>
                                  {risk.kris.map((kri, ki) => (
                                    <div
                                      key={ki}
                                      className="flex items-center gap-2"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={kri.selected}
                                        onChange={(e) =>
                                          updateKri(si, ri, ki, {
                                            selected: e.target.checked,
                                          })
                                        }
                                        aria-label={t(
                                          "admin.onboarding.review.includeKri"
                                        )}
                                      />
                                      <input
                                        className={`${inputCls} flex-1`}
                                        value={kri.name}
                                        onChange={(e) =>
                                          updateKri(si, ri, ki, {
                                            name: e.target.value,
                                          })
                                        }
                                      />
                                      <input
                                        className={`${inputCls} w-24`}
                                        type="number"
                                        value={kri.alert_threshold}
                                        onChange={(e) =>
                                          updateKri(si, ri, ki, {
                                            alert_threshold: Number(
                                              e.target.value
                                            ),
                                          })
                                        }
                                        aria-label={t(
                                          "admin.onboarding.review.threshold"
                                        )}
                                      />
                                      <span className="text-[10px] text-muted-foreground">
                                        {kri.unit}
                                      </span>
                                    </div>
                                  ))}
                                  <p className="text-[10px] text-muted-foreground">
                                    {t("admin.onboarding.review.thresholdNote")}
                                  </p>
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                updateRisk(si, ri, { selected: false })
                              }
                              aria-label={t(
                                "admin.onboarding.review.excludeRisk"
                              )}
                              className="text-muted-foreground hover:text-red-700 dark:hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="text-xs text-muted-foreground">
                  {t("admin.onboarding.review.selectedSummary", {
                    risksText: t("admin.onboarding.review.risksCount", {
                      count: selectedCounts.risks,
                    }),
                    krisText: t("admin.onboarding.review.krisCount", {
                      count: selectedCounts.kris,
                    }),
                  })}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep("confirm")}
                    className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted"
                  >
                    {t("admin.onboarding.back")}
                  </button>
                  <button
                    type="button"
                    onClick={handleCommit}
                    disabled={isCommitting}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {isCommitting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {t("admin.onboarding.review.createOrganization")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && commitResult && (
            <div className="space-y-5 py-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Check className="h-7 w-7 text-emerald-700 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {t("admin.onboarding.done.title", {
                  name: commitResult.organization.name,
                })}
              </h3>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
                {t("admin.onboarding.done.banner", {
                  sitesText: t("admin.onboarding.done.sitesCount", {
                    count: commitResult.counts.sites,
                  }),
                  risksText: t("admin.onboarding.done.risksCount", {
                    count: commitResult.counts.risks,
                  }),
                  krisText: t("admin.onboarding.done.krisCount", {
                    count: commitResult.counts.kris,
                  }),
                })}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("admin.onboarding.done.close")}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default OnboardingWizard
