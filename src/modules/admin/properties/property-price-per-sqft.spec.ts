import { ValidationPipe } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { CreatePropertyDto } from './dto/create-property.dto';
import { AddPropertyPricePerSqft1785900000000 } from '../../../database/migrations/1785900000000-AddPropertyPricePerSqft';

describe('Property price per square foot', () => {
  it('keeps the rate separate from the total price through API validation', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true, skipMissingProperties: true });
    const dto = await pipe.transform({ pricePerSqft: '6500.50', expectedSalePrice: '9000000' }, { type: 'body', metatype: CreatePropertyDto });
    expect(dto.pricePerSqft).toBe('6500.50');
    expect(dto.expectedSalePrice).toBe('9000000');
  });
  it('adds storage when missing and skips schemas already migrated by infra', async () => {
    const query = jest.fn();
    const hasColumn = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const runner = { hasColumn, query } as unknown as QueryRunner;
    await new AddPropertyPricePerSqft1785900000000().up(runner);
    await new AddPropertyPricePerSqft1785900000000().up(runner);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('ALTER TABLE properties ADD COLUMN price_per_sqft DECIMAL(15,2) NULL AFTER expected_sale_price');
  });
});
