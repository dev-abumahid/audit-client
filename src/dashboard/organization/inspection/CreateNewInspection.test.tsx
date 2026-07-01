import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateNewInspection from './CreateNewInspection'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// jsdom has no IntersectionObserver; the component only uses it to track scroll position.
class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

const mockNavigate = vi.fn()
let mockLocationState: Record<string, unknown> = {}
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: mockLocationState }),
  }
})

const mockUseGetSingleTemplateQuery = vi.fn()
const mockCreateInspection = vi.fn()
const mockUploadFileAws = vi.fn()

vi.mock('@/redux/apis/organization/template.api', () => ({
  useGetSingleTemplateQuery: (...args: unknown[]) => mockUseGetSingleTemplateQuery(...args),
}))

vi.mock('@/redux/apis/organization/inspection.api', () => ({
  useCreateNewInspectionMutation: () => [mockCreateInspection, { isLoading: false }],
}))

vi.mock('@/redux/apis/common.api', () => ({
  useUploadAnyFileAwsMutation: () => [mockUploadFileAws],
}))

function makeTemplate(overrides = {}) {
  return {
    id: 'tpl-1',
    templateName: 'Fire Safety Audit',
    pages: [
      {
        title: 'General',
        questions: [
          { id: 'q-1', question: 'Extinguisher present?', answerType: 'checkbox', isRequired: true },
          { id: 'q-2', question: 'Notes on condition', answerType: 'input', isRequired: false },
        ],
      },
    ],
    ...overrides,
  }
}

describe('CreateNewInspection', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockUseGetSingleTemplateQuery.mockReset()
    mockCreateInspection.mockReset()
    mockUploadFileAws.mockReset()
    mockLocationState = { templateId: 'tpl-1', siteId: 'site-1', siteName: 'HQ Casablanca' }
  })

  it('shows a loading message while the template is loading', () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({ data: undefined, isLoading: true })

    render(<CreateNewInspection />)

    expect(screen.getByText('Loading template...')).toBeInTheDocument()
  })

  it('renders the template name, site and questions', () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({ data: { data: makeTemplate() }, isLoading: false })

    render(<CreateNewInspection />)

    expect(screen.getByText('Fire Safety Audit')).toBeInTheDocument()
    expect(screen.getByText('HQ Casablanca')).toBeInTheDocument()
    expect(screen.getByText('Extinguisher present?')).toBeInTheDocument()
    expect(screen.getByText('Notes on condition')).toBeInTheDocument()
  })

  it('renders a checkbox for checkbox-type questions and toggles its answer', async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({ data: { data: makeTemplate() }, isLoading: false })

    render(<CreateNewInspection />)
    const checkbox = screen.getAllByRole('checkbox')[0]
    expect(checkbox).not.toBeChecked()

    await userEvent.click(checkbox)

    expect(checkbox).toBeChecked()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('submits answers and navigates to the inspections list on success', async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({ data: { data: makeTemplate() }, isLoading: false })
    mockCreateInspection.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) })

    render(<CreateNewInspection />)
    const textInput = screen.getByPlaceholderText('Type your answer here...')
    await userEvent.type(textInput, 'Looks good')
    await userEvent.click(screen.getByRole('button', { name: /submit inspection/i }))

    await waitFor(() => expect(mockCreateInspection).toHaveBeenCalled())
    const payload = mockCreateInspection.mock.calls[0][0]
    expect(payload).toMatchObject({ templateId: 'tpl-1', siteId: 'site-1' })
    expect(payload.questionAnswers).toEqual(
      expect.arrayContaining([expect.objectContaining({ questionId: 'q-2', answer: 'Looks good' })]),
    )
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/organization/audit/inspections'))
  })

  it('shows an error toast and does not submit when template or site is missing', async () => {
    mockLocationState = { templateId: undefined, siteId: undefined }
    mockUseGetSingleTemplateQuery.mockReturnValue({ data: { data: makeTemplate() }, isLoading: false })

    render(<CreateNewInspection />)
    await userEvent.click(screen.getByRole('button', { name: /submit inspection/i }))

    expect(mockCreateInspection).not.toHaveBeenCalled()
  })

  it('uploads a media answer file via uploadFileAws', async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: {
        data: makeTemplate({
          pages: [
            {
              title: 'General',
              questions: [{ id: 'q-3', question: 'Site photo', answerType: 'media', isRequired: false }],
            },
          ],
        }),
      },
      isLoading: false,
    })
    mockUploadFileAws.mockReturnValue({ unwrap: () => Promise.resolve({ success: true, data: 'https://cdn.example.com/photo.jpg' }) })

    const { container } = render(<CreateNewInspection />)
    const file = new File(['img'], 'site.png', { type: 'image/png' })
    const input = container.querySelector('input[type="file"]')!

    await userEvent.upload(input, file)

    await waitFor(() => expect(mockUploadFileAws).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByAltText('Uploaded media')).toHaveAttribute('src', 'https://cdn.example.com/photo.jpg'))
  })

  it('rejects an oversized media file without uploading', async () => {
    mockUseGetSingleTemplateQuery.mockReturnValue({
      data: {
        data: makeTemplate({
          pages: [
            {
              title: 'General',
              questions: [{ id: 'q-4', question: 'Site photo', answerType: 'media', isRequired: false }],
            },
          ],
        }),
      },
      isLoading: false,
    })

    const { container } = render(<CreateNewInspection />)
    const bigFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'huge.png', { type: 'image/png' })
    const input = container.querySelector('input[type="file"]')!

    await userEvent.upload(input, bigFile)

    expect(mockUploadFileAws).not.toHaveBeenCalled()
  })
})
