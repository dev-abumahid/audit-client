import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ViewAndEditRecommendation from './ViewAndEditRecommendation'

// Run lodash's debounce synchronously so save-on-change assertions don't need real timers.
vi.mock('lodash', () => ({
  debounce: (fn: (...args: unknown[]) => unknown) => {
    const wrapped = (...args: unknown[]) => fn(...args)
    wrapped.cancel = vi.fn()
    return wrapped
  },
}))

const mockUseGetRecommendationByInspectionIdQuery = vi.fn()
const mockUpdateRecommendationQuestion = vi.fn()
const mockUpdateRecommendationSummary = vi.fn()
const mockGenerateRecommendation = vi.fn()

vi.mock('@/redux/apis/organization/recommendation.api', () => ({
  useGetRecommendationByInspectionIdQuery: (...args: unknown[]) => mockUseGetRecommendationByInspectionIdQuery(...args),
  useUpdateRecommendationQuestionByIdMutation: () => [mockUpdateRecommendationQuestion],
  useUpdateRecommendationSummaryMutation: () => [mockUpdateRecommendationSummary],
}))

vi.mock('@/redux/apis/organization/ai.api', () => ({
  useGenerateRecommendationFromAiMutation: () => [mockGenerateRecommendation],
}))

vi.mock('../findings/CreateNewFindingModal', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>Finding modal open</div> : null),
}))

function makeRecommendation(overrides = {}) {
  return {
    id: 'rec-1',
    summary: 'Overall the site is compliant.',
    createdAt: '2026-06-01T10:00:00.000Z',
    questions: [
      {
        id: 'q-1',
        question: 'Fire extinguisher present?',
        observation: 'Extinguisher found near exit',
        recommendation: 'Ensure monthly inspection tag is current',
        standard: 'NFPA 10',
      },
    ],
    ...overrides,
  }
}

describe('ViewAndEditRecommendation', () => {
  beforeEach(() => {
    mockUseGetRecommendationByInspectionIdQuery.mockReset()
    mockUpdateRecommendationQuestion.mockReset()
    mockUpdateRecommendationSummary.mockReset()
    mockGenerateRecommendation.mockReset()
    mockUpdateRecommendationQuestion.mockReturnValue({ unwrap: () => Promise.resolve({}) })
    mockUpdateRecommendationSummary.mockReturnValue({ unwrap: () => Promise.resolve({}) })
  })

  it('renders nothing while loading', () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({ data: undefined, isLoading: true, refetch: vi.fn() })

    const { container } = render(<ViewAndEditRecommendation inspectionId="insp-1" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the generate button when there is no recommendation yet', () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: { questions: [] } },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)

    expect(screen.getByText('No Recommendation Available')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate recommendation now/i })).toBeInTheDocument()
  })

  it('calls generateRecommendation and refetches on click', async () => {
    const refetch = vi.fn()
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: { questions: [] } },
      isLoading: false,
      refetch,
    })
    mockGenerateRecommendation.mockReturnValue({ unwrap: () => Promise.resolve({}) })

    render(<ViewAndEditRecommendation inspectionId="insp-77" />)
    await userEvent.click(screen.getByRole('button', { name: /generate recommendation now/i }))

    await waitFor(() => expect(mockGenerateRecommendation).toHaveBeenCalledWith({ inspectionId: 'insp-77' }))
    await waitFor(() => expect(refetch).toHaveBeenCalled())
  })

  it('renders question observation, recommendation and standard fields', () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)

    expect(screen.getByDisplayValue('Extinguisher found near exit')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ensure monthly inspection tag is current')).toBeInTheDocument()
    expect(screen.getByDisplayValue('NFPA 10')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Overall the site is compliant.')).toBeInTheDocument()
  })

  it('saves an edited observation via updateRecommendationQuestion', async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)
    const observationField = screen.getByDisplayValue('Extinguisher found near exit')
    await userEvent.type(observationField, '!')

    await waitFor(() =>
      expect(mockUpdateRecommendationQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'q-1',
          data: expect.objectContaining({ observation: 'Extinguisher found near exit!' }),
        }),
      ),
    )
  })

  it('saves an edited summary via updateRecommendationSummary', async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)
    const summaryField = screen.getByDisplayValue('Overall the site is compliant.')
    await userEvent.type(summaryField, ' Updated.')

    await waitFor(() =>
      expect(mockUpdateRecommendationSummary).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rec-1' }),
      ),
    )
  })

  it('opens the finding modal when "Add To Finding" is clicked', async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)
    await userEvent.click(screen.getByRole('button', { name: /add to finding/i }))

    expect(screen.getByText('Finding modal open')).toBeInTheDocument()
  })
})
