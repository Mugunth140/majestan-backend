jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), { virtual: true });
jest.mock('meilisearch', () => ({ Meilisearch: jest.fn() }), { virtual: true });

import { validate } from 'class-validator';
import { AdminPropertiesService } from './admin-properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyType } from '../../../database/entities/property.entity';
import { generateSeoSlug, parsePropertySlugSuffix } from '../../properties/utils/property-slug.util';
import { AddInvestmentPropertyType1785700000000 } from '../../../database/migrations/1785700000000-AddInvestmentPropertyType';
import { AddPgServiceApartmentType1785800000000 } from '../../../database/migrations/1785800000000-AddPgServiceApartmentType';
import type { QueryRunner } from 'typeorm';

describe('PG / Service Apartment support', () => {
  it('accepts the new category in the shared admin DTO', async () => {
    const errors = await validate(Object.assign(new CreatePropertyDto(), { propertyType: PropertyType.PG_SERVICE_APARTMENT }));
    expect(errors.filter((error) => error.property === 'propertyType')).toEqual([]);
  });
  it('rejects sale creates and edits before touching the database', async () => {
    const payload = { listingType: 'Sell' } as CreatePropertyDto;
    await expect(AdminPropertiesService.prototype.create.call({} as AdminPropertiesService, 'pg_service_apartment', payload)).rejects.toThrow('Rent only');
    await expect(AdminPropertiesService.prototype.update.call({} as AdminPropertiesService, 'pg_service_apartment', 7, payload)).rejects.toThrow('Rent only');
  });
  it('uses a slug suffix that resolves to the new category', () => {
    const slug = generateSeoSlug('Service Apartment', 'pg_service_apartment', 7);
    expect(slug).toBe('service-apartment-pg007');
    expect(parsePropertySlugSuffix(slug)).toEqual({ propertyType: 'pg_service_apartment', id: 7 });
  });
  it('does not rewrite an enum already extended by the infra migrations', async () => {
    const query = jest.fn(async (_sql: string) => [{ columnType: "enum('other','investment_property','pg_service_apartment')" }]);
    const runner = { query } as unknown as QueryRunner;
    await new AddInvestmentPropertyType1785700000000().up(runner);
    await new AddPgServiceApartmentType1785800000000().up(runner);
    expect(query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
  });
  it('appends the PG category without removing existing enum values', async () => {
    const query = jest.fn(async (_sql: string) => [{ columnType: "enum('other','investment_property')" }]);
    await new AddPgServiceApartmentType1785800000000().up({ query } as unknown as QueryRunner);
    expect(query).toHaveBeenLastCalledWith("ALTER TABLE properties MODIFY property_type enum('other','investment_property','pg_service_apartment') NOT NULL DEFAULT 'other'");
  });
});
