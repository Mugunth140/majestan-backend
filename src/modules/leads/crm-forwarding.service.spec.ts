import { CrmForwardingService } from './crm-forwarding.service';

describe('CrmForwardingService', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env.CRM_BASE_URL = 'http://crm-test:8000/api/v1';
    process.env.SITE_TO_CRM_SERVICE_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as unknown as Response) as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
    jest.restoreAllMocks();
  });

  it('forwards enquiry to CRM telecalling queue', async () => {
    const service = new CrmForwardingService();
    await service.forwardEnquiry({
      name: 'Test Buyer',
      mobile: '9876543210',
      source: 'Website – WhatsApp popup',
      pageUrl: '/apartments-for-sale-in-coimbatore',
    } as unknown as Parameters<CrmForwardingService['forwardEnquiry']>[0]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as unknown as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://crm-test:8000/api/v1/leads/website');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'X-Service-Key': 'test-key' });
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      name: 'Test Buyer',
      mobile: '9876543210',
      whatsapp: '9876543210',
    });
  });
});
