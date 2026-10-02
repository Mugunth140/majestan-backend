import { CrmForwardingService, propertyLabelFromPageUrl } from './crm-forwarding.service';

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

  it('pins the property-page forward contract (URL, service key, whatsapp, source label, property identity)', async () => {
    const service = new CrmForwardingService();
    // Mirrors the forwardEnquiry call site in LeadsService.createPropertyEnquiry
    // (leads.service.ts) so the outgoing CRM body cannot drift silently. The
    // service is a pass-through (`{ ...args, whatsapp: args.mobile }`), so every
    // property-page key asserted here must survive the hop verbatim.
    await service.forwardEnquiry({
      name: 'Priya Raman',
      mobile: '9876543210',
      email: 'priya@example.com',
      source: 'Website – Property page',
      propertyType: 'Apartment',
      intent: 'site_visit',
      visitDate: '2026-11-14',
      visitSlot: '10:00 AM - 12:00 PM',
      propertyId: 18,
      propertyCode: 'MJ-APT-018',
      propertySlug: '3-bhk-apartment-in-k-k-nagar-coimbatore',
      preferences: { pageUrl: undefined, source: 'property_page' },
    } as unknown as Parameters<CrmForwardingService['forwardEnquiry']>[0]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as unknown as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];

    // Endpoint: <CRM_BASE_URL>/leads/website
    expect(url).toBe('http://crm-test:8000/api/v1/leads/website');
    expect(init.method).toBe('POST');

    // Service key travels as a header, never in the body, and comes from env.
    expect(init.headers).toMatchObject({
      'X-Service-Key': process.env.SITE_TO_CRM_SERVICE_KEY,
    });
    expect((init.headers as Record<string, string>)['X-Service-Key']).toBe(
      'test-key',
    );

    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    // The CRM's `whatsapp` field is duplicated from `mobile`.
    expect(body.whatsapp).toBe(body.mobile);
    expect(body.whatsapp).toBe('9876543210');

    // Property identity and visit intent survive the hop.
    expect(body).toMatchObject({
      name: 'Priya Raman',
      mobile: '9876543210',
      source: 'Website – Property page',
      propertyId: 18,
      propertyCode: 'MJ-APT-018',
      propertySlug: '3-bhk-apartment-in-k-k-nagar-coimbatore',
      intent: 'site_visit',
      visitDate: '2026-11-14',
      visitSlot: '10:00 AM - 12:00 PM',
    });

    // The source label uses an EN DASH (U+2013), not a hyphen or em dash —
    // Task 7 maps this exact string into `lead_source`, so a silent swap to
    // U+0020/U+2014 would break that mapping with no test-visible symptom
    // beyond this assertion.
    const sourceLabel = String(body.source);
    expect(sourceLabel.codePointAt(8)).toBe(0x2013);
    expect(sourceLabel).toBe(
      `Website ${String.fromCodePoint(0x2013)} Property page`,
    );
  });

  describe('propertyLabelFromPageUrl', () => {
    it.each([
      ['/apartments-for-sale-in-coimbatore', 'Apartments'],
      ['/2-bhk-villas-for-rent-in-rs-puram-coimbatore', 'Villas'],
      ['/properties-for-sale-in-coimbatore', 'Properties'],
    ])('maps %s to %s', (pageUrl, expected) => {
      expect(propertyLabelFromPageUrl(pageUrl)).toBe(expected);
    });

    it('returns undefined for non-PSEO path', () => {
      expect(propertyLabelFromPageUrl('/some/random')).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
      expect(propertyLabelFromPageUrl(undefined)).toBeUndefined();
    });
  });
});
