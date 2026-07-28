import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import WriteGuardRoute from "./WriteGuardRoute"

let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
}))

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={["/guarded"]}>
      <Routes>
        <Route
          path="/guarded"
          element={
            <WriteGuardRoute fallback="/list">
              <div>guarded form</div>
            </WriteGuardRoute>
          }
        />
        <Route path="/list" element={<div>list landing</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe("WriteGuardRoute (ticket #271)", () => {
  it("renders children for a write-capable role (ADMIN)", () => {
    mockRole = "ADMIN"
    renderGuarded()
    expect(screen.getByText("guarded form")).toBeInTheDocument()
  })

  it("renders children for a write-capable role (LEAD_AUDITOR)", () => {
    mockRole = "LEAD_AUDITOR"
    renderGuarded()
    expect(screen.getByText("guarded form")).toBeInTheDocument()
  })

  it("redirects to the fallback for VIEWER instead of rendering the form", () => {
    mockRole = "VIEWER"
    renderGuarded()
    expect(screen.getByText("list landing")).toBeInTheDocument()
    expect(screen.queryByText("guarded form")).not.toBeInTheDocument()
  })

  it("redirects to the fallback for LIGHT_USER instead of rendering the form", () => {
    mockRole = "LIGHT_USER"
    renderGuarded()
    expect(screen.getByText("list landing")).toBeInTheDocument()
    expect(screen.queryByText("guarded form")).not.toBeInTheDocument()
  })

  it("renders neither the form nor the fallback while the role is still loading", () => {
    mockRole = undefined
    renderGuarded()
    expect(screen.queryByText("guarded form")).not.toBeInTheDocument()
    expect(screen.queryByText("list landing")).not.toBeInTheDocument()
  })
})
