jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), { virtual: true });
jest.mock('meilisearch', () => ({ Meilisearch: jest.fn() }), { virtual: true });
import { ValidationPipe } from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';
import { AdminPropertiesService } from './admin-properties.service';
import { generateSeoSlug, parsePropertySlugSuffix } from '../../properties/utils/property-slug.util';
import { IndustrialLandAndFarmHouse1786100000000 } from '../../../database/migrations/1786100000000-IndustrialLandAndFarmHouse';
import type { QueryRunner } from 'typeorm';

describe('Industrial, land and Farm House persistence', () => {
  it('accepts long certificate selections and the new nested fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true, skipMissingProperties: true });
    const details = { buildingApprovalCert: 'DTCP / Local Planning Approved Plan, TNPCB CTO (Consent to Operate), PESO License (Chemicals & Explosives)', propertyUse: 'General Warehousing, Logistics & Distribution', containerAccess: '60 ft', laborRooms: 0, toilets: 4, boreWellCount: 2, plotBoundaries: ['North East', 'East', 'South', 'West'].map((direction) => ({ direction, length: null, unit: 'ft' })) };
    const result = await pipe.transform({ propertyType: 'farm_house', details }, { type: 'body', metatype: CreatePropertyDto });
    expect(result.propertyType).toBe('farm_house');
    expect(result.details).toMatchObject(details);
  });
  it('rejects unsupported boundary directions and negative room counts', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true, skipMissingProperties: true });
    await expect(pipe.transform({ details: { laborRooms: -1 } }, { type: 'body', metatype: CreatePropertyDto })).rejects.toThrow();
    await expect(pipe.transform({ details: { plotBoundaries: Array.from({ length: 4 }, () => ({ direction: 'Unknown', length: 40, unit: 'ft' })) } }, { type: 'body', metatype: CreatePropertyDto })).rejects.toThrow();
  });
  it('blocks Farm House rentals and resolves its independent slug type', async () => {
    await expect(AdminPropertiesService.prototype.create.call({} as AdminPropertiesService, 'farm_house', { listingType: 'Rent' } as CreatePropertyDto)).rejects.toThrow('Buy only');
    await expect(AdminPropertiesService.prototype.update.call({} as AdminPropertiesService, 'farm_house', 7, { listingType: 'Rent' })).rejects.toThrow('Buy only');
    expect(parsePropertySlugSuffix(generateSeoSlug('Farm Home', 'farm_house', 7))).toEqual({ propertyType: 'farm_house', id: 7 });
  });
  it('preserves the existing enum when infra has already added Farm House', async () => {
    const query = jest.fn(async (_sql: string) => [{ columnType: "enum('other','farm_house')" }]);
    const hasColumn = jest.fn(async () => true);
    await new IndustrialLandAndFarmHouse1786100000000().up({ query, hasColumn } as unknown as QueryRunner);
    expect(query.mock.calls.some(([sql]) => sql.includes('MODIFY property_type'))).toBe(false);
    expect(query).toHaveBeenCalledWith('ALTER TABLE property_details MODIFY property_use TEXT NULL, MODIFY building_approval_cert TEXT NULL');
  });
});
