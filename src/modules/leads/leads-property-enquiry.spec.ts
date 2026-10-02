import { LeadsService } from './leads.service';

function makeService(db: { propertyRow: any }) {
  const queries: any[] = [];
  const qb: any = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(db.propertyRow),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn((v: any) => {
      queries.push(v);
      return qb;
    }),
    execute: jest.fn().mockResolvedValue({ identifiers: [{ id: 77 }], raw: { insertId: 77 } }),
  };
  const dataSource = { createQueryBuilder: jest.fn().mockReturnValue(qb) } as any;
  const crmForwarding = { forwardEnquiry: jest.fn().mockResolvedValue(undefined) } as any;
  return { service: new LeadsService(dataSource, crmForwarding), queries, qb, crmForwarding };
}

/**
 * The id the client asks for. The DB row deliberately resolves to a DIFFERENT
 * id (RESOLVED_ID below) so every assertion about the insert / CRM forward
 * proves those use the resolved row rather than echoing the client's value.
 */
const CLIENT_PROPERTY_ID = 18;
const RESOLVED_ID = 7;

const ENQUIRY = {
  propertyId: CLIENT_PROPERTY_ID,
  name: 'Rahul',
  phone: '9876543210',
  intent: 'enquiry',
} as any;

const RESOLVED_ROW = { id: RESOLVED_ID, propertyCode: 'AP018', slug: 'some-villa-ap018' };

/**
 * A calendar date `daysAhead` from now, in the exact 'YYYY-MM-DD' form the
 * service's own date helper produces (and the only form it accepts). Computed
 * rather than hardcoded so these cases never expire into the past-date branch,
 * and assembled from date parts so it does not inherit an ICU dependency.
 */
function dateAhead(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const VALID_VISIT_DATE = dateAhead(7);

describe('createPropertyEnquiry', () => {
  it('inserts with the DB-resolved property id, looked up by the client id', async () => {
    const { service, queries, qb } = makeService({ propertyRow: RESOLVED_ROW });
    await expect(service.createPropertyEnquiry(ENQUIRY, 42)).resolves.toEqual({ id: 77, submitted: true });
    // The client's id drives the lookup…
    expect(qb.where).toHaveBeenCalledWith('p.id = :id', { id: CLIENT_PROPERTY_ID });
    // …and the DB row's id drives the insert. If these two ever collapse, the
    // "insert and forward use the resolved id" constraint is no longer covered.
    expect(queries[0]).toEqual(
      expect.objectContaining({ propertyId: RESOLVED_ID, userId: 42, name: 'Rahul', phone: '9876543210' }),
    );
    expect(queries[0].propertyId).not.toBe(CLIENT_PROPERTY_ID);
  });

  it('400s when the property does not exist', async () => {
    const { service } = makeService({ propertyRow: null });
    await expect(service.createPropertyEnquiry(ENQUIRY, 42)).rejects.toThrow('Property not found');
  });

  it('requires date and slot for a visit, and rejects past dates', async () => {
    const { service } = makeService({ propertyRow: RESOLVED_ROW });
    await expect(
      service.createPropertyEnquiry({ ...ENQUIRY, intent: 'site_visit' }, 42),
    ).rejects.toThrow('Visit date and time slot are required');
    await expect(
      service.createPropertyEnquiry({ ...ENQUIRY, intent: 'site_visit', visitDate: '2000-01-01', visitSlot: '11:00' }, 42),
    ).rejects.toThrow('Visit date cannot be in the past');
    await expect(
      service.createPropertyEnquiry({ ...ENQUIRY, intent: 'site_visit', visitDate: VALID_VISIT_DATE, visitSlot: '09:30' }, 42),
    ).rejects.toThrow('Invalid visit slot');
  });

  it('rejects a visit date that is not exactly YYYY-MM-DD', async () => {
    // @IsDateString() also accepts the compact-ISO form, and a raw string
    // comparison silently lets it through the past-date check.
    const { service } = makeService({ propertyRow: RESOLVED_ROW });
    await expect(
      service.createPropertyEnquiry(
        { ...ENQUIRY, intent: 'site_visit', visitDate: VALID_VISIT_DATE.replace(/-/g, ''), visitSlot: '11:00' },
        42,
      ),
    ).rejects.toThrow('Invalid visit date');
  });

  it('drops visit fields on a plain enquiry', async () => {
    // The site's own @IsDateString() accepts a full ISO datetime, and this
    // forward is fire-and-forget — a MySQL DATE-column rejection on the CRM
    // side would only ever be logged, silently losing the lead. Visit fields
    // are meaningful only for a visit intent, so an enquiry never forwards
    // them, whatever the client sent.
    const { service, crmForwarding } = makeService({ propertyRow: RESOLVED_ROW });
    await service.createPropertyEnquiry(
      { ...ENQUIRY, intent: 'enquiry', visitDate: `${VALID_VISIT_DATE}T10:00:00Z`, visitSlot: '11:00' },
      42,
    );

    const forwarded = crmForwarding.forwardEnquiry.mock.calls[0][0];
    expect(forwarded).not.toHaveProperty('visitDate');
    expect(forwarded).not.toHaveProperty('visitSlot');
    // The enquiry itself still forwards — only the meaningless visit data goes.
    expect(forwarded).toEqual(expect.objectContaining({ intent: 'enquiry', propertyId: RESOLVED_ID }));
  });

  it('forwards the resolved id and canonical code/slug, ignoring spoofed ones', async () => {
    const { service, crmForwarding } = makeService({ propertyRow: RESOLVED_ROW });
    await service.createPropertyEnquiry(
      {
        ...ENQUIRY,
        intent: 'site_visit',
        visitDate: VALID_VISIT_DATE,
        visitSlot: '11:00',
        propertyCode: 'SPOOFED',
        slug: 'SPOOFED-SLUG',
        message: 'hi',
      },
      42,
    );
    expect(crmForwarding.forwardEnquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'Website – Property page',
        propertyId: RESOLVED_ID,
        propertyCode: 'AP018',
        propertySlug: 'some-villa-ap018',
        intent: 'site_visit',
        visitDate: VALID_VISIT_DATE,
        visitSlot: '11:00',
      }),
    );
    // DB-canonical values win over client-sent ones, and the client's own
    // propertyId is never echoed back.
    expect(crmForwarding.forwardEnquiry).not.toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: CLIENT_PROPERTY_ID }),
    );
    expect(crmForwarding.forwardEnquiry).not.toHaveBeenCalledWith(
      expect.objectContaining({ propertyCode: 'SPOOFED' }),
    );
    expect(crmForwarding.forwardEnquiry).not.toHaveBeenCalledWith(
      expect.objectContaining({ propertySlug: 'SPOOFED-SLUG' }),
    );
  });

  it('still reports success when the CRM forward rejects', async () => {
    // Fire-and-forget: a CRM outage must not turn into a failed submission.
    const { service, crmForwarding } = makeService({ propertyRow: RESOLVED_ROW });
    crmForwarding.forwardEnquiry.mockRejectedValue(new Error('CRM gateway down'));
    await expect(service.createPropertyEnquiry(ENQUIRY, 42)).resolves.toEqual({ id: 77, submitted: true });
    expect(crmForwarding.forwardEnquiry).toHaveBeenCalledTimes(1);
  });
});