import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { AuthProvider } from "./AuthContext"
import { useAuth } from "./useAuth"

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string
    ) {
      super(message)
    }
  },
}))

import { api } from "@/lib/api"

const mockGet = vi.mocked(api.get)
const mockPost = vi.mocked(api.post)

function TestConsumer() {
  const { user, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="user">{user ? user.email : "none"}</span>
      <button onClick={() => login("test@example.com", "password")}>
        login
      </button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

function renderWithAuth() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe("AuthContext", () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
  })

  it("starts as unauthenticated if /auth/me returns 401", async () => {
    mockGet.mockRejectedValue(new Error("Unauthorized"))
    renderWithAuth()
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("none")
    )
  })

  it("restores session if /auth/me returns user", async () => {
    mockGet.mockResolvedValue({
      id: "1",
      email: "stored@example.com",
      role: "ORGANIZATION",
      provider: "local",
      userProfile: null,
    })
    renderWithAuth()
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("stored@example.com")
    )
  })

  it("sets user on successful login", async () => {
    mockGet.mockRejectedValue(new Error("Unauthorized"))
    mockPost.mockResolvedValue({
      id: "2",
      email: "test@example.com",
      role: "ORGANIZATION",
      provider: "local",
      userProfile: null,
    })
    renderWithAuth()
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("none")
    )

    await userEvent.click(screen.getByText("login"))
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("test@example.com")
    )
  })

  it("clears user on logout", async () => {
    mockGet.mockResolvedValue({
      id: "1",
      email: "user@example.com",
      role: "ORGANIZATION",
      provider: "local",
      userProfile: null,
    })
    renderWithAuth()
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("user@example.com")
    )

    await userEvent.click(screen.getByText("logout"))
    expect(screen.getByTestId("user").textContent).toBe("none")
  })
})
