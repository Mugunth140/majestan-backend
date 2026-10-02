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
  return { service: new LeadsService(dataSource, crmForwarding), queries, crmForwarding };
}

const ENQUIRY = { propertyId: 18, name: 'Rahul', phone: '9876543210', intent: 'enquiry' } as any;

/**
 * A calendar date `daysAhead` from now, formatted exactly like the
 * service's `toLocaleDateString('en-CA')` baseline. Computed rather than
 * hardcoded so these cases never expire into the past-date branch.
 */
function dateAhead(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toLocaleDateString('en-CA');
}

const VALID_VISIT_DATE = dateAhead(7);

describe('createPropertyEnquiry', () => {
  it('inserts against the validated property with the JWT user id', async () => {
    const { service, queries } = makeService({
      propertyRow: { id: 18, propertyCode: 'AP018', slug: 'some-villa-ap018' },
    });
    await expect(service.createPropertyEnquiry(ENQUIRY, 42)).resolves.toEqual({ id: 77, submitted: true });
    expect(queries[0]).toEqual(
      expect.objectContaining({ propertyId: 18, userId: 42, name: 'Rahul', phone: '9876543210' }),
    );
  });

  it('400s when the property does not exist', async () => {
    const { service } = makeService({ propertyRow: null });
    await expect(service.createPropertyEnquiry(ENQUIRY, 42)).rejects.toThrow('Property not found');
  });

  it('requires date and slot for a visit, and rejects past dates', async () => {
    const { service } = makeService({ propertyRow: { id: 18, propertyCode: 'AP018', slug: 's' } });
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
    const { service } = makeService({ propertyRow: { id: 18, propertyCode: 'AP018', slug: 's' } });
    await expect(
      service.createPropertyEnquiry(
        { ...ENQUIRY, intent: 'site_visit', visitDate: VALID_VISIT_DATE.replace(/-/g, ''), visitSlot: '11:00' },
        42,
      ),
    ).rejects.toThrow('Invalid visit date');
  });

  it('forwards canonical code/slug and visit fields to the CRM in the background', async () => {
    const { service, crmForwarding } = makeService({
      propertyRow: { id: 18, propertyCode: 'AP018', slug: 'some-villa-ap018' },
    });
    await service.createPropertyEnquiry(
      { ...ENQUIRY, intent: 'site_visit', visitDate: VALID_VISIT_DATE, visitSlot: '11:00', propertyCode: 'SPOOFED', message: 'hi' },
      42,
    );
    expect(crmForwarding.forwardEnquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'Website – Property page',
        propertyId: 18,
        propertyCode: 'AP018',
        propertySlug: 'some-villa-ap018',
        intent: 'site_visit',
        visitDate: VALID_VISIT_DATE,
        visitSlot: '11:00',
      }),
    );
    // DB-canonical values win over client-sent ones:
    expect(crmForwarding.forwardEnquiry).not.toHaveBeenCalledWith(expect.objectContaining({ propertyCode: 'SPOOFED' }));
  });
});
