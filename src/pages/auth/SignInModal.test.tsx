import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import SignInModal from './SignInModal'

// ── i18n ──────────────────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'auth.signIn.title': 'Welcome Back',
        'auth.signIn.subTitle': 'Sign in to your account',
        'auth.signUp.email': 'Email',
        'auth.signUp.password': 'Password',
        'auth.signIn.btnForgotPassword': 'Forgot Password?',
        'auth.signIn.btnSignIn': 'Sign In',
        'auth.signIn.hintText': "Don't have an account?",
        'auth.signUp.btnSignUp': 'Sign Up',
        'auth.signUp.emailReqText': 'Email is required',
        'auth.signUp.passwordReqText': 'Password is required',
      }
      return map[key] ?? key
    },
    i18n: { changeLanguage: vi.fn() },
  }),
}))

// ── sonner ────────────────────────────────────────────────────────────────────
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ── react-router navigate ─────────────────────────────────────────────────────
const mockNavigate = vi.fn()
vi.mock('react-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router')>()
  return { ...mod, useNavigate: () => mockNavigate }
})

// ── Redux dispatch ─────────────────────────────────────────────────────────────
const mockDispatch = vi.fn()
vi.mock('@/redux/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn(),
}))

// ── RTK Query auth API ────────────────────────────────────────────────────────
const mockSignInTrigger = vi.fn()
vi.mock('@/redux/apis/auth.api', () => ({
  useSignInUserMutation: () => [mockSignInTrigger],
}))

// ─────────────────────────────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSignUpClick: vi.fn(),
  onForgotPasswordClick: vi.fn(),
}

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <SignInModal {...defaultProps} {...props} />
    </MemoryRouter>,
  )
}

describe('SignInModal', () => {
  beforeEach(() => {
    mockSignInTrigger.mockReset()
    mockNavigate.mockReset()
    mockDispatch.mockReset()
  })

  it('renders the sign-in form', () => {
    renderModal()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
  })

  it('calls useSignInUserMutation trigger on submit with correct args', async () => {
    const user = userEvent.setup()

    // unwrap() resolves to a success response
    mockSignInTrigger.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: 'Signed in',
          data: { role: 'ORGANIZATION' },
        }),
    })

    renderModal()

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() =>
      expect(mockSignInTrigger).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'secret123',
      }),
    )
  })

  it('shows error toast when mutation rejects', async () => {
    const user = userEvent.setup()
    const { toast } = await import('sonner')

    mockSignInTrigger.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: 'Invalid credentials' } }),
    })

    renderModal()

    await user.type(screen.getByLabelText('Email'), 'bad@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Invalid credentials'),
    )
  })
})
