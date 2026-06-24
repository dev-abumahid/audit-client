import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import RunInspection from './RunInspection'

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), put: vi.fn(), patch: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router')>()
  return {
    ...mod,
    useParams: () => ({ id: 'insp-1' }),
    useNavigate: () => mockNavigate,
  }
})

import { api } from '@/lib/api'
const mockGet = vi.mocked(api.get)
const mockPatch = vi.mocked(api.patch)

const mockInspection = {
  id: 'insp-1',
  status: 'IN_PROGRESS',
  createdAt: '2026-06-21T00:00:00.000Z',
  updatedAt: '2026-06-21T00:00:00.000Z',
  unSplitText: null,
  note: null,
  site: { id: 's-1', name: 'HQ Casablanca' },
  template: {
    id: 't-1',
    templateName: 'Fire Safety Audit',
    pages: [
      {
        id: 'pg-1',
        pageIndex: 1,
        title: 'General info',
        questions: [
          { id: 'q-1', index: 0, question: 'Location?', isRequired: true, answerType: 'TEXT', value: null },
          { id: 'q-2', index: 1, question: 'Date?', isRequired: false, answerType: 'DATE', value: null },
        ],
      },
      {
        id: 'pg-2',
        pageIndex: 2,
        title: 'Fire systems',
        questions: [
          { id: 'q-3', index: 0, question: 'Extinguisher ok?', isRequired: true, answerType: 'CHECKBOX', value: ['Yes', 'No'] },
        ],
      },
    ],
  },
  questionAnswers: [
    { id: 'qa-1', questionId: 'q-1', answer: '', note: null, mediaFiles: null, question: { id: 'q-1', question: 'Location?', answerType: 'TEXT', value: null } },
    { id: 'qa-2', questionId: 'q-2', answer: '', note: null, mediaFiles: null, question: { id: 'q-2', question: 'Date?', answerType: 'DATE', value: null } },
    { id: 'qa-3', questionId: 'q-3', answer: [], note: null, mediaFiles: null, question: { id: 'q-3', question: 'Extinguisher ok?', answerType: 'CHECKBOX', value: ['Yes', 'No'] } },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RunInspection />
    </MemoryRouter>,
  )
}

describe('RunInspection', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPatch.mockReset()
    mockNavigate.mockReset()
  })

  it('shows a loading spinner initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows an error when the fetch fails', async () => {
    mockGet.mockResolvedValue(null as unknown as never)
    renderPage()
    await waitFor(() => expect(screen.getByText('Failed to load inspection')).toBeInTheDocument())
  })

  it('renders the template name in the breadcrumb', async () => {
    mockGet.mockResolvedValue(mockInspection)
    renderPage()
    await waitFor(() => expect(screen.getByText('Fire Safety Audit')).toBeInTheDocument())
  })

  it('renders all page titles in the sidebar', async () => {
    mockGet.mockResolvedValue(mockInspection)
    renderPage()
    // "General info" appears in both sidebar nav and as the current page heading
    await waitFor(() => expect(screen.getAllByText('General info').length).toBeGreaterThan(0))
    expect(screen.getByText('Fire systems')).toBeInTheDocument()
  })

  it('renders questions for the current page', async () => {
    mockGet.mockResolvedValue(mockInspection)
    renderPage()
    await waitFor(() => expect(screen.getByText('Location?')).toBeInTheDocument())
    expect(screen.getByText('Date?')).toBeInTheDocument()
    // Second page questions should not be visible yet
    expect(screen.queryByText('Extinguisher ok?')).not.toBeInTheDocument()
  })

  it('navigates to the next page when Next is clicked', async () => {
    mockGet.mockResolvedValue(mockInspection)
    renderPage()
    await waitFor(() => screen.getByText('Next'))
    await userEvent.click(screen.getByText('Next'))
    await waitFor(() => expect(screen.getByText('Extinguisher ok?')).toBeInTheDocument())
    expect(screen.queryByText('Location?')).not.toBeInTheDocument()
  })

  it('Previous button is disabled on the first page', async () => {
    mockGet.mockResolvedValue(mockInspection)
    renderPage()
    await waitFor(() => screen.getByText('Previous'))
    expect(screen.getByText('Previous').closest('button')).toBeDisabled()
  })

  it('marks inspection complete and navigates to list', async () => {
    mockGet.mockResolvedValue(mockInspection)
    mockPatch.mockResolvedValue({})
    renderPage()
    await waitFor(() => screen.getByText('Mark complete'))
    await userEvent.click(screen.getByText('Mark complete'))
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/inspection/insp-1', { status: 'COMPLETED' }),
    )
    expect(mockNavigate).toHaveBeenCalledWith('/organization/audit/inspections')
  })

  it('shows "Upload notes" link when inspection has no note', async () => {
    mockGet.mockResolvedValue(mockInspection)
    renderPage()
    await waitFor(() => expect(screen.getByText('Upload notes')).toBeInTheDocument())
  })

  it('shows "View notes" link when inspection has an existing note', async () => {
    mockGet.mockResolvedValue({ ...mockInspection, note: { id: 'note-1' } })
    renderPage()
    await waitFor(() => expect(screen.getByText('View notes')).toBeInTheDocument())
  })

  it('renders questions as read-only when inspection is COMPLETED', async () => {
    mockGet.mockResolvedValue({ ...mockInspection, status: 'COMPLETED' })
    renderPage()
    await waitFor(() => screen.getByText('Location?'))
    const inputs = screen.getAllByRole('textbox')
    inputs.forEach((input) => expect(input).toBeDisabled())
  })
})
