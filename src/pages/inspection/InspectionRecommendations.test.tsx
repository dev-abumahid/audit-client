import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import InspectionRecommendations from './InspectionRecommendations'

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
}))

vi.mock('react-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router')>()
  return { ...mod, useParams: () => ({ id: 'insp-1' }) }
})

import { api, ApiError } from '@/lib/api'
const mockGet = vi.mocked(api.get)
const mockPatch = vi.mocked(api.patch)

const mockRec = {
  id: 'rec-1',
  inspectionId: 'insp-1',
  summary: 'Overall inspection summary.',
  createdAt: '2026-06-21T10:00:00.000Z',
  questions: [
    {
      id: 'rr-1',
      question: 'Fire extinguisher condition',
      observation: 'Units are expired.',
      standard: 'ISO 23601',
      recommendation: 'Replace all units immediately.',
    },
    {
      id: 'rr-2',
      question: 'Emergency exits',
      observation: 'Exit signs not illuminated.',
      standard: 'EN 1838',
      recommendation: 'Install emergency lighting.',
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <InspectionRecommendations />
    </MemoryRouter>,
  )
}

describe('InspectionRecommendations', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPatch.mockReset()
  })

  it('shows a loading spinner initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows "no recommendations" state on 404', async () => {
    mockGet.mockRejectedValue(new ApiError(404, 'Recommendation not found'))
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('No recommendations yet')).toBeInTheDocument(),
    )
    expect(screen.getByText(/Complete the inspection/i)).toBeInTheDocument()
  })

  it('renders summary and finding count when data is present', async () => {
    mockGet.mockResolvedValue(mockRec)
    renderPage()
    await waitFor(() =>
      expect(screen.getByDisplayValue('Overall inspection summary.')).toBeInTheDocument(),
    )
    expect(screen.getByText('2 findings')).toBeInTheDocument()
  })

  it('renders finding question labels', async () => {
    mockGet.mockResolvedValue(mockRec)
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('Fire extinguisher condition')).toBeInTheDocument(),
    )
    expect(screen.getByText('Emergency exits')).toBeInTheDocument()
  })

  it('expands first finding by default showing observation fields', async () => {
    mockGet.mockResolvedValue(mockRec)
    renderPage()
    await waitFor(() =>
      expect(screen.getByDisplayValue('Units are expired.')).toBeInTheDocument(),
    )
    expect(screen.getByDisplayValue('ISO 23601')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Replace all units immediately.')).toBeInTheDocument()
  })

  it('collapses / expands a finding on click', async () => {
    mockGet.mockResolvedValue(mockRec)
    renderPage()
    await waitFor(() => expect(screen.getByText('Fire extinguisher condition')).toBeInTheDocument())

    // first finding starts expanded — click to collapse
    await userEvent.click(screen.getByText('Fire extinguisher condition'))
    expect(screen.queryByDisplayValue('Units are expired.')).not.toBeInTheDocument()

    // click again to expand
    await userEvent.click(screen.getByText('Fire extinguisher condition'))
    await waitFor(() =>
      expect(screen.getByDisplayValue('Units are expired.')).toBeInTheDocument(),
    )
  })

  it('calls PATCH on blur of an editable field', async () => {
    mockGet.mockResolvedValue(mockRec)
    mockPatch.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByDisplayValue('Units are expired.')).toBeInTheDocument())

    const field = screen.getByDisplayValue('Units are expired.')
    await userEvent.clear(field)
    await userEvent.type(field, 'Updated observation')
    await userEvent.tab()

    expect(mockPatch).toHaveBeenCalledWith(
      '/api/recommendation/update-question/rr-1',
      { observation: 'Updated observation' },
    )
  })
})
