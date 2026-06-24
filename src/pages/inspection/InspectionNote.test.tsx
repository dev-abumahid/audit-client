import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import InspectionNote from './InspectionNote'

const mockNavigate = vi.fn()
vi.mock('react-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router')>()
  return {
    ...mod,
    useParams: () => ({ id: 'insp-1' }),
    useNavigate: () => mockNavigate,
  }
})

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

const existingNote = {
  id: 'note-1',
  title: 'Site inspection notes',
  extracted_text: 'The fire extinguisher in zone B was found to be expired.',
  inspectionId: 'insp-1',
  createdAt: '2026-06-21T10:00:00.000Z',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <InspectionNote />
    </MemoryRouter>,
  )
}

describe('InspectionNote', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockNavigate.mockReset()
  })

  it('shows a loading spinner while checking for an existing note', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows upload form when no note exists', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve(null) })
    renderPage()
    await waitFor(() => expect(screen.getByText(/Drop a file here/i)).toBeInTheDocument())
  })

  it('shows existing note content when a note already exists', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: existingNote }))
    renderPage()
    await waitFor(() => expect(screen.getByText('Site inspection notes')).toBeInTheDocument())
    expect(screen.getByText(/fire extinguisher in zone B/i)).toBeInTheDocument()
  })

  it('shows "Back to inspection" link when a note exists', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: existingNote }))
    renderPage()
    await waitFor(() => expect(screen.getByText('Back to inspection')).toBeInTheDocument())
  })

  it('shows an error when an invalid file type is selected', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve(null) })
    renderPage()
    await waitFor(() => screen.getByText(/Drop a file here/i))

    // userEvent.upload skips display:none inputs — use fireEvent directly
    const file = new File(['content'], 'notes.txt', { type: 'text/plain' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(screen.getByText(/Only PDF, JPG, PNG, or WEBP/i)).toBeInTheDocument(),
    )
  })

  it('shows the selected filename as a chip', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve(null) })
    renderPage()
    await waitFor(() => screen.getByText(/Drop a file here/i))

    const file = new File(['%PDF'], 'report.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.getByText('report.pdf')).toBeInTheDocument()
  })

  it('shows extracted text and navigates after a successful upload + AI extraction', async () => {
    // First call: GET by-inspection → 404
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve(null) })
      // Second call: POST extract-note-from-file
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 'note-new',
            title: 'Extracted',
            extracted_text: 'Zone B extinguisher expired.',
            inspectionId: 'insp-1',
            createdAt: '2026-06-22T10:00:00.000Z',
          },
        }),
      )
      // Third call: POST split-note-into-inspection
      .mockResolvedValueOnce(jsonResponse({ data: 'success fully splitted' }))

    renderPage()
    await waitFor(() => screen.getByText(/Drop a file here/i))

    const file = new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    await userEvent.click(screen.getByText(/Upload & extract/i))

    await waitFor(() =>
      expect(screen.getByText(/Notes uploaded/i)).toBeInTheDocument(),
    )
    expect(screen.getByText('Zone B extinguisher expired.')).toBeInTheDocument()
    expect(screen.getByText('Review answers →')).toBeInTheDocument()
  })
})
