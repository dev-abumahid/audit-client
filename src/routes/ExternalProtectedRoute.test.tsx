import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import ExternalProtectedRoute from "./ExternalProtectedRoute"

let mockExternalUser: { externalOrgMemberId: string } = {
  externalOrgMemberId: "",
}
vi.mock("@/redux/hooks", () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ externalUser: mockExternalUser }),
}))

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={["/external"]}>
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        <Route
          path="/external"
          element={
            <ExternalProtectedRoute>
              <div>Portal content</div>
            </ExternalProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe("ExternalProtectedRoute", () => {
  it("redirects to / when there is no external session", () => {
    mockExternalUser = { externalOrgMemberId: "" }
    renderProtected()

    expect(screen.getByText("Home")).toBeInTheDocument()
    expect(screen.queryByText("Portal content")).not.toBeInTheDocument()
  })

  it("renders the protected content when an external session exists", () => {
    mockExternalUser = { externalOrgMemberId: "ext-1" }
    renderProtected()

    expect(screen.getByText("Portal content")).toBeInTheDocument()
  })
})
