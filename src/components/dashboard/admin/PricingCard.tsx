import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation()

  const getPeriod = (type: string) => {
    const map: Record<string, string> = {
      monthly: t("admin.settings.pricing.card.periodMonthly"),
      yearly: t("admin.settings.pricing.card.periodYearly"),
      weekly: t("admin.settings.pricing.card.periodWeekly"),
      quarterly: t("admin.settings.pricing.card.periodQuarterly"),
    }
    return map[type.toLowerCase()] || type
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
            {t("admin.settings.pricing.card.features")}
          </p>
          <ul className="space-y-2.5">
            {plan.planFeatures.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex gap-3">
        <Button
          onClick={onEdit}
          variant="outline"
          size="lg"
          className="flex-1 rounded-xl py-3 text-sm"
        >
          {t("admin.settings.pricing.card.edit")}
        </Button>

        <Button
          onClick={onDelete}
          variant="destructive"
          size="lg"
          className="flex-1 rounded-xl py-3 text-sm"
        >
          {t("admin.settings.pricing.card.delete")}
        </Button>
      </div>
    </div>
  )
}

export default PricingCard
