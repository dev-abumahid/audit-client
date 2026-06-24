import { AuthProvider } from '@/contexts/AuthContext'
import { Outlet } from 'react-router'

// AuthProvider must live inside the router (needs useNavigate)
export default function AppRoot() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
