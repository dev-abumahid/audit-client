import React from "react"

interface PricingPlan {
  _id: string
  planName: string
  planDescription: string
  planPrice: number
  planType: string
  planFeatures: string[]
}

interface Props {
  plan: PricingPlan
  onEdit: () => void
  onDelete: () => void
}

const PricingCard: React.FC<Props> = ({ plan, onEdit, onDelete }) => {
  const getPeriod = (type: string) => {
    const map: Record<string, string> = {
      monthly: "mo",
      yearly: "yr",
      weekly: "wk",
      quarterly: "qr",
    }
    return map[type] || type
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:shadow-sm">
      <div className="grow space-y-5">
        {/* Plan Name & Description */}
        <div>
          <h3 className="text-xl font-semibold text-foreground">
            {plan.planName}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {plan.planDescription}
          </p>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-foreground">
            ${plan.planPrice}
          </span>
          <span className="text-muted-foreground">
            /{getPeriod(plan.planType)}
          </span>
        </div>

        {/* Features */}
        <div>
          <p className="mb-3 text-xs tracking-widest text-muted-foreground uppercase">
            Features
          </p>
          <ul className="space-y-2.5">
            {plan.planFeatures.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 text-emerald-500">✔</span>
                <span className="text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex gap-3">
        <button
          onClick={onEdit}
          className="flex-1 rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:bg-muted"
        >
          Edit
        </button>

        <button
          onClick={onDelete}
          className="flex-1 rounded-xl border border-destructive/30 bg-destructive/5 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export default PricingCard
