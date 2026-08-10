// A slider question's `value` (the template-configured default) is
// free-form template data, not guaranteed to be a real number -- a
// non-numeric configured default (e.g. "text") previously flowed straight
// through as the initial answer, live-confirmed rendering the literal
// string under the slider handle in a submitted inspection while the
// native <input type="range"> silently clamped its own DOM value to 5.
// Falls back to 5 (the slider's own default) for anything that isn't a
// genuine finite number.
//
// Only `number` and non-blank numeric strings are accepted -- plain
// `Number(value)` coercion (review follow-up) would silently turn a
// boolean into 1/0 or a whitespace-only string into 0, producing a
// wrong-but-plausible default instead of the intended fallback.
export function parseSliderDefault(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 5
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 5
}
