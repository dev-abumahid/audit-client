import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ProtectedRoute } from './ProtectedRoute'

vi.mock('@/contexts/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@/contexts/useAuth'
const mockUseAuth = vi.mocked(useAuth)

function renderProtected(initialPath = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/protected" element={<div>Protected content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('shows spinner while loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true, login: vi.fn(), logout: vi.fn() })
    renderProtected()
    // Spinner div present, protected content not shown
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('redirects to / when not authenticated', async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, login: vi.fn(), logout: vi.fn() })
    renderProtected()
    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument())
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'u@example.com', role: 'ORGANIZATION', provider: 'local', userProfile: null },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    })
    renderProtected()
    await waitFor(() => expect(screen.getByText('Protected content')).toBeInTheDocument())
  })
})
