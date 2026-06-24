import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import InspectionActions from './InspectionActions'

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
}))

vi.mock('react-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router')>()
  return { ...mod, useParams: () => ({ id: 'insp-1' }) }
})

import { api } from '@/lib/api'
const mockGet = vi.mocked(api.get)
const mockPost = vi.mocked(api.post)
const mockPatch = vi.mocked(api.patch)
const mockDelete = vi.mocked(api.delete)

function makeAction(overrides = {}) {
  return {
    id: 'act-1',
    inspectionId: 'insp-1',
    actionTitle: 'Replace extinguisher',
    actionDisc: 'Zone B fire extinguisher needs replacement.',
    priority: 'High',
    dueDate: '2026-07-01T00:00:00.000Z',
    status: 'TO_DO',
    site: null,
    messages: [],
    ...overrides,
  }
}

const emptyResponse = { meta: { page: 1, limit: 10, total: 0, totalPage: 0 }, data: [] }

function renderPage() {
  return render(
    <MemoryRouter>
      <InspectionActions />
    </MemoryRouter>,
  )
}

describe('InspectionActions', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPatch.mockReset()
    mockDelete.mockReset()
  })

  it('shows a loading spinner initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows empty state when no actions for this inspection', async () => {
    mockGet.mockResolvedValue({ ...emptyResponse, data: [makeAction({ inspectionId: 'other' })] })
    renderPage()
    await waitFor(() => expect(screen.getByText('No corrective actions yet.')).toBeInTheDocument())
  })

  it('renders action cards', async () => {
    mockGet.mockResolvedValue({ ...emptyResponse, data: [makeAction()] })
    renderPage()
    await waitFor(() => expect(screen.getByText('Replace extinguisher')).toBeInTheDocument())
    expect(screen.getByText('Zone B fire extinguisher needs replacement.')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('applies the correct colour class to each priority badge', async () => {
    const priorities = ['Low', 'Medium', 'High'] as const
    mockGet.mockResolvedValue({
      ...emptyResponse,
      data: priorities.map((p, i) => makeAction({ id: `a-${i}`, priority: p, actionTitle: `Action ${p}` })),
    })
    renderPage()
    await waitFor(() => screen.getByText('Action Low'))

    const classMap: Record<string, string> = {
      Low: 'bg-slate-100',
      Medium: 'bg-amber-100',
      High: 'bg-red-100',
    }
    document.querySelectorAll('span.rounded-full').forEach((badge) => {
      const label = badge.textContent?.trim() ?? ''
      if (label in classMap) expect(badge.className).toContain(classMap[label])
    })
  })

  it('filters out actions from other inspections', async () => {
    mockGet.mockResolvedValue({
      ...emptyResponse,
      data: [
        makeAction({ id: 'a1', inspectionId: 'insp-1', actionTitle: 'Mine' }),
        makeAction({ id: 'a2', inspectionId: 'other-insp', actionTitle: 'Not mine' }),
      ],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Mine')).toBeInTheDocument())
    expect(screen.queryByText('Not mine')).not.toBeInTheDocument()
  })

  it('opens the create form when "New action" is clicked', async () => {
    mockGet.mockResolvedValue(emptyResponse)
    renderPage()
    await waitFor(() => screen.getByText('No corrective actions yet.'))
    await userEvent.click(screen.getByText('New action'))
    expect(screen.getByPlaceholderText(/e.g. Replace faulty/i)).toBeInTheDocument()
  })

  it('submits the create form and shows the new action', async () => {
    mockGet.mockResolvedValue(emptyResponse)
    const newAction = makeAction({ id: 'new-1', actionTitle: 'Fix lighting' })
    mockPost.mockResolvedValue(newAction)

    renderPage()
    await waitFor(() => screen.getByText('New action'))
    await userEvent.click(screen.getByText('New action'))

    await userEvent.type(screen.getByPlaceholderText(/e.g. Replace faulty/i), 'Fix lighting')
    await userEvent.type(screen.getByPlaceholderText(/Describe what needs/i), 'Replace emergency lighting.')
    await userEvent.type(screen.getByDisplayValue(''), '2026-08-01')

    await userEvent.click(screen.getByText('Create action'))

    await waitFor(() => expect(screen.getByText('Fix lighting')).toBeInTheDocument())
    expect(mockPost).toHaveBeenCalledWith(
      '/api/action',
      expect.objectContaining({ actionTitle: 'Fix lighting', inspectionId: 'insp-1' }),
    )
  })

  it('opens the edit form when the edit button is clicked', async () => {
    mockGet.mockResolvedValue({ ...emptyResponse, data: [makeAction()] })
    renderPage()
    await waitFor(() => screen.getByText('Replace extinguisher'))

    await userEvent.click(screen.getByLabelText('Edit action'))
    expect(screen.getByText('Edit action')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Replace extinguisher')).toBeInTheDocument()
  })

  it('submits the edit form and updates the card', async () => {
    mockGet.mockResolvedValue({ ...emptyResponse, data: [makeAction()] })
    const updated = makeAction({ actionTitle: 'Updated title' })
    mockPatch.mockResolvedValue(updated)
    renderPage()
    await waitFor(() => screen.getByText('Replace extinguisher'))

    await userEvent.click(screen.getByLabelText('Edit action'))
    const titleInput = screen.getByDisplayValue('Replace extinguisher')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Updated title')
    await userEvent.click(screen.getByText('Save changes'))

    await waitFor(() => expect(screen.getByText('Updated title')).toBeInTheDocument())
    expect(mockPatch).toHaveBeenCalledWith(
      '/api/action/act-1',
      expect.objectContaining({ actionTitle: 'Updated title' }),
    )
  })

  it('shows inline delete confirm and removes action on confirm', async () => {
    mockGet.mockResolvedValue({ ...emptyResponse, data: [makeAction()] })
    mockDelete.mockResolvedValue({})
    renderPage()
    await waitFor(() => screen.getByText('Replace extinguisher'))

    await userEvent.click(screen.getByLabelText('Delete action'))
    expect(screen.getByText('Delete this action?')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Delete'))
    await waitFor(() => expect(screen.queryByText('Replace extinguisher')).not.toBeInTheDocument())
    expect(mockDelete).toHaveBeenCalledWith('/api/action/act-1')
  })

  it('updates status optimistically via select change', async () => {
    mockGet.mockResolvedValue({ ...emptyResponse, data: [makeAction()] })
    mockPatch.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('Replace extinguisher')).toBeInTheDocument())

    const select = screen.getByDisplayValue('To do')
    await userEvent.selectOptions(select, 'IN_PROGRESS')

    expect(screen.getByDisplayValue('In progress')).toBeInTheDocument()
    expect(mockPatch).toHaveBeenCalledWith('/api/action/act-1', { status: 'IN_PROGRESS' })
  })
})
