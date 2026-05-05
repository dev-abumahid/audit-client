export const RISK_CATEGORIES: Record<string, { label: string; color: string }> =
  {
    supply_chain: { label: "Supply Chain", color: "hsl(0, 72%, 51%)" },
    financial: { label: "Financial", color: "hsl(25, 95%, 53%)" },
    regulatory: { label: "Regulatory", color: "hsl(280, 65%, 60%)" },
    cyber: { label: "Cyber", color: "hsl(199, 89%, 48%)" },
    operational: { label: "Operational", color: "hsl(38, 92%, 50%)" },
    hr: { label: "Human Resources", color: "hsl(330, 80%, 60%)" },
    strategic: { label: "Strategic", color: "hsl(240, 60%, 60%)" },
    ehs: { label: "EHS / Environment", color: "hsl(142, 71%, 45%)" },
    geopolitical: { label: "Geopolitical", color: "hsl(210, 70%, 50%)" },
    natural_disaster: {
      label: "Natural Disasters",
      color: "hsl(30, 80%, 45%)",
    },
    technology: { label: "Technology", color: "hsl(190, 75%, 45%)" },
    reputational: { label: "Reputation", color: "hsl(350, 70%, 55%)" },
    compliance: { label: "Compliance", color: "hsl(270, 55%, 50%)" },
    ai_emerging: { label: "AI & Emerging Risks", color: "hsl(160, 60%, 40%)" },
    fire: { label: "Fire", color: "hsl(10, 85%, 50%)" },
    electrical: { label: "Electrical", color: "hsl(45, 90%, 50%)" },
    atex: { label: "ATEX / Explosive", color: "hsl(15, 90%, 55%)" },
    machine_safety: { label: "Machine Safety", color: "hsl(200, 60%, 50%)" },
    environmental: { label: "Environmental", color: "hsl(120, 55%, 40%)" },
    security_physical: {
      label: "Physical Security",
      color: "hsl(0, 50%, 40%)",
    },
  }

export const SEVERITY_CONFIG = {
  critical: {
    label: "Critique",
    bg: "bg-risk-critical/15",
    text: "text-risk-critical",
    dot: "bg-risk-critical",
  },
  high: {
    label: "Élevé",
    bg: "bg-risk-high/15",
    text: "text-risk-high",
    dot: "bg-risk-high",
  },
  medium: {
    label: "Moyen",
    bg: "bg-risk-medium/15",
    text: "text-risk-medium",
    dot: "bg-risk-medium",
  },
  low: {
    label: "Faible",
    bg: "bg-risk-low/15",
    text: "text-risk-low",
    dot: "bg-risk-low",
  },
} as const

export const AUDIT_STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  planned: { label: "Planifié", bg: "bg-risk-info/10", text: "text-risk-info" },
  in_progress: {
    label: "En cours",
    bg: "bg-risk-medium/10",
    text: "text-risk-medium",
  },
  completed: { label: "Terminé", bg: "bg-risk-low/10", text: "text-risk-low" },
}

export const COMPLIANCE_STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  compliant: { label: "Conforme", bg: "bg-risk-low/10", text: "text-risk-low" },
  partial: {
    label: "Partiel",
    bg: "bg-risk-medium/10",
    text: "text-risk-medium",
  },
  non_compliant: {
    label: "Non conforme",
    bg: "bg-risk-critical/10",
    text: "text-risk-critical",
  },
  pending: {
    label: "En attente",
    bg: "bg-muted",
    text: "text-muted-foreground",
  },
}

export const VELOCITY_LABELS: Record<string, string> = {
  very_high: "Très rapide",
  high: "Rapide",
  medium: "Modérée",
  low: "Lente",
}

export const TREND_CONFIG: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  worsening: { label: "Dégradation", icon: "↗", color: "text-risk-critical" },
  stable: { label: "Stable", icon: "→", color: "text-muted-foreground" },
  improving: { label: "Amélioration", icon: "↘", color: "text-risk-low" },
}

export const RISK_STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  draft: { label: "Brouillon", bg: "bg-muted", text: "text-muted-foreground" },
  pending_approval: {
    label: "En approbation",
    bg: "bg-risk-medium/10",
    text: "text-risk-medium",
  },
  open: { label: "Ouvert", bg: "bg-risk-high/10", text: "text-risk-high" },
  approved: { label: "Approuvé", bg: "bg-primary/10", text: "text-primary" },
  in_progress: {
    label: "En cours",
    bg: "bg-risk-info/10",
    text: "text-risk-info",
  },
  escalated: {
    label: "Escaladé",
    bg: "bg-risk-critical/10",
    text: "text-risk-critical",
  },
  resolved: { label: "Résolu", bg: "bg-risk-low/10", text: "text-risk-low" },
  closed: { label: "Fermé", bg: "bg-muted", text: "text-muted-foreground" },
}

export const MITIGATION_TYPE_CONFIG: Record<
  string,
  { label: string; icon: string }
> = {
  prevent: { label: "Prévention", icon: "🛡️" },
  detect: { label: "Détection", icon: "🔍" },
  correct: { label: "Correction", icon: "🔧" },
  transfer: { label: "Transfert", icon: "↔️" },
  accept: { label: "Acceptation", icon: "✓" },
}

export const INTELLIGENCE_CATEGORIES = [
  "cyber_official",
  "cyber_media",
  "cyber_threat_intel",
  "geopolitical",
  "financial",
  "regulatory",
  "operational",
  "natural",
  "health",
  "ai_tech",
] as const
