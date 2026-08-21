// Ported verbatim from aexa-server's src/app/modules/kri/kri.service.ts
// (compute_kri_status). KRI status isn't computed client-side anywhere else
// in this codebase -- every KRI arrives from the API with `status` already
// set -- so the landing page's threshold-slider demo (the one place that
// needs to recompute status live, as the user drags a threshold) ports the
// exact server formula rather than inventing a second one that could drift
// from it. If aexa-server's version ever changes, this needs updating too;
// there's no shared package between the two repos to enforce that
// automatically.
export type KriStatus = "OK" | "ALERT" | "WARNING"

/**
 * Status = OK if val >= target, ALERT if val <= alert_threshold, WARNING
 * otherwise -- the exact formula from the AEXA CDC spec (section 7.3). That
 * formula only reads correctly for "higher is better" KRIs (target above
 * threshold, e.g. a coverage %). Real KRIs are mostly the opposite --
 * "Supplier Lead Time" and "Cyber Incidents" are both "lower is better"
 * (target below threshold) -- so the direction is inferred from whether
 * target is above or below alert_threshold, and the same three-way logic is
 * mirrored for that direction.
 */
export const computeKriStatus = (
  currentValue: number,
  alertThreshold: number,
  targetValue: number
): KriStatus => {
  const higherIsBetter = targetValue > alertThreshold
  if (higherIsBetter) {
    if (currentValue >= targetValue) return "OK"
    if (currentValue <= alertThreshold) return "ALERT"
    return "WARNING"
  }
  if (currentValue <= targetValue) return "OK"
  if (currentValue >= alertThreshold) return "ALERT"
  return "WARNING"
}
