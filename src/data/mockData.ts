// AEXA Mock Data — Risk Intelligence Platform — CEBI International S.A.

export interface Organization {
  id: string
  name: string
  sector: string
  countryHq: string
  revenueEstimate: number
  ebitda: number
  employeesCount: number
  currency: string
}

export interface Risk {
  id: string
  ref: string
  name: string
  description: string
  category: string
  inherentScore: number
  residualScore: number
  pagerankScore: number
  isTippingPoint: boolean
  financialImpactMin: number
  financialImpactMax: number
  probability: number
  velocity: string
  trend: string
  status: string
  owner: string
  colorHex: string
}

export interface KRI {
  id: string
  riskRef: string
  name: string
  unit: string
  currentValue: number
  alertThreshold: number
  targetValue: number
  status: "ok" | "warning" | "alert"
  trend: number[]
  frequency: string
}

export interface Alert {
  id: string
  source: string
  type: string
  severity: "critical" | "high" | "medium" | "low"
  title: string
  description: string
  relevanceScore: number
  matchedRisks: string[]
  createdAt: string
  country?: string
}

export interface AuditEngagement {
  id: string
  ref: string
  title: string
  scope: string
  status: string
  leadAuditor: string
  priorityScore: number
  findingsCount: number
  startedAt?: string
  closedAt?: string
}

export interface ComplianceObligation {
  id: string
  regulation: string
  jurisdiction: string
  description: string
  deadline: string
  status: "compliant" | "partial" | "non_compliant" | "pending"
  penaltyEstimate: number
  owner: string
}

export const mockOrganization: Organization = {
  id: "org-001",
  name: "CEBI International S.A.",
  sector: "Composants électromécaniques / Capteurs automobiles",
  countryHq: "LU",
  revenueEstimate: 180000,
  ebitda: 22000,
  employeesCount: 2800,
  currency: "EUR",
}

