import { api } from './api'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }
}

beforeEach(() => {
  mockFetch.mockReset()
  // Ensure VITE_API_BASE_URL is blank in tests
  import.meta.env.VITE_API_BASE_URL = ''
})

describe('api client', () => {
  it('sends credentials: include on every request', async () => {
    mockFetch.mockResolvedValue(makeResponse({ data: {} }))
    await api.get('/api/test')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('unwraps server { data } envelope', async () => {
    mockFetch.mockResolvedValue(makeResponse({ success: true, data: { id: '1' } }))
    const result = await api.get<{ id: string }>('/api/test')
    expect(result).toEqual({ id: '1' })
  })

  it('throws ApiError with server message on non-ok response', async () => {
    mockFetch.mockResolvedValue(makeResponse({ message: 'Not found' }, 404))
    await expect(api.get('/api/test')).rejects.toThrow('Not found')
  })

  it('throws ApiError with status 401 on unauthorized', async () => {
    mockFetch.mockResolvedValue(makeResponse({ message: 'Unauthorized' }, 401))
    await expect(api.get('/api/test')).rejects.toMatchObject({
      status: 401,
    })
  })

  it('sends JSON body on post', async () => {
    mockFetch.mockResolvedValue(makeResponse({ data: {} }))
    await api.post('/api/test', { email: 'test@example.com' })
    const [, init] = mockFetch.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ email: 'test@example.com' }))
  })

  it('returns undefined on 204 No Content', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: vi.fn() })
    const result = await api.delete('/api/test')
    expect(result).toBeUndefined()
  })

  it('returns undefined on 204 No Content', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: vi.fn() })
    const result = await api.delete('/api/test')
    expect(result).toBeUndefined()
  })
})
