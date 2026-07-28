import { canWriteOrgResource } from "./useMyOrgRole"

describe("canWriteOrgResource", () => {
  it("allows ADMIN", () => {
    expect(canWriteOrgResource("ADMIN")).toBe(true)
  })

  it("allows LEAD_AUDITOR", () => {
    expect(canWriteOrgResource("LEAD_AUDITOR")).toBe(true)
  })

  it("denies LIGHT_USER", () => {
    expect(canWriteOrgResource("LIGHT_USER")).toBe(false)
  })

  it("denies VIEWER", () => {
    expect(canWriteOrgResource("VIEWER")).toBe(false)
  })

  it("denies while the role is still loading (undefined)", () => {
    expect(canWriteOrgResource(undefined)).toBe(false)
  })
})
