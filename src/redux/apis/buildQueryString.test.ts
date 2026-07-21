import { buildQueryString } from "./buildQueryString"

describe("buildQueryString", () => {
  it("encodes special characters (&, =, #) in values", () => {
    const qs = buildQueryString({ searchTerm: "a&b=c#d" })
    expect(qs).toBe("searchTerm=a%26b%3Dc%23d")
  })

  it("joins multiple params with &", () => {
    const qs = buildQueryString({ page: 1, limit: 10, searchTerm: "leak" })
    expect(qs).toBe("page=1&limit=10&searchTerm=leak")
  })

  it("omits keys whose value is undefined", () => {
    const qs = buildQueryString({
      page: 1,
      searchTerm: "x",
      inspectionId: undefined,
    })
    expect(qs).toBe("page=1&searchTerm=x")
  })

  it("round-trips through URLSearchParams so the server sees the original value", () => {
    const raw = "risk & rate = 100% #critical"
    const qs = buildQueryString({ searchTerm: raw })
    expect(new URLSearchParams(qs).get("searchTerm")).toBe(raw)
  })
})
