/**
 * Resolves a humanized, translated label for a backend enum/domain value
 * from a `{ value: i18nKey }` map (same convention as
 * INSPECTION_STATUS_LABEL_KEYS in inspectionStatus.ts and RISK_CATEGORIES in
 * riskConfig.ts). Falls back to the raw value for anything not in the map,
 * so an unexpected/legacy value never crashes rendering or silently
 * disappears -- it just shows untranslated instead of humanized.
 */
export function getEnumLabel(
  t: (key: string) => string,
  labelKeys: Record<string, string>,
  value: string
): string {
  const key = labelKeys[value]
  return key ? t(key) : value
}
