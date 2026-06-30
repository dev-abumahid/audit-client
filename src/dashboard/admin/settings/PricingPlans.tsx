import AddPricingModal from "@/components/dashboard/admin/AddPricingModal"
import DeletePricingModal from "@/components/dashboard/admin/DeletePricingModal"
import EditPricingModal from "@/components/dashboard/admin/EditPricingModal"
import PricingCard from "@/components/dashboard/admin/PricingCard"
import { Button } from "@/components/ui/button"
import React, { useState } from "react"

export interface PricingPlan {
  _id: string
  planName: string
  planDescription: string
  planPrice: number
  planType: string
  planFeatures: string[]
  createdAt: string
  updatedAt: string
}

const PricingPlans: React.FC = () => {
  const [openAdd, setOpenAdd] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null)

  // Dummy Pricing Plans
  const pricingPlans: PricingPlan[] = [
    {
      _id: "plan1",
      planName: "Starter",
      planDescription: "Perfect for small teams and startups",
      planPrice: 49,
      planType: "Monthly",
      planFeatures: [
        "Up to 5 users",
        "Basic risk register",
        "Email support",
        "Basic analytics",
      ],
      createdAt: "2025-10-01T00:00:00Z",
      updatedAt: "2025-12-01T00:00:00Z",
    },
    {
      _id: "plan2",
      planName: "Professional",
      planDescription: "Best for growing organizations",
      planPrice: 149,
      planType: "Monthly",
      planFeatures: [
        "Up to 25 users",
        "Advanced risk matrix",
        "Priority support",
        "AI-powered insights",
        "Custom reports",
      ],
      createdAt: "2025-09-15T00:00:00Z",
      updatedAt: "2025-12-10T00:00:00Z",
    },
    {
      _id: "plan3",
      planName: "Enterprise",
      planDescription: "For large organizations with complex needs",
      planPrice: 299,
      planType: "Monthly",
      planFeatures: [
        "Unlimited users",
        "Full risk management suite",
        "Dedicated account manager",
        "SSO & Advanced security",
        "API access",
        "On-premise option",
      ],
      createdAt: "2025-08-20T00:00:00Z",
      updatedAt: "2025-12-05T00:00:00Z",
    },
  ]

  const handleEdit = (plan: PricingPlan) => {
    setSelectedPlan(plan)
    setOpenEdit(true)
  }

  const handleDelete = (plan: PricingPlan) => {
    setSelectedPlan(plan)
    setOpenDelete(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Subscription Plans
          </h2>
          <p className="mt-1 text-muted-foreground">
            Manage pricing tiers and features for your customers
          </p>
        </div>
        <Button
          onClick={() => setOpenAdd(true)}
          className="flex items-center gap-2"
        >
          Add New Plan
        </Button>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {pricingPlans.map((plan) => (
          <PricingCard
            key={plan._id}
            plan={plan}
            onEdit={() => handleEdit(plan)}
            onDelete={() => handleDelete(plan)}
          />
        ))}
      </div>

      {/* Empty State */}
      {pricingPlans.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          No pricing plans found. Click "Add New Plan" to create one.
        </div>
      )}

      {/* Modals */}
      <AddPricingModal open={openAdd} setOpen={setOpenAdd} />

      {selectedPlan && (
        <>
          <EditPricingModal
            open={openEdit}
            setOpen={setOpenEdit}
            plan={selectedPlan}
          />
          <DeletePricingModal
            open={openDelete}
            setOpen={setOpenDelete}
            plan={selectedPlan}
          />
        </>
      )}
    </div>
  )
}

export default PricingPlans
