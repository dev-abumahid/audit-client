import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import SitesEntities from './SitesEntities'

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { toast } from 'sonner'
const mockToastError = vi.mocked(toast.error)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const mockUseGetAllSitesQuery = vi.fn()
const mockCreateNewSite = vi.fn()
const mockUpdateSite = vi.fn()
const mockDeleteSite = vi.fn()
const mockUseGetAllRisksQuery = vi.fn()
const mockDeleteRisk = vi.fn()
const mockCreateNewRisk = vi.fn()

vi.mock('@/redux/apis/organization/sites.api', () => ({
  useGetAllSitesQuery: (...args: unknown[]) => mockUseGetAllSitesQuery(...args),
  useCreateNewSiteMutation: () => [mockCreateNewSite, { isLoading: false }],
  useUpdateSiteMutation: () => [mockUpdateSite, { isLoading: false }],
  useDeleteSiteMutation: () => [mockDeleteSite, { isLoading: false }],
}))

vi.mock('@/redux/apis/organization/risk.api', () => ({
  useGetAllRisksQuery: (...args: unknown[]) => mockUseGetAllRisksQuery(...args),
  useDeleteRiskMutation: () => [mockDeleteRisk],
  useCreateNewRiskMutation: () => [mockCreateNewRisk, { isLoading: false }],
}))

vi.mock('@/components/shared/DeleteAlertModal', () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>Confirm delete</button> : null,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...rest }: React.ComponentProps<'button'> & { variant?: string; size?: string }) => (
    <button onClick={onClick} disabled={disabled} className={className} {...rest}>{children}</button>
  ),
  buttonVariants: () => '',
}))

