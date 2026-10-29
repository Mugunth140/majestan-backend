jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), { virtual: true });
jest.mock('meilisearch', () => ({ Meilisearch: jest.fn() }), { virtual: true });

import { validate } from 'class-validator';
import { AdminPropertiesService } from './admin-properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyType } from '../../../database/entities/property.entity';
import { generateSeoSlug, parsePropertySlugSuffix } from '../../properties/utils/property-slug.util';

describe('Investment Property support', () => {
  it('accepts the new type in the shared admin DTO', async () => {
    const dto = Object.assign(new CreatePropertyDto(), { propertyType: PropertyType.INVESTMENT_PROPERTY });
    const errors = await validate(dto);
    expect(errors.filter((error) => error.property === 'propertyType')).toEqual([]);
  });

  it('rejects rental writes before touching the database', async () => {
    const payload = { listingType: 'Rent' } as CreatePropertyDto;
    await expect(AdminPropertiesService.prototype.create.call({} as AdminPropertiesService, 'investment_property', payload)).rejects.toThrow('Buy only');
    await expect(AdminPropertiesService.prototype.update.call({} as AdminPropertiesService, 'investment_property', 7, payload)).rejects.toThrow('Buy only');
  });

  it('uses a distinct slug code that resolves to the new type', () => {
    const slug = generateSeoSlug('Investment Home', 'investment_property', 7);
    expect(slug).toBe('investment-home-iv007');
    expect(parsePropertySlugSuffix(slug)).toEqual({ propertyType: 'investment_property', id: 7 });
  });
});
