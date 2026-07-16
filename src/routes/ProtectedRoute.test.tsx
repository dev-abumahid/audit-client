import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import ProtectedRoute from "./ProtectedRoute"

const mockUseAppSelector = vi.fn()
vi.mock("@/redux/hooks", () => ({
  useAppSelector: (...args: unknown[]) => mockUseAppSelector(...args),
}))

function renderProtected(role: "ADMIN" | "ORGANIZATION") {
  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute role={role}>
              <div>protected content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/admin" element={<div>admin landing</div>} />
        <Route path="/organization" element={<div>organization landing</div>} />
        <Route path="/" element={<div>root landing</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ProtectedRoute (ticket #48)", () => {
  it("renders children when the logged-in role matches", () => {
    mockUseAppSelector.mockReturnValue({ role: "ORGANIZATION" })
    renderProtected("ORGANIZATION")
    expect(screen.getByText("protected content")).toBeInTheDocument()
  })

  it("redirects to /admin when an ADMIN hits an ORGANIZATION-only route", () => {
    mockUseAppSelector.mockReturnValue({ role: "ADMIN" })
    renderProtected("ORGANIZATION")
    expect(screen.getByText("admin landing")).toBeInTheDocument()
  })

  it("redirects to / when there is no logged-in role, instead of a dead-end route", () => {
    mockUseAppSelector.mockReturnValue({ role: "" })
    renderProtected("ORGANIZATION")
    expect(screen.getByText("root landing")).toBeInTheDocument()
  })

  it("falls back to / for an unrecognized role instead of navigating to a nonexistent /user page", () => {
    // Simulates the pre-fix bug: a stray/legacy "USER" role (or any role with no
    // dedicated landing page) used to navigate to /user, which has no route handler.
    mockUseAppSelector.mockReturnValue({ role: "USER" })
    renderProtected("ORGANIZATION")
    expect(screen.getByText("root landing")).toBeInTheDocument()
  })
})
