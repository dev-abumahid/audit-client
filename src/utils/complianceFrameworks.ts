// Curated catalog of common regulatory/framework controls, used to give the
// Compliance obligation form's `regulation_reference` field a searchable,
// structured catalog (via a native <datalist>) instead of pure free text --
// quality-bar-loop industry-standards finding: reference GRC tools (Vanta,
// Drata, OneTrust) let an obligation reference a controlled framework
// control rather than an arbitrary string. `regulation_reference` on the
// backend stays a plain string (no schema migration), so a value typed here
// is still just text -- but a value that exactly matches `label` below is
// recognized and rendered as a structured framework badge in the table
// (see frameworkForReference in this file), and free text outside this
// catalog remains fully supported for obligations tied to a
// framework/regulation not listed here.
export interface ComplianceFrameworkControl {
  framework: string
  code: string
  title: string
  /** Canonical string stored in/matched against regulation_reference. */
  label: string
}

export const COMPLIANCE_FRAMEWORK_CONTROLS: ComplianceFrameworkControl[] = [
  // GDPR
  { framework: "GDPR", code: "Art. 5", title: "Principles relating to processing of personal data", label: "GDPR Art. 5 — Principles relating to processing of personal data" },
  { framework: "GDPR", code: "Art. 6", title: "Lawfulness of processing", label: "GDPR Art. 6 — Lawfulness of processing" },
  { framework: "GDPR", code: "Art. 15", title: "Right of access by the data subject", label: "GDPR Art. 15 — Right of access by the data subject" },
  { framework: "GDPR", code: "Art. 17", title: "Right to erasure ('right to be forgotten')", label: "GDPR Art. 17 — Right to erasure ('right to be forgotten')" },
  { framework: "GDPR", code: "Art. 25", title: "Data protection by design and by default", label: "GDPR Art. 25 — Data protection by design and by default" },
  { framework: "GDPR", code: "Art. 30", title: "Records of processing activities", label: "GDPR Art. 30 — Records of processing activities" },
  { framework: "GDPR", code: "Art. 32", title: "Security of processing", label: "GDPR Art. 32 — Security of processing" },
  { framework: "GDPR", code: "Art. 33", title: "Notification of a personal data breach to the supervisory authority", label: "GDPR Art. 33 — Notification of a personal data breach to the supervisory authority" },
  { framework: "GDPR", code: "Art. 35", title: "Data protection impact assessment", label: "GDPR Art. 35 — Data protection impact assessment" },

  // SOC 2 (Trust Services Criteria, Common Criteria series)
  { framework: "SOC 2", code: "CC1.1", title: "Demonstrates commitment to integrity and ethical values", label: "SOC 2 CC1.1 — Demonstrates commitment to integrity and ethical values" },
  { framework: "SOC 2", code: "CC2.1", title: "Communicates information to support internal control", label: "SOC 2 CC2.1 — Communicates information to support internal control" },
  { framework: "SOC 2", code: "CC5.1", title: "Selects and develops control activities", label: "SOC 2 CC5.1 — Selects and develops control activities" },
  { framework: "SOC 2", code: "CC6.1", title: "Logical and physical access controls", label: "SOC 2 CC6.1 — Logical and physical access controls" },
  { framework: "SOC 2", code: "CC6.6", title: "Protects against threats from sources outside system boundaries", label: "SOC 2 CC6.6 — Protects against threats from sources outside system boundaries" },
  { framework: "SOC 2", code: "CC7.2", title: "Monitors system components for anomalies", label: "SOC 2 CC7.2 — Monitors system components for anomalies" },
  { framework: "SOC 2", code: "CC7.4", title: "Responds to identified security incidents", label: "SOC 2 CC7.4 — Responds to identified security incidents" },
  { framework: "SOC 2", code: "CC9.2", title: "Manages risks associated with vendors and business partners", label: "SOC 2 CC9.2 — Manages risks associated with vendors and business partners" },

  // ISO/IEC 27001:2022 (Annex A)
  { framework: "ISO 27001", code: "A.5.1", title: "Policies for information security", label: "ISO 27001 A.5.1 — Policies for information security" },
  { framework: "ISO 27001", code: "A.5.9", title: "Inventory of information and other associated assets", label: "ISO 27001 A.5.9 — Inventory of information and other associated assets" },
  { framework: "ISO 27001", code: "A.5.23", title: "Information security for use of cloud services", label: "ISO 27001 A.5.23 — Information security for use of cloud services" },
  { framework: "ISO 27001", code: "A.6.3", title: "Information security awareness, education and training", label: "ISO 27001 A.6.3 — Information security awareness, education and training" },
  { framework: "ISO 27001", code: "A.8.1", title: "User endpoint devices", label: "ISO 27001 A.8.1 — User endpoint devices" },
  { framework: "ISO 27001", code: "A.8.8", title: "Management of technical vulnerabilities", label: "ISO 27001 A.8.8 — Management of technical vulnerabilities" },
  { framework: "ISO 27001", code: "A.8.16", title: "Monitoring activities", label: "ISO 27001 A.8.16 — Monitoring activities" },
  { framework: "ISO 27001", code: "A.8.24", title: "Use of cryptography", label: "ISO 27001 A.8.24 — Use of cryptography" },

  // HIPAA
  { framework: "HIPAA", code: "164.308", title: "Administrative safeguards", label: "HIPAA 164.308 — Administrative safeguards" },
  { framework: "HIPAA", code: "164.310", title: "Physical safeguards", label: "HIPAA 164.310 — Physical safeguards" },
  { framework: "HIPAA", code: "164.312", title: "Technical safeguards", label: "HIPAA 164.312 — Technical safeguards" },
  { framework: "HIPAA", code: "164.316", title: "Policies, procedures, and documentation requirements", label: "HIPAA 164.316 — Policies, procedures, and documentation requirements" },

  // PCI DSS v4.0
  { framework: "PCI DSS", code: "Req. 1", title: "Install and maintain network security controls", label: "PCI DSS Req. 1 — Install and maintain network security controls" },
  { framework: "PCI DSS", code: "Req. 3", title: "Protect stored account data", label: "PCI DSS Req. 3 — Protect stored account data" },
  { framework: "PCI DSS", code: "Req. 6", title: "Develop and maintain secure systems and software", label: "PCI DSS Req. 6 — Develop and maintain secure systems and software" },
  { framework: "PCI DSS", code: "Req. 8", title: "Identify users and authenticate access to system components", label: "PCI DSS Req. 8 — Identify users and authenticate access to system components" },
  { framework: "PCI DSS", code: "Req. 10", title: "Log and monitor all access to system components and cardholder data", label: "PCI DSS Req. 10 — Log and monitor all access to system components and cardholder data" },
  { framework: "PCI DSS", code: "Req. 12", title: "Support information security with organizational policies and programs", label: "PCI DSS Req. 12 — Support information security with organizational policies and programs" },

  // CCPA / CPRA
  { framework: "CCPA", code: "1798.100", title: "Consumer right to know about personal information collected", label: "CCPA 1798.100 — Consumer right to know about personal information collected" },
  { framework: "CCPA", code: "1798.105", title: "Consumer right to delete personal information", label: "CCPA 1798.105 — Consumer right to delete personal information" },
  { framework: "CCPA", code: "1798.150", title: "Private right of action for data breaches", label: "CCPA 1798.150 — Private right of action for data breaches" },
]

const CONTROL_BY_LABEL = new Map(
  COMPLIANCE_FRAMEWORK_CONTROLS.map((control) => [control.label, control])
)

/** Returns the matching catalog control when `reference` is an exact, recognized value -- undefined for custom/free-text references. */
export function frameworkForReference(
  reference: string | null | undefined
): ComplianceFrameworkControl | undefined {
  if (!reference) return undefined
  return CONTROL_BY_LABEL.get(reference)
}
