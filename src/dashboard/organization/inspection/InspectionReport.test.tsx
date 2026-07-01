import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InspectionReport from './InspectionReport'

class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

const mockNavigate = vi.fn()
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'insp-1' }),
  }
})

const mockUseGetSingleInspectionQuery = vi.fn()
vi.mock('@/redux/apis/organization/inspection.api', () => ({
  useGetSingleInspectionQuery: (...args: unknown[]) => mockUseGetSingleInspectionQuery(...args),
}))

function makeInspection(overrides = {}) {
  return {
    id: 'insp-1',
    status: 'COMPLETED',
    site: { id: 'site-1', name: 'HQ Casablanca' },
    unSplit_text: '',
    actions: [],
    template: {
      templateName: 'Fire Safety Audit',
      pages: [
        {
          title: 'General',
          questions: [
            { id: 'q-1', question: 'Extinguisher present?', answerType: 'checkbox', isRequired: true },
            { id: 'q-2', question: 'Condition rating', answerType: 'slider' },
            { id: 'q-3', question: 'Inspection date', answerType: 'date' },
          ],
        },
      ],
    },
    questionAnswers: [
      { questionId: 'q-1', answer: true, note: 'Checked twice', mediaFiles: [] },
      { questionId: 'q-2', answer: 7, note: '', mediaFiles: [] },
      { questionId: 'q-3', answer: '2026-06-01', note: '', mediaFiles: [] },
    ],
    ...overrides,
  }
}

describe('InspectionReport', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockUseGetSingleInspectionQuery.mockReset()
  })

  it('shows a loading state while there is no inspection data yet', () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({ data: undefined })

    render(<InspectionReport />)

    expect(screen.getByText('Loading report…')).toBeInTheDocument()
  })

  it('renders the header with status, template name, site and stats', () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({ data: { data: makeInspection() } })

    render(<InspectionReport />)

    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fire Safety Audit' })).toBeInTheDocument()
    expect(screen.getByText(/HQ Casablanca/)).toBeInTheDocument()
    expect(screen.getByText('3/3')).toBeInTheDocument() // totalAnswered/totalQuestions
  })

  it('renders a Yes badge for a truthy checkbox answer and shows its note', () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({ data: { data: makeInspection() } })

    render(<InspectionReport />)

    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('Checked twice')).toBeInTheDocument()
  })

  it('renders the slider value and the formatted date answer', () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({ data: { data: makeInspection() } })

    render(<InspectionReport />)

    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText(new Date('2026-06-01').toLocaleDateString())).toBeInTheDocument()
  })

  it('shows "No answer provided" for an unanswered question', () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection({ questionAnswers: [] }) },
    })

    render(<InspectionReport />)

    expect(screen.getAllByText('No answer provided').length).toBe(3)
    expect(screen.getByText('0/3')).toBeInTheDocument()
  })

  it('links each action only to its own matching question, not to others', () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          actions: [
            { _id: 'act-1', question: 'Extinguisher present?', actionTitle: 'Replace tag', priority: 'high', state: 'To do', dueDate: '2026-07-01T00:00:00.000Z' },
            { _id: 'act-2', question: 'Condition rating', actionTitle: 'Recheck condition', priority: 'low', state: 'To do', dueDate: '2026-07-02T00:00:00.000Z' },
          ],
        }),
      },
    })

    render(<InspectionReport />)

    const extinguisherCard = screen.getByText('Extinguisher present?').closest('div.rounded-xl')!
    const conditionCard = screen.getByText('Condition rating').closest('div.rounded-xl')!

    // Each question's card shows only its own action chip, not the other question's
    expect(within(extinguisherCard).getByText('Replace tag')).toBeInTheDocument()
    expect(within(extinguisherCard).queryByText('Recheck condition')).not.toBeInTheDocument()
    expect(within(conditionCard).getByText('Recheck condition')).toBeInTheDocument()
    expect(within(conditionCard).queryByText('Replace tag')).not.toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Actions' })).toBeInTheDocument()
    // Count badge next to the "Actions" heading (separate element, not concatenated text)
    expect(screen.getByText('2', { selector: 'span.bg-orange-100' })).toBeInTheDocument()
  })

  it('does not attach an action to any question when its question text matches none', () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          actions: [
            { _id: 'act-3', question: 'Some unrelated question not in this template', actionTitle: 'Orphan action', priority: 'medium', state: 'To do', dueDate: '2026-07-03T00:00:00.000Z' },
          ],
        }),
      },
    })

    render(<InspectionReport />)

    const extinguisherCard = screen.getByText('Extinguisher present?').closest('div.rounded-xl')!
    const conditionCard = screen.getByText('Condition rating').closest('div.rounded-xl')!

    expect(within(extinguisherCard).queryByText('Orphan action')).not.toBeInTheDocument()
    expect(within(conditionCard).queryByText('Orphan action')).not.toBeInTheDocument()
    // Still shows up in the actions table, just not attached to any question card
    expect(screen.getByText('Orphan action')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Actions' })).toBeInTheDocument()
    expect(screen.getByText('1', { selector: 'span.bg-orange-100' })).toBeInTheDocument()
  })

  it('renders the actions table and navigates when a row is clicked', async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          actions: [{ _id: 'act-1', question: 'Extinguisher present?', actionTitle: 'Replace tag', priority: 'high', state: 'To do', dueDate: '2026-07-01T00:00:00.000Z' }],
        }),
      },
    })

    render(<InspectionReport />)
    await userEvent.click(screen.getByRole('row', { name: /replace tag/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/single-action/act-1')
  })

  it('renders the unsplit text section when present', () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: makeInspection({ unSplit_text: 'Raw inspection transcript here.' }) },
    })

    render(<InspectionReport />)

    expect(screen.getByText('Unsplit Text')).toBeInTheDocument()
    expect(screen.getByText('Raw inspection transcript here.')).toBeInTheDocument()
  })

  it('opens and closes the media lightbox when a question media thumbnail is clicked', async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: {
        data: makeInspection({
          template: {
            templateName: 'Fire Safety Audit',
            pages: [
              { title: 'General', questions: [{ id: 'q-4', question: 'Site photo', answerType: 'input' }] },
            ],
          },
          // mediaFiles (attachments) are separate from the answer itself
          questionAnswers: [{ questionId: 'q-4', answer: 'Looks fine', note: '', mediaFiles: [{ url: 'https://cdn.example.com/photo.jpg', type: 'image' }] }],
        }),
      },
    })

    render(<InspectionReport />)
    expect(screen.queryByText('Media Preview')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /media-0/i }))
    expect(screen.getByText('Media Preview')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '×' }))
    expect(screen.queryByText('Media Preview')).not.toBeInTheDocument()
  })
})
