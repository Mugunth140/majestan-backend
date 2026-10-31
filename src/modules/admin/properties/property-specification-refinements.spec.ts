import { ValidationPipe } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertySpecificationRefinements1786000000000 } from '../../../database/migrations/1786000000000-PropertySpecificationRefinements';

describe('Property specification refinements', () => {
  it('keeps measurement metadata, counts and flags through nested validation', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true, skipMissingProperties: true });
    const details = { measurementUnits: { builtUpArea: 'Sq M', plotArea: 'Cents' }, plotFacing: 'East', hasGroundFloor: false, numberOfPortions: 3, fundedBy: 'Bank', noOfLifts: 2, parking: 4 };
    const result = await pipe.transform({ details }, { type: 'body', metatype: CreatePropertyDto });
    expect(result.details).toMatchObject(details);
  });
  it('adds only missing columns and is safe after infra migrations', async () => {
    const hasColumn = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const query = jest.fn();
    await new PropertySpecificationRefinements1786000000000().up({ hasColumn, query } as unknown as QueryRunner);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('ALTER TABLE property_details ADD COLUMN measurement_units JSON NULL');
  });
});
