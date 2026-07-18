// decodeURIComponent throws a URIError on a malformed percent-escape (e.g.
// a filename with a raw "%" not followed by two hex digits) — falling back
// to the raw (undecoded) name rather than crashing whatever renders it.
export function attachmentFileName(url: string) {
  try {
    return decodeURIComponent(url.split("/").pop() || "file")
  } catch {
    return url.split("/").pop() || "file"
  }
}
