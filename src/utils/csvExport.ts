// Extracted from RiskGraphPage's export feature (aexa-frontend#577) so the
// Risk Register's own CSV export (quality-bar-loop industry-standards axis)
// doesn't reimplement the same CSV-injection-safe escaping from scratch.

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Free-text fields (name, category, ref, etc.) aren't sanitized before
// export -- a cell starting with =, +, -, or @ executes as a formula when
// the CSV is opened in Excel/LibreOffice ("CSV injection"), e.g. a risk
// named =HYPERLINK("http://evil","x"). Prefixing with a leading apostrophe
// is the standard mitigation: Excel treats a leading `'` as "force text"
// and doesn't display it, so a legitimate value is unaffected.
//
// Text fields only, not numeric columns: a leading `-` also matches this
// same regex, and a legitimately negative number would otherwise get
// force-text-prefixed too, silently turning a real number column into text
// in the exported spreadsheet (breaks SUM/sorting-as-number) for a value
// that was never attacker-controlled input in the first place.
export function csvTextField(value: string) {
  const escaped = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\n]/.test(escaped) ? `"${escaped.replace(/"/g, '""')}"` : escaped
}
