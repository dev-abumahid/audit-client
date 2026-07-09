import { createContext } from "react"

export interface AuthUser {
  id: string
  email: string
  role: string
  provider: string
  userProfile: {
    name?: string
    userName?: string
    image?: string
  } | null
}

export interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