export const mockRisks: Risk[] = [
  {
    id: "r1",
    ref: "SC-01",
    name: "Pénurie semi-conducteurs & composants électroniques",
    description:
      "Dépendance critique envers fournisseurs asiatiques de puces NTC, MEMS et microcontrôleurs. Lead times passés de 12 à 38 semaines. Stocks tampons < 3 semaines.",
    category: "supply_chain",
    inherentScore: 21.5,
    residualScore: 15.1,
    pagerankScore: 91.2,
    isTippingPoint: true,
    financialImpactMin: 8000,
    financialImpactMax: 25000,
    probability: 0.4,
    velocity: "high",
    trend: "worsening",
    status: "open",
    owner: "M. Schmit",
    colorHex: "#EF4444",
  },
  {
    id: "r2",
    ref: "ST-01",
    name: "Transition véhicules électriques (EV)",
    description:
      "Passage accéléré aux VE par les OEMs. 35% du CA actuel lié à capteurs moteurs thermiques (température huile, pression turbo). Risque d'obsolescence produits si transition pas assez rapide.",
    category: "strategic",
    inherentScore: 19.8,
    residualScore: 13.9,
    pagerankScore: 84.7,
    isTippingPoint: true,
    financialImpactMin: 15000,
    financialImpactMax: 45000,
    probability: 0.5,
    velocity: "medium",
    trend: "worsening",
    status: "open",
    owner: "Mme Elvinger",
    colorHex: "#F97316",
  },
  {
    id: "r3",
    ref: "OP-01",
    name: "Défaut qualité capteurs — rappel client OEM",
    description:
      "Risque de lot défectueux sur capteurs de température NTC pour Stellantis/VW. Coûts de rappel et garantie estimés à €5-18M. Taux PPM actuel: 12 (cible: <5).",
    category: "operational",
    inherentScore: 20.1,
    residualScore: 12.1,
    pagerankScore: 76.3,
    isTippingPoint: true,
    financialImpactMin: 5000,
    financialImpactMax: 18000,
    probability: 0.25,
    velocity: "very_high",
    trend: "stable",
    status: "open",
    owner: "M. Weber",
    colorHex: "#EF4444",
  },
  {
    id: "r4",
    ref: "FI-01",
    name: "Pression prix OEMs automobiles",
    description:
      "Demandes de réduction annuelle de 3-5% par Stellantis, VW Group et Renault. Marges brutes comprimées de 28% à 23% en 3 ans. Pouvoir de négociation limité en tant que Tier-2.",
    category: "financial",
    inherentScore: 17.2,
    residualScore: 13.8,
    pagerankScore: 68.5,
    isTippingPoint: false,
    financialImpactMin: 4000,
    financialImpactMax: 12000,
    probability: 0.7,
    velocity: "medium",
    trend: "worsening",
    status: "open",
    owner: "Mme Reding",
    colorHex: "#F97316",
  },
  {
    id: "r5",
    ref: "CY-01",
    name: "Cyberattaque sur systèmes de production IoT",
    description:
      "Lignes de production connectées (Industry 4.0) exposées. 23 CVE identifiées sur automates Siemens S7. Usines de Steinsel et Jászberény potentiellement vulnérables.",
    category: "cyber",
    inherentScore: 18.9,
    residualScore: 11.3,
    pagerankScore: 72.1,
    isTippingPoint: false,
    financialImpactMin: 3000,
    financialImpactMax: 15000,
    probability: 0.15,
    velocity: "very_high",
    trend: "worsening",
    status: "open",
    owner: "M. Hoffmann",
    colorHex: "#EAB308",
  },
  {
    id: "r6",
    ref: "RE-01",
    name: "Non-conformité CSRD / taxonomie UE",
    description:
      "Obligation reporting durabilité ESRS applicable dès 2025. Données carbone scope 3 incomplètes (couverture 40%). Risque de non-conformité et exclusion appels d'offres OEM.",
    category: "regulatory",
    inherentScore: 15.6,
    residualScore: 10.9,
    pagerankScore: 58.4,
    isTippingPoint: false,
    financialImpactMin: 2000,
    financialImpactMax: 8000,
    probability: 0.45,
    velocity: "medium",
    trend: "stable",
    status: "open",
    owner: "Mme Muller",
    colorHex: "#EAB308",
  },
  {
    id: "r7",
    ref: "HR-01",
    name: "Pénurie ingénieurs R&D capteurs embarqués",
    description:
      "Difficulté à recruter ingénieurs spécialisés en MEMS, CEM et firmware embarqué au Luxembourg. Délai moyen recrutement: 6.5 mois. Turnover R&D: 14%. Nouveau lab EMC nécessite +15 ETP.",
    category: "hr",
    inherentScore: 14.5,
    residualScore: 10.2,
    pagerankScore: 45.3,
    isTippingPoint: false,
    financialImpactMin: 1500,
    financialImpactMax: 5000,
    probability: 0.6,
    velocity: "low",
    trend: "worsening",
    status: "open",
    owner: "Mme Kremer",
    colorHex: "#EAB308",
  },
  {
    id: "r8",
    ref: "SC-02",
    name: "Concentration géographique usines (Hongrie/Chine)",
    description:
      "Sites de production principaux à Jászberény (Hongrie) et Ningbo (Chine). Exposition aux risques géopolitiques UE-Chine et perturbations logistiques. 65% de la capacité hors Luxembourg.",
    category: "supply_chain",
    inherentScore: 16.8,
    residualScore: 11.8,
    pagerankScore: 62.7,
    isTippingPoint: false,
    financialImpactMin: 6000,
    financialImpactMax: 20000,
    probability: 0.3,
    velocity: "medium",
    trend: "stable",
    status: "open",
    owner: "M. Schmit",
    colorHex: "#F97316",
  },
]

export const mockKRIs: KRI[] = [
  {
    id: "k1",
    riskRef: "SC-01",
    name: "Lead time moyen composants critiques",
    unit: "semaines",
    currentValue: 38,
    alertThreshold: 20,
    targetValue: 12,
    status: "alert",
    trend: [14, 18, 24, 30, 35, 38],
    frequency: "weekly",
  },
  {
    id: "k2",
    riskRef: "ST-01",
    name: "Part CA produits EV-compatible",
    unit: "%",
    currentValue: 28,
    alertThreshold: 35,
    targetValue: 50,
    status: "alert",
    trend: [15, 18, 20, 23, 25, 28],
    frequency: "quarterly",
  },
  {
    id: "k3",
    riskRef: "OP-01",
    name: "Taux PPM défauts capteurs",
    unit: "ppm",
    currentValue: 12,
    alertThreshold: 8,
    targetValue: 5,
    status: "alert",
    trend: [6, 7, 8, 9, 11, 12],
    frequency: "monthly",
  },
  {
    id: "k4",
    riskRef: "FI-01",
    name: "Marge brute moyenne OEM",
    unit: "%",
    currentValue: 23.1,
    alertThreshold: 25,
    targetValue: 30,
    status: "alert",
    trend: [28.2, 27.1, 26.0, 25.1, 24.2, 23.1],
    frequency: "quarterly",
  },
  {
    id: "k5",
    riskRef: "CY-01",
    name: "CVE critiques non patchées",
    unit: "count",
    currentValue: 23,
    alertThreshold: 10,
    targetValue: 0,
    status: "alert",
    trend: [8, 11, 14, 17, 20, 23],
    frequency: "weekly",
  },
  {
    id: "k6",
    riskRef: "HR-01",
    name: "Délai moyen recrutement R&D",
    unit: "mois",
    currentValue: 6.5,
    alertThreshold: 4,
    targetValue: 2.5,
    status: "alert",
    trend: [3.2, 3.8, 4.5, 5.2, 5.9, 6.5],
    frequency: "monthly",
  },
  {
    id: "k7",
    riskRef: "RE-01",
    name: "Couverture données Scope 3",
    unit: "%",
    currentValue: 40,
    alertThreshold: 60,
    targetValue: 95,
    status: "alert",
    trend: [20, 25, 28, 32, 36, 40],
    frequency: "quarterly",
  },
  {
    id: "k8",
    riskRef: "SC-02",
    name: "Stock sécurité composants critiques",
    unit: "semaines",
    currentValue: 2.8,
    alertThreshold: 4,
    targetValue: 8,
    status: "alert",
    trend: [6.5, 5.8, 5.0, 4.2, 3.5, 2.8],
    frequency: "weekly",
  },
]

