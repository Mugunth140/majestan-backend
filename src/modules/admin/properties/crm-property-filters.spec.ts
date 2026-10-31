import { applyCrmPropertyFilters } from './crm-property-filters';
import { AdminPropertyQueryDto } from './dto/admin-property-query.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('CRM property list filters', () => {
  let qb: any;
  beforeEach(() => { qb = { leftJoin: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis() }; });
  it('applies all requested filters to the database query with bound values', () => {
    applyCrmPropertyFilters(qb, { sublocationId: 3, minSqft: 0, maxSqft: 2000, minBudget: 1000, maxBudget: 20000,
      floor: ' Ground ', specialPurpose: 'Clinic', roadName: 'Avinashi Road', furnishingStatus: 'SEMI FURNISHED' });
    expect(qb.leftJoin).toHaveBeenCalledWith('p.propertyDetails', 'filterDetails');
    for (const entry of [
      ['sl.id = :filterLocation', {filterLocation:3}], ['filterDetails.areaSqft >= :minSqft',{minSqft:0}],
      ['filterDetails.areaSqft <= :maxSqft',{maxSqft:2000}], ['p.price >= :minBudget',{minBudget:1000}], ['p.price <= :maxBudget',{maxBudget:20000}],
      ['LOWER(TRIM(filterDetails.floorNumber)) = LOWER(:filterFloor)',{filterFloor:'Ground'}],
      ['(filterDetails.specialPurpose LIKE :filterPurpose OR filterDetails.propertyUse LIKE :filterPurpose)',{filterPurpose:'%Clinic%'}], ['p.roadName = :filterRoad',{filterRoad:'Avinashi Road'}],
    ]) expect(qb.andWhere).toHaveBeenCalledWith(...entry);
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining(':filterFurnishing'), expect.objectContaining({filterFurnishing:'semifurnished'}));
  });
  it('does not filter unspecified fields', () => { applyCrmPropertyFilters(qb,{}); expect(qb.andWhere).not.toHaveBeenCalled(); });
  it.each([{minSqft:100,maxSqft:1},{minBudget:100,maxBudget:1}])('rejects inverted ranges', query => {
    expect(() => applyCrmPropertyFilters(qb,query)).toThrow('Minimum');
  });
  it('keeps filter text out of SQL', () => {
    const text="x' OR 1=1 --";
    applyCrmPropertyFilters(qb,{roadName:text,specialPurpose:text});
    for(const [sql] of qb.andWhere.mock.calls) expect(sql).not.toContain(text);
  });
  it.each(['FULLY FURNISHED','UNFURNISHED','SEMI FURNISHED','BARESHELL'])('supports furnishing %s', furnishingStatus => {
    applyCrmPropertyFilters(qb,{furnishingStatus});
    const sql=qb.andWhere.mock.calls[0][0];
    if(['FULLY FURNISHED','UNFURNISHED'].includes(furnishingStatus)) expect(sql).toContain('filterDetails.furnished');
    else expect(sql).not.toContain('filterDetails.furnished');
  });
  it('retains filters through the validation whitelist and transforms numbers', async () => {
    const dto=plainToInstance(AdminPropertyQueryDto,{minSqft:'100',maxSqft:'2000',minBudget:'0',maxBudget:'300000',sublocationId:'3',floor:'2',specialPurpose:'Office',roadName:'Avinashi Road',furnishingStatus:'SEMI FURNISHED'});
    expect(await validate(dto,{whitelist:true})).toEqual([]);expect(dto.minSqft).toBe(100);expect(dto.sublocationId).toBe(3);expect(dto.specialPurpose).toBe('Office');
  });
  it.each([{minSqft:-1},{maxBudget:'bad'}])('rejects invalid range values %o', async values => {
    expect((await validate(plainToInstance(AdminPropertyQueryDto,values))).length).toBeGreaterThan(0);
  });
});
