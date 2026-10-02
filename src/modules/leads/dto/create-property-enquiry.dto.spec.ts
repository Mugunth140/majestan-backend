import { validate } from 'class-validator';
import { CreatePropertyEnquiryDto } from './create-property-enquiry.dto';

async function errorsOf(patch: Record<string, unknown>) {
  const dto = Object.assign(new CreatePropertyEnquiryDto(), {
    propertyId: 18,
    name: 'Rahul',
    phone: '9876543210',
    intent: 'enquiry',
    ...patch,
  });
  return validate(dto);
}

describe('CreatePropertyEnquiryDto', () => {
  it('accepts a minimal enquiry', async () => {
    expect(await errorsOf({})).toEqual([]);
  });

  it('accepts a visit with date and slot', async () => {
    expect(
      await errorsOf({
        intent: 'site_visit',
        visitDate: '2026-10-05',
        visitSlot: '11:00',
      }),
    ).toEqual([]);
  });

  it('rejects a non-positive propertyId', async () => {
    const errors = await errorsOf({ propertyId: 0 });
    expect(errors.some((e) => e.property === 'propertyId')).toBe(true);
  });

  it('rejects an unknown intent', async () => {
    const errors = await errorsOf({ intent: 'callback' });
    expect(errors.some((e) => e.property === 'intent')).toBe(true);
  });

  it('rejects a malformed slot', async () => {
    const errors = await errorsOf({
      intent: 'site_visit',
      visitDate: '2026-10-05',
      visitSlot: '11pm',
    });
    expect(errors.some((e) => e.property === 'visitSlot')).toBe(true);
  });

  it('rejects a non-date visitDate', async () => {
    const errors = await errorsOf({
      intent: 'site_visit',
      visitDate: 'tomorrow',
      visitSlot: '11:00',
    });
    expect(errors.some((e) => e.property === 'visitDate')).toBe(true);
  });
});
