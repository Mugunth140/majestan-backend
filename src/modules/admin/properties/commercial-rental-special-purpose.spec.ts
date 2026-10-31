import { ValidationPipe } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CommercialRentalSpecialPurpose1786200000000 } from '../../../database/migrations/1786200000000-CommercialRentalSpecialPurpose';

describe('Commercial rental classifications', () => {
  it('keeps distinct property use, special purpose and accessibility fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true, skipMissingProperties: true });
    const details = { propertyUse: 'Corporate Office', specialPurpose: 'Bank Branch / ATM Hub', accessibility: 'Cut Road' };
    const result = await pipe.transform({ details }, { type: 'body', metatype: CreatePropertyDto });
    expect(result.details).toMatchObject(details);
  });
  it('only creates its storage column when absent', async () => {
    const hasColumn = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const query = jest.fn();
    const runner = { hasColumn, query } as unknown as QueryRunner;
    await new CommercialRentalSpecialPurpose1786200000000().up(runner);
    await new CommercialRentalSpecialPurpose1786200000000().up(runner);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('ALTER TABLE property_details ADD COLUMN special_purpose VARCHAR(255) NULL');
  });
});
