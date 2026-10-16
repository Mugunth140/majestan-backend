import { LeadsService, enquirySourceLabel } from './leads.service';

function makeService() {
  const qb: any = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    execute: jest
      .fn()
      .mockResolvedValue({ identifiers: [{ id: 41 }], raw: { insertId: 41 } }),
  };
  const dataSource = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  } as any;
  const crmForwarding = {
    forwardEnquiry: jest.fn().mockResolvedValue(undefined),
  } as any;
  return {
    service: new LeadsService(dataSource, crmForwarding),
    qb,
    crmForwarding,
  };
}

describe('createEnquiry CRM forwarding', () => {
  it('forwards a service-page callback labelled with that page, with the message as notes', async () => {
    const { service, crmForwarding } = makeService();

    await service.createEnquiry({
      name: '  Priya ',
      phone: '+91 98765 43210',
      message: ' DTCP approval for a 2-acre layout in Annur ',
      source: 'liaisoning_cta',
      pageUrl: 'https://www.majestanrealty.com/services/liaisoning',
    } as any);

    expect(crmForwarding.forwardEnquiry).toHaveBeenCalledTimes(1);
    const args = crmForwarding.forwardEnquiry.mock.calls[0][0];
    expect(args).toEqual({
      name: 'Priya',
      mobile: '9876543210',
      email: undefined,
      source: 'Website – Liaisoning page',
      propertyType: undefined,
      listingType: undefined,
      notes: 'DTCP approval for a 2-acre layout in Annur',
    });
    // The page URL is deliberately not sent; the source label names the page.
    expect(JSON.stringify(args)).not.toContain('pageUrl');
  });

  it('still saves the enquiry locally', async () => {
    const { service, qb } = makeService();

    const result = await service.createEnquiry({
      name: 'Priya',
      phone: '9876543210',
      message: 'Looking for a home loan',
      source: 'financial_assistance_cta',
    } as any);

    expect(qb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Priya',
        phone: '9876543210',
        message: 'Looking for a home loan',
      }),
    );
    expect(result).toEqual({ id: 41, submitted: true });
  });

  it('keeps the WhatsApp popup on its own forward, not a second one', async () => {
    const { service, crmForwarding } = makeService();

    await service.createEnquiry({
      name: 'Priya',
      phone: '9876543210',
      source: 'whatsapp_popup',
    } as any);

    expect(crmForwarding.forwardEnquiry).toHaveBeenCalledTimes(1);
    expect(crmForwarding.forwardEnquiry.mock.calls[0][0].source).toBe(
      'Website – WhatsApp popup',
    );
  });

  it('does not forward when there is no usable phone number', async () => {
    const { service, crmForwarding } = makeService();

    await service.createEnquiry({
      name: 'Priya',
      phone: '',
      source: 'nri_cta',
    } as any);

    expect(crmForwarding.forwardEnquiry).not.toHaveBeenCalled();
  });
});

describe('enquirySourceLabel', () => {
  it('names the page for every service form and the contact page', () => {
    expect(enquirySourceLabel('liaisoning_cta')).toBe(
      'Website – Liaisoning page',
    );
    expect(enquirySourceLabel('property_management_cta')).toBe(
      'Website – Property Management page',
    );
    expect(enquirySourceLabel('brokerage_cta')).toBe(
      'Website – Brokerage page',
    );
    expect(enquirySourceLabel('nri_cta')).toBe('Website – NRI Services page');
    expect(enquirySourceLabel('financial_assistance_cta')).toBe(
      'Website – Financial Assistance page',
    );
    expect(enquirySourceLabel('contact_page')).toBe('Website – Contact page');
  });

  it('falls back to a generic label for forms without a known source', () => {
    expect(enquirySourceLabel(undefined)).toBe('Website – Enquiry form');
    expect(enquirySourceLabel('something_new')).toBe('Website – Enquiry form');
  });
});
