import { api } from "@/lib/api"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "react-router"
import { AuthContext, type AuthUser } from "./AuthContextDef"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  // Restore session on mount by checking with the server
  useEffect(() => {
    api
      .get<AuthUser>("/api/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<AuthUser>("/api/auth/sign-in", {
      email,
      password,
    })
    setUser(data)
  }, [])

  const logout = useCallback(() => {
    // Server sets httpOnly cookie so we can't clear it from JS.
    // Clear client state and redirect — cookie expires naturally in 7 days.
    // aexa-server#19: POST /api/auth/logout will properly clear the cookie once merged.
    setUser(null)
    navigate("/")
  }, [navigate])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
