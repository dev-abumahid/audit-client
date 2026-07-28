// A `datetime-local` input's value is a LOCAL wall-clock string with no
// offset info, but `Date#toISOString()` always renders UTC. Naively slicing
// an ISO string (or a Date's own toISOString()) into the input therefore
// silently reinterprets a UTC (or otherwise-local) instant as if it were
// already local time, shifting it by the machine's UTC offset. Subtracting
// the offset before formatting corrects for that: it shifts the instant so
// that formatting it "as UTC" reproduces the original local wall-clock
// values. This is the exact inverse of `new Date(value).toISOString()`,
// which callers use to go from the input's value back to a real UTC instant
// (aexa-frontend#238).
export function toLocalDatetimeInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

// A due-date-*only* value -- a bare `YYYY-MM-DD` from a `type="date"` input,
// or its serialized form over JSON -- represents a calendar day, not a
// specific instant, and should always be read back as the same calendar day
// it was written, everywhere. Handing it to `new Date(...)` and formatting
// with `toLocaleDateString` parses it as a UTC instant but renders it in the
// browser's LOCAL timezone, which rolls the displayed day backward one day
// for anyone at a negative UTC offset -- e.g.
// `new Date("2026-07-28").toLocaleDateString()` shows "Jul 27" at UTC-5.
// This is the read-side twin of the write-side bug #238 fixed for
// `datetime-local` inputs, but a distinct mechanism: there's no local
// wall-clock round trip to correct for here.
//
// `due_date` is genuinely always UTC midnight in practice, since the
// `type="date"` input (CompliancePage.tsx) only ever sends a bare
// `YYYY-MM-DD`. `next_review_date`, however, is NOT always UTC midnight --
// aexa-server's compliance.service.ts recomputes it from the real
// attestation clock time (`attest_compliance_into_db`) or creation time,
// giving it a genuine non-zero time-of-day component in practice (e.g.
// `"2027-03-01T23:50:00.000Z"`). Both are still surfaced as a single
// calendar day in this UI (see the `nextReviewShort`/`nextReview` labels),
// so truncating to the UTC calendar-date portion below is intentional for
// both fields, not an assumption that happens to hold only for `due_date`.
//
// Fix: parse the Y/M/D components straight out of the string (skip `Date`
// parsing of the raw string) and format via an explicit `timeZone: "UTC"`,
// so the browser's local offset never enters the calculation at all
// (aexa-frontend#244).
export function formatDateOnlyForDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}
