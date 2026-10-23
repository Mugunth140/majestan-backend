import { revalidatePublicInventory } from './frontend-revalidation';

describe('CRM public cache refresh', () => {
  const previousUrl = process.env.FRONTEND_URL;
  const previousSecret = process.env.REVALIDATE_SECRET;
  const originalFetch = global.fetch;
  afterEach(() => {
    if (previousUrl === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.REVALIDATE_SECRET; else process.env.REVALIDATE_SECRET = previousSecret;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });
  it('uses the configured shared secret and the committed inventory change', async () => {
    process.env.FRONTEND_URL = 'https://site.example/';
    process.env.REVALIDATE_SECRET = 'test-secret';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(global, "fetch", { configurable: true, writable: true, value: fetchMock });
    expect(await revalidatePublicInventory({ tag: 'public-inventory' })).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://site.example/api/revalidate', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ tag: 'public-inventory', secret: 'test-secret' }),
    }));
  });
  it('does not send a hardcoded fallback secret', async () => {
    delete process.env.REVALIDATE_SECRET;
    Object.defineProperty(global, "fetch", { configurable: true, writable: true, value: jest.fn() });
    expect(await revalidatePublicInventory({ slug: 'home-ap01' })).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('reports unsuccessful refreshes without failing a committed CRM save', async () => {
    process.env.FRONTEND_URL = 'https://site.example';
    process.env.REVALIDATE_SECRET = 'test-secret';
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    Object.defineProperty(global, "fetch", { configurable: true, writable: true, value: jest.fn().mockResolvedValue({ ok: false, status: 401 }) });
    expect(await revalidatePublicInventory({ slug: 'home-ap01' })).toBe(false);
  });
});