export const mockAlerts: Alert[] = [
  {
    id: "a1",
    source: "Reuters",
    type: "market",
    severity: "critical",
    title:
      "TSMC réduit ses capacités 28nm — impact direct sur puces NTC automobile",
    description:
      "TSMC annonce une réduction de 12% de ses capacités sur le nœud 28nm au profit du 3nm. Les délais pour les puces NTC et microcontrôleurs automobiles pourraient s'allonger de 6 à 8 semaines supplémentaires.",
    relevanceScore: 0.96,
    matchedRisks: ["SC-01"],
    createdAt: "2026-03-21T07:45:00Z",
    country: "TW",
  },
  {
    id: "a2",
    source: "Automotive News",
    type: "market",
    severity: "critical",
    title:
      "Stellantis accélère fin moteurs thermiques — objectif 100% EV en 2028",
    description:
      "Stellantis (client majeur de CEBI) avance son objectif de transition tout-électrique de 2030 à 2028 pour l'Europe. Les capteurs de température huile et pression turbo seront obsolètes plus tôt que prévu.",
    relevanceScore: 0.93,
    matchedRisks: ["ST-01"],
    createdAt: "2026-03-21T06:00:00Z",
  },
  {
    id: "a3",
    source: "EUR-Lex",
    type: "regulatory",
    severity: "high",
    title:
      "CSRD — standards ESRS révisés : nouvelles obligations Scope 3 pour PME industrielles",
    description:
      "La Commission européenne publie les standards ESRS révisés. Les entreprises de taille intermédiaire (250-3000 employés) devront inclure les émissions Scope 3 dans leur rapport de durabilité dès 2026.",
    relevanceScore: 0.89,
    matchedRisks: ["RE-01"],
    createdAt: "2026-03-20T14:30:00Z",
  },
  {
    id: "a4",
    source: "CISA",
    type: "cyber",
    severity: "high",
    title:
      "CVE-2026-3847 : Vulnérabilité critique Siemens SIMATIC S7-1200/1500",
    description:
      "Exécution de code à distance sur automates Siemens S7-1200 et S7-1500 (CVSS 9.6). Exploit actif confirmé dans le secteur manufacturier. Patch disponible.",
    relevanceScore: 0.87,
    matchedRisks: ["CY-01"],
    createdAt: "2026-03-20T09:15:00Z",
  },
  {
    id: "a5",
    source: "Bloomberg",
    type: "market",
    severity: "high",
    title:
      "Tensions UE-Chine : Bruxelles envisage tarifs sur composants électroniques chinois",
    description:
      "La Commission européenne étudie des droits compensatoires de 15-25% sur les composants électroniques importés de Chine, incluant les capteurs et sous-ensembles assemblés.",
    relevanceScore: 0.84,
    matchedRisks: ["SC-02"],
    createdAt: "2026-03-19T16:00:00Z",
    country: "CN",
  },
  {
    id: "a6",
    source: "VW Group",
    type: "market",
    severity: "medium",
    title:
      "VW Group lance appel d'offres capteurs thermiques nouvelle plateforme SSP",
    description:
      "Volkswagen Group ouvre un RFQ pour les capteurs de température et pression de sa plateforme SSP (Scalable Systems Platform). Volume estimé: 2.4M unités/an à partir de 2028.",
    relevanceScore: 0.78,
    matchedRisks: ["ST-01", "FI-01"],
    createdAt: "2026-03-19T11:30:00Z",
    country: "DE",
  },
]