function makeSite(overrides = {}) {
  return {
    id: 'site-1',
    name: 'HQ Casablanca',
    location: 'Casablanca',
    country: 'Morocco',
    activity: 'Finance',
    revenue: 1000000,
    employees_count: 250,
    site_type: 'production',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('SitesEntities', () => {
  beforeEach(() => {
    mockUseGetAllSitesQuery.mockReset()
    mockCreateNewSite.mockReset()
    mockUpdateSite.mockReset()
    mockDeleteSite.mockReset()
    mockUseGetAllRisksQuery.mockReset()
    mockDeleteRisk.mockReset()
    mockCreateNewRisk.mockReset()
    mockToastError.mockReset()
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })
  })

  it('shows a loading spinner while sites are loading', () => {
    mockUseGetAllSitesQuery.mockReturnValue({ isLoading: true, isFetching: true, data: undefined, error: undefined })

    const { container } = render(<SitesEntities />)

    expect(container.querySelector('svg.lucide-loader-circle')).toBeInTheDocument()
  })

  it('shows an error state when the sites query fails', () => {
    mockUseGetAllSitesQuery.mockReturnValue({ isLoading: false, isFetching: false, data: undefined, error: { status: 500 } })

    render(<SitesEntities />)

    expect(screen.getByText('Error loading sites')).toBeInTheDocument()
  })

  it('renders site rows with name, location and country', () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    render(<SitesEntities />)

    expect(screen.getByText('HQ Casablanca')).toBeInTheDocument()
    expect(screen.getByText(/Location: Casablanca/)).toBeInTheDocument()
  })

  it('shows empty state when there are no sites', () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    render(<SitesEntities />)

    expect(screen.getByText('organization.site&entities.noSite')).toBeInTheDocument()
  })

  it('opens the create-site modal and validates the required name field', async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })

    render(<SitesEntities />)
    await userEvent.click(screen.getByRole('button', { name: /organization.site&entities.newSite/i }))

    expect(screen.getByText('Add New Site')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'organization.site&entities.add' }))

    await waitFor(() => expect(screen.getByText('Name is required')).toBeInTheDocument())
    expect(mockCreateNewSite).not.toHaveBeenCalled()
  })

  it('submits the create-site form with the entered name', async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })
    mockCreateNewSite.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) })

    const { container } = render(<SitesEntities />)
    await userEvent.click(screen.getByRole('button', { name: /organization.site&entities.newSite/i }))
    await userEvent.type(container.querySelector('[name="name"]')!, 'New Factory')
    await userEvent.click(screen.getByRole('button', { name: 'organization.site&entities.add' }))

    await waitFor(() => expect(mockCreateNewSite).toHaveBeenCalled())
    expect(mockCreateNewSite.mock.calls[0][0]).toMatchObject({ name: 'New Factory' })
  })

  it('pre-fills the edit form with existing site data', async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })

    const { container } = render(<SitesEntities />)
    const editButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-pencil'))
    await userEvent.click(editButtons[0])

    expect(screen.getByText('Edit Site Information')).toBeInTheDocument()
    expect(container.querySelector('[name="name"]')).toHaveValue('HQ Casablanca')
  })

  it('opens delete confirmation and calls deleteSite on confirm', async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockDeleteSite.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) })

    render(<SitesEntities />)
    const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-trash2'))
    await userEvent.click(deleteButtons[0])
    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))

    await waitFor(() => expect(mockDeleteSite).toHaveBeenCalledWith('site-1'))
  })

  it('expands a site to show its confirmed risks', async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          {
            id: 'risk-99',
            name: 'Flooding',
            description: 'Seasonal flood risk',
            residual_score: 12,
            ai_generated: false,
          },
        ],
      },
    })

    render(<SitesEntities />)
    const [expandButton] = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-chevron-down'))
    await userEvent.click(expandButton)

    expect(screen.getByText('Flooding')).toBeInTheDocument()
  })

  it('opens the manual risk form and submits it for the site', async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockCreateNewRisk.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) })

    const { container } = render(<SitesEntities />)
    await userEvent.click(screen.getByRole('button', { name: /organization.site&entities.addRisk/i }))
    await userEvent.type(container.querySelector('[name="name"]')!, 'Power outage')
    // The status <select> resets to "" in RHF state even though the browser displays
    // the first option ("Open") — must explicitly choose a value or required validation fails silently.
    await userEvent.selectOptions(container.querySelector('[name="status"]')!, 'open')
    await userEvent.click(screen.getByRole('button', { name: 'organization.site&entities.add' }))

    await waitFor(() => expect(mockCreateNewRisk).toHaveBeenCalled())
    expect(mockCreateNewRisk.mock.calls[0][0]).toMatchObject({ name: 'Power outage', site_id: 'site-1' })
  })

  it('shows an error toast and keeps the form open when saving a site fails', async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0 } },
      error: undefined,
    })
    mockCreateNewSite.mockReturnValue({ unwrap: () => Promise.reject(new Error('network down')) })

    const { container } = render(<SitesEntities />)
    await userEvent.click(screen.getByRole('button', { name: /organization.site&entities.newSite/i }))
    await userEvent.type(container.querySelector('[name="name"]')!, 'New Factory')
    await userEvent.click(screen.getByRole('button', { name: 'organization.site&entities.add' }))

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Failed to save site'))
    expect(screen.getByText('Add New Site')).toBeInTheDocument()
  })

  it('shows an error toast and keeps the confirmation open when deleting a site fails', async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockDeleteSite.mockReturnValue({ unwrap: () => Promise.reject(new Error('locked')) })

    render(<SitesEntities />)
    const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-trash2'))
    await userEvent.click(deleteButtons[0])
    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Failed to delete site'))
    // The mocked DeleteAlertModal only renders while `open` is still true
    expect(screen.getByRole('button', { name: /confirm delete/i })).toBeInTheDocument()
  })

  it('shows an error toast when the risk-delete response indicates failure', async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [{ id: 'risk-99', name: 'Flooding', residual_score: 12, ai_generated: false }] },
    })
    mockDeleteRisk.mockReturnValue({ unwrap: () => Promise.resolve({ success: false }) })

    render(<SitesEntities />)
    const [expandButton] = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-chevron-down'))
    await userEvent.click(expandButton)
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Failed to delete risk'))
  })

  it('shows an error toast when the manual-risk-create response indicates failure', async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { data: [makeSite()], meta: { page: 1, limit: 10, total: 1 } },
      error: undefined,
    })
    mockCreateNewRisk.mockReturnValue({ unwrap: () => Promise.resolve({ success: false }) })

    const { container } = render(<SitesEntities />)
    await userEvent.click(screen.getByRole('button', { name: /organization.site&entities.addRisk/i }))
    await userEvent.type(container.querySelector('[name="name"]')!, 'Power outage')
    await userEvent.selectOptions(container.querySelector('[name="status"]')!, 'open')
    await userEvent.click(screen.getByRole('button', { name: 'organization.site&entities.add' }))

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Failed to create risk'))
  })
})
