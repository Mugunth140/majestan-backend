import { PropertyEnquiryController } from './property-enquiry.controller';
import { CreatePropertyEnquiryDto } from './dto/create-property-enquiry.dto';

describe('PropertyEnquiryController', () => {
  it('delegates to LeadsService with the JWT user id', async () => {
    const createPropertyEnquiry = jest.fn().mockResolvedValue({ id: 3, submitted: true });
    const controller = new PropertyEnquiryController({ createPropertyEnquiry } as any);
    const dto = { propertyId: 18, name: 'Rahul', phone: '9876543210', intent: 'enquiry' } as CreatePropertyEnquiryDto;
    await expect(controller.create(dto, { sub: 42, username: 'r@x.com', role: 'user' } as any)).resolves.toEqual({
      id: 3,
      submitted: true,
    });
    expect(createPropertyEnquiry).toHaveBeenCalledWith(dto, 42);
  });

  it('passes null userId when no user is attached', async () => {
    const createPropertyEnquiry = jest.fn().mockResolvedValue({ id: 4, submitted: true });
    const controller = new PropertyEnquiryController({ createPropertyEnquiry } as any);
    const dto = { propertyId: 18, name: 'R', phone: '9876543210', intent: 'enquiry' } as CreatePropertyEnquiryDto;
    await controller.create(dto, undefined);
    expect(createPropertyEnquiry).toHaveBeenCalledWith(dto, null);
  });
});