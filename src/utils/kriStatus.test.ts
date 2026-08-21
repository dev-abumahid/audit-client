import { computeKriStatus } from "./kriStatus"

// Mirrors aexa-server's own compute_kri_status test cases verbatim
// (src/__tests__/security/kri.service.test.ts) -- since this is a ported
// copy of that server function, proving it agrees with the server's own
// test fixtures is the actual regression test that matters, not just
// exercising the branches in isolation.
describe("computeKriStatus", () => {
  it("higher-is-better (target above threshold): OK above target", () => {
    expect(computeKriStatus(90, 50, 80)).toBe("OK")
  })

  it("higher-is-better: ALERT at or below threshold", () => {
    expect(computeKriStatus(40, 50, 80)).toBe("ALERT")
    expect(computeKriStatus(50, 50, 80)).toBe("ALERT")
  })

  it("higher-is-better: WARNING strictly between threshold and target", () => {
    expect(computeKriStatus(65, 50, 80)).toBe("WARNING")
  })

  it("lower-is-better (target below threshold, e.g. Supplier Lead Time): OK at or below target", () => {
    expect(computeKriStatus(15, 30, 20)).toBe("OK")
    expect(computeKriStatus(20, 30, 20)).toBe("OK")
  })

  it("lower-is-better: ALERT at or above threshold", () => {
    expect(computeKriStatus(42, 30, 20)).toBe("ALERT")
  })

  it("lower-is-better: WARNING strictly between target and threshold", () => {
    expect(computeKriStatus(25, 30, 20)).toBe("WARNING")
  })
})