export const mockAuditEngagements: AuditEngagement[] = [
  {
    id: "ae1",
    ref: "AUD-2026-001",
    title: "Audit résilience supply chain semi-conducteurs",
    scope:
      "Fournisseurs Tier-1/Tier-2 puces NTC & MEMS, stocks sécurité, plans de contingence, dual-sourcing",
    status: "in_progress",
    leadAuditor: "Sophie Faber",
    priorityScore: 93.1,
    findingsCount: 4,
    startedAt: "2026-02-10",
  },
  {
    id: "ae2",
    ref: "AUD-2026-002",
    title: "Audit cybersécurité OT/IoT usines",
    scope:
      "Automates Siemens S7, réseau OT Steinsel & Jászberény, segmentation, patching, accès distants",
    status: "planned",
    leadAuditor: "Thomas Reuter",
    priorityScore: 85.7,
    findingsCount: 0,
  },
  {
    id: "ae3",
    ref: "AUD-2026-003",
    title: "Audit qualité processus capteurs NTC",
    scope:
      "IATF 16949, contrôle SPC, traçabilité lots, gestion non-conformités, taux PPM",
    status: "in_progress",
    leadAuditor: "Isabelle Lentz",
    priorityScore: 81.4,
    findingsCount: 2,
    startedAt: "2026-01-20",
  },
  {
    id: "ae4",
    ref: "AUD-2026-004",
    title: "Audit conformité CSRD & taxonomie verte",
    scope:
      "Données carbone Scope 1/2/3, double matérialité, KPIs ESRS, processus de collecte",
    status: "planned",
    leadAuditor: "Marc Biver",
    priorityScore: 74.2,
    findingsCount: 0,
  },
  {
    id: "ae5",
    ref: "AUD-2026-005",
    title: "Audit stratégie transition EV",
    scope:
      "Roadmap produits EV, investissements R&D, diversification portefeuille, pipeline nouveaux capteurs",
    status: "completed",
    leadAuditor: "Sophie Faber",
    priorityScore: 71.8,
    findingsCount: 6,
    startedAt: "2025-11-15",
    closedAt: "2026-01-31",
  },
]

export const mockCompliance: ComplianceObligation[] = [
  {
    id: "c1",
    regulation: "CSRD / ESRS",
    jurisdiction: "UE",
    description:
      "Rapport durabilité selon standards ESRS — double matérialité, émissions Scope 1/2/3",
    deadline: "2026-12-31",
    status: "partial",
    penaltyEstimate: 500000,
    owner: "Mme Muller",
  },
  {
    id: "c2",
    regulation: "IATF 16949",
    jurisdiction: "International",
    description:
      "Certification qualité automobile — renouvellement audit de surveillance",
    deadline: "2026-06-30",
    status: "compliant",
    penaltyEstimate: 2000000,
    owner: "M. Weber",
  },
  {
    id: "c3",
    regulation: "NIS2 Directive",
    jurisdiction: "UE",
    description:
      "Mise en conformité cybersécurité entités essentielles — notification incidents 24h",
    deadline: "2026-06-30",
    status: "non_compliant",
    penaltyEstimate: 5000000,
    owner: "M. Hoffmann",
  },
  {
    id: "c4",
    regulation: "REACH",
    jurisdiction: "UE",
    description:
      "Enregistrement substances chimiques (brasure, résines époxy) utilisées dans production capteurs",
    deadline: "2026-09-30",
    status: "compliant",
    penaltyEstimate: 150000,
    owner: "M. Weber",
  },
  {
    id: "c5",
    regulation: "RoHS III",
    jurisdiction: "UE",
    description:
      "Conformité restriction substances dangereuses dans composants électroniques",
    deadline: "2026-07-01",
    status: "compliant",
    penaltyEstimate: 300000,
    owner: "M. Weber",
  },
  {
    id: "c6",
    regulation: "EU AI Act",
    jurisdiction: "UE",
    description:
      "Classification systèmes IA embarqués dans capteurs intelligents — auto-évaluation requise",
    deadline: "2026-08-02",
    status: "pending",
    penaltyEstimate: 1500000,
    owner: "Mme Elvinger",
  },
  {
    id: "c7",
    regulation: "Loi luxembourgeoise sur le devoir de vigilance",
    jurisdiction: "LU",
    description:
      "Plan de vigilance — droits humains et environnement dans la chaîne de valeur",
    deadline: "2026-12-31",
    status: "partial",
    penaltyEstimate: 800000,
    owner: "Mme Kremer",
  },
]

export const riskCategories: Record<string, { label: string; color: string }> =
  {
    supply_chain: { label: "Supply Chain", color: "#EF4444" },
    financial: { label: "Financier", color: "#F97316" },
    regulatory: { label: "Réglementaire", color: "#8B5CF6" },
    cyber: { label: "Cyber", color: "#06B6D4" },
    operational: { label: "Opérationnel", color: "#EAB308" },
    hr: { label: "Ressources Humaines", color: "#EC4899" },
    strategic: { label: "Stratégique", color: "#6366F1" },
    ehs: { label: "EHS / Environnement", color: "#22C55E" },
  }
