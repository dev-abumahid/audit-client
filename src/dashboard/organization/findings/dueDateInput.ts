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
