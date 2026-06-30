import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import SignUpModal from './SignUpModal'

// ── i18n ──────────────────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'auth.signUp.title': 'Get Started with Us',
        'auth.signUp.subTitle': 'Create your account to get started',
        'auth.signUp.organizationName': 'Organization Name',
        'auth.signUp.email': 'Email',
        'auth.signUp.password': 'Password',
        'auth.signUp.btnSignUp': 'Sign Up',
        'auth.signUp.btnClear': 'Clear',
        'auth.signUp.hintText': 'Already Signed up?',
        'auth.signIn.btnSignIn': 'Sign In',
        'auth.signUp.organizationNameReqText': 'Organization name is required',
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

// ── RTK Query auth API ────────────────────────────────────────────────────────
const mockSignUpTrigger = vi.fn()
vi.mock('@/redux/apis/auth.api', () => ({
  useSignUpUserMutation: () => [mockSignUpTrigger, { isLoading: false }],
}))

// ─────────────────────────────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onLoginClick: vi.fn(),
}

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <SignUpModal {...defaultProps} {...props} />
    </MemoryRouter>,
  )
}

describe('SignUpModal', () => {
  beforeEach(() => {
    mockSignUpTrigger.mockReset()
  })

  it('renders the sign-up form', () => {
    renderModal()
    expect(screen.getByLabelText('Organization Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument()
  })

  it('calls useSignUpUserMutation trigger on submit with correct args', async () => {
    const user = userEvent.setup()

    mockSignUpTrigger.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: 'Account created',
        }),
    })

    renderModal()

    await user.type(screen.getByLabelText('Organization Name'), 'Acme Corp')
    await user.type(screen.getByLabelText('Email'), 'admin@acme.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign Up' }))

    await waitFor(() =>
      expect(mockSignUpTrigger).toHaveBeenCalledWith({
        organizationName: 'Acme Corp',
        email: 'admin@acme.com',
        password: 'password123',
      }),
    )
  })

  it('shows email confirmation screen on success', async () => {
    const user = userEvent.setup()

    mockSignUpTrigger.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: 'Account created',
        }),
    })

    renderModal()

    await user.type(screen.getByLabelText('Organization Name'), 'Acme Corp')
    await user.type(screen.getByLabelText('Email'), 'admin@acme.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign Up' }))

    await waitFor(() =>
      expect(screen.getByText('Check your email')).toBeInTheDocument(),
    )
    expect(screen.getByText('admin@acme.com')).toBeInTheDocument()
  })
})
