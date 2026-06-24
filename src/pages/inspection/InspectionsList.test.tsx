import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import InspectionsList from './InspectionsList'

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
}))

import { api } from '@/lib/api'
const mockGet = vi.mocked(api.get)

function makeInspection(overrides = {}) {
  return {
    id: 'insp-1',
    status: 'IN_PROGRESS',
    createdAt: '2026-06-21T10:00:00.000Z',
    updatedAt: '2026-06-21T10:00:00.000Z',
    template: { id: 't-1', templateName: 'Fire Safety Audit' },
    site: { id: 's-1', name: 'HQ Casablanca' },
    inspector: { id: 'p-1', fullName: 'Youssef Benali' },
    ...overrides,
  }
}

function renderList() {
  return render(
    <MemoryRouter>
      <InspectionsList />
    </MemoryRouter>,
  )
}

describe('InspectionsList', () => {
  beforeEach(() => mockGet.mockReset())

  it('shows a loading spinner initially', async () => {
    let settle: (v: unknown) => void
    mockGet.mockReturnValue(new Promise((r) => { settle = r }))
    renderList()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    // resolve to let React finish before the next test starts
    settle!({ meta: { page: 1, limit: 10, total: 0, totalPage: 0 }, data: [] })
    await waitFor(() => expect(document.querySelector('.animate-spin')).not.toBeInTheDocument())
  })

  it('shows empty state when there are no inspections', async () => {
    mockGet.mockResolvedValue({ meta: { page: 1, limit: 10, total: 0, totalPage: 0 }, data: [] })
    renderList()
    await waitFor(() => expect(screen.getByText('No inspections found')).toBeInTheDocument())
  })

  it('renders inspection rows with template and site', async () => {
    mockGet.mockResolvedValue({
      meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
      data: [makeInspection()],
    })
    renderList()
    await waitFor(() => expect(screen.getByText('Fire Safety Audit')).toBeInTheDocument())
    expect(screen.getByText('HQ Casablanca')).toBeInTheDocument()
    expect(screen.getByText('Youssef Benali')).toBeInTheDocument()
  })

  it('shows "Continue" for IN_PROGRESS and "View" for COMPLETED', async () => {
    mockGet.mockResolvedValue({
      meta: { page: 1, limit: 10, total: 2, totalPage: 1 },
      data: [
        makeInspection({ id: 'i-1', status: 'IN_PROGRESS' }),
        makeInspection({ id: 'i-2', status: 'COMPLETED' }),
      ],
    })
    renderList()
    await waitFor(() => expect(screen.getByText('Continue')).toBeInTheDocument())
    expect(screen.getByText('View')).toBeInTheDocument()
  })

  it('shows all four status badge labels', async () => {
    const statuses = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
    mockGet.mockResolvedValue({
      meta: { page: 1, limit: 10, total: 4, totalPage: 1 },
      data: statuses.map((s, i) => makeInspection({ id: `i-${i}`, status: s })),
    })
    renderList()
    // All status labels also appear in the filter dropdown — use getAllByText
    await waitFor(() => expect(screen.getAllByText('Draft').length).toBeGreaterThan(0))
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0)
  })

  it('applies the correct colour class to each status badge', async () => {
    const statuses = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
    mockGet.mockResolvedValue({
      meta: { page: 1, limit: 10, total: 4, totalPage: 1 },
      data: statuses.map((s, i) => makeInspection({ id: `i-${i}`, status: s })),
    })
    renderList()
    await waitFor(() => screen.getAllByText('Draft'))

    const classMap: Record<string, string> = {
      Draft: 'bg-slate-100',
      'In Progress': 'bg-blue-100',
      Completed: 'bg-green-100',
      Cancelled: 'bg-red-100',
    }
    document.querySelectorAll('span.rounded-full').forEach((badge) => {
      const label = badge.textContent?.trim() ?? ''
      if (label in classMap) expect(badge.className).toContain(classMap[label])
    })
  })

  it('shows an error when the fetch fails', async () => {
    // Resolve with null so the .then() throws a TypeError caught by .catch()
    // (avoids unhandled rejection that Vitest would intercept before the chain attaches)
    mockGet.mockResolvedValue(null as unknown as never)
    renderList()
    await waitFor(() => expect(screen.getByText('Failed to load inspections')).toBeInTheDocument())
  })

  it('does not show pagination when there is only one page', async () => {
    mockGet.mockResolvedValue({
      meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
      data: [makeInspection()],
    })
    renderList()
    await waitFor(() => expect(screen.getByText('Fire Safety Audit')).toBeInTheDocument())
    expect(screen.queryByText('Previous')).not.toBeInTheDocument()
  })
})
