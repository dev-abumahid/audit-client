/* eslint-disable @typescript-eslint/no-explicit-any */
import { mockKRIs, mockRisks } from "@/data/mockData"
import type { KRI, Risk } from "@/types/organization"
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  TrendingUp,
  X,
} from "lucide-react"
import { useState } from "react"
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"

const EMPTY_KRI = {
  id: "",
  name: "",
  risk_ref: "",
  unit: "",
  current_value: 0,
  target_value: 0,
  alert_threshold: 0,
  frequency: "monthly" as const,
  status: "ok" as const,
  trend: [] as number[],
}

export default function KriDashboardPage() {
  const [kris, setKris] = useState<KRI[]>(mockKRIs)
  const [risks] = useState<Risk[]>(mockRisks)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_KRI)
  const [isSaving, setIsSaving] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)

  // Simulate AI Suggestion with dummy data
  const handleAISuggestion = async () => {
    if (risks.length === 0) return

    setIsSuggesting(true)

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1200))

    const suggestedNewKris: KRI[] = []

    // Filter out duplicates (simple check by name)
    const existingNames = new Set(kris.map((k) => k.name.toLowerCase()))
    const newUniqueKris = suggestedNewKris.filter(
      (k) => !existingNames.has(k.name.toLowerCase())
    )

    if (newUniqueKris.length > 0) {
      setKris((prev) => [...prev, ...newUniqueKris])
      alert(`${newUniqueKris.length} new KRIs added via AI suggestion!`)
    } else {
      alert("No new KRIs to suggest – all relevant ones already exist.")
    }

    setIsSuggesting(false)
  }

  const handleSave = async () => {
    if (!form.name || !form.risk_ref) return

    setIsSaving(true)

    // Simulate save delay
    await new Promise((resolve) => setTimeout(resolve, 800))

    const newKRI = {
      ...form,
      id: "k" + Date.now(),
      trend: [form.current_value],
    } as KRI

    setKris((prev) => [...prev, newKRI])
    setShowForm(false)
    setForm(EMPTY_KRI)

    alert("KRI created successfully!")

    setIsSaving(false)
  }

  const alertCount = kris.filter((k) => k.status === "alert").length
  const warningCount = kris.filter((k) => k.status === "warning").length
  const okCount = kris.filter((k) => k.status === "ok").length

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="animate-fade-in flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl">
            KRI Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor key risk indicators across your organization
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleAISuggestion}
            disabled={isSuggesting}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            {isSuggesting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Brain className="h-3.5 w-3.5" />
            )}
            {isSuggesting ? "Suggesting..." : "Suggest with AI"}
          </button>

          <button
            onClick={() => {
              setForm(EMPTY_KRI)
              setShowForm(true)
            }}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> New KRI
          </button>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="animate-slide-up flex flex-wrap gap-3">
        <div className="border-risk-critical/30 bg-risk-critical/5 flex items-center gap-2 rounded-lg border px-3 py-2">
          <AlertTriangle className="text-risk-critical h-4 w-4" />
          <span className="font-mono-data text-risk-critical text-lg font-bold">
            {alertCount}
          </span>
          <span className="text-xs text-muted-foreground">Alert</span>
        </div>
        <div className="border-risk-medium/30 bg-risk-medium/5 flex items-center gap-2 rounded-lg border px-3 py-2">
          <TrendingUp className="text-risk-medium h-4 w-4" />
          <span className="font-mono-data text-risk-medium text-lg font-bold">
            {warningCount}
          </span>
          <span className="text-xs text-muted-foreground">Warning</span>
        </div>
        <div className="border-risk-low/30 bg-risk-low/5 flex items-center gap-2 rounded-lg border px-3 py-2">
          <CheckCircle2 className="text-risk-low h-4 w-4" />
          <span className="font-mono-data text-risk-low text-lg font-bold">
            {okCount}
          </span>
          <span className="text-xs text-muted-foreground">OK</span>
        </div>
      </div>

      {/* KRI Cards */}
      <div className="animate-slide-up stagger-2 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kris.map((kri) => {
          const chartData = (kri.trend || []).map((v, i) => ({
            period: `T${i + 1}`,
            value: v,
          }))
          const statusColor =
            kri.status === "alert"
              ? "border-risk-critical/40"
              : kri.status === "warning"
                ? "border-risk-medium/40"
                : "border-risk-low/40"

          const lineColor =
            kri.status === "alert"
              ? "hsl(0, 72%, 51%)"
              : kri.status === "warning"
                ? "hsl(38, 92%, 50%)"
                : "hsl(142, 71%, 45%)"

          return (
            <div
              key={kri.id}
              className={`rounded-xl border-2 ${statusColor} bg-card p-4 lg:p-5`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {kri.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Risk {kri.risk_ref} · {kri.frequency}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    kri.status === "alert"
                      ? "bg-risk-critical/15 text-risk-critical"
                      : kri.status === "warning"
                        ? "bg-risk-medium/15 text-risk-medium"
                        : "bg-risk-low/15 text-risk-low"
                  }`}
                >
                  {kri.status}
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-mono-data text-2xl font-bold text-foreground lg:text-3xl">
                  {Number(kri.current_value)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {kri.unit}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-4 text-[11px] text-muted-foreground">
                <span>
                  Threshold:{" "}
                  <span className="font-mono-data text-risk-critical font-medium">
                    {Number(kri.alert_threshold)}
                  </span>
                </span>
                <span>
                  Target:{" "}
                  <span className="font-mono-data text-risk-low font-medium">
                    {Number(kri.target_value)}
                  </span>
                </span>
              </div>

              {chartData.length > 0 && (
                <div className="mt-3 h-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis
                        dataKey="period"
                        tick={false}
                        stroke="transparent"
                      />
                      <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                      <ReferenceLine
                        y={Number(kri.alert_threshold)}
                        stroke="hsl(0, 72%, 51%)"
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                      />
                      <ReferenceLine
                        y={Number(kri.target_value)}
                        stroke="hsl(142, 71%, 45%)"
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={lineColor}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )
        })}

        {kris.length === 0 && (
          <div className="col-span-full rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">No KRIs found</p>
          </div>
        )}
      </div>

      {/* New KRI Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">New KRI</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Name *
                </label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="Enter KRI name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Risk Reference
                  </label>
                  <select
                    value={form.risk_ref}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, risk_ref: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select Risk</option>
                    {risks.map((r) => (
                      <option key={r.id} value={r.ref}>
                        {r.ref} — {r.name.slice(0, 30)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Unit
                  </label>
                  <input
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    placeholder="%, days, count, etc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Current Value
                  </label>
                  <input
                    type="number"
                    value={form.current_value}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        current_value: Number(e.target.value),
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Alert Threshold
                  </label>
                  <input
                    type="number"
                    value={form.alert_threshold}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        alert_threshold: Number(e.target.value),
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Target
                  </label>
                  <input
                    type="number"
                    value={form.target_value}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        target_value: Number(e.target.value),
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Frequency
                </label>
                <select
                  value={form.frequency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, frequency: e.target.value as any }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !form.name || !form.risk_ref}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Create KRI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
