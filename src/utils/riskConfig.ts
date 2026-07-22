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
