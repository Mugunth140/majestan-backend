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
      [expect.stringContaining('filterDetails.specialPurpose LIKE :filterPurpose'),{filterPurpose:'%Clinic%',filterPurposeExact:'Clinic'}], ['p.roadName = :filterRoad',{filterRoad:'Avinashi Road'}],
    ]) expect(qb.andWhere).toHaveBeenCalledWith(...entry);
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining(':filterFurnishing'), expect.objectContaining({filterFurnishing:'semifurnished'}));
  });
  it('applies the more filters with bound values', () => {
    applyCrmPropertyFilters(qb, { bedrooms: '2', bathrooms: '4+', facing: ' East ', possessionStatus: 'Ready To Move', occupancy: 'owner', negotiable: 'no', parking: 'car' });
    expect(qb.andWhere).toHaveBeenCalledWith('filterDetails.bedrooms = :bedroomsCount', { bedroomsCount: 2 });
    expect(qb.andWhere).toHaveBeenCalledWith('filterDetails.bathrooms >= :bathroomsCount', { bathroomsCount: 4 });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('propertyFacing'), { filterFacing: 'East' });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('possessionStatus'), { filterPossession: 'Ready To Move' });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('$.ownerOccupied'));
    expect(qb.andWhere).toHaveBeenCalledWith('p.negotiable = :filterNegotiable', { filterNegotiable: false });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining("'Car'"));
  });
  it('validates the more filters', async () => {
    const ok = plainToInstance(AdminPropertyQueryDto, { bedrooms: '5+', occupancy: 'tenant', negotiable: 'yes', parking: 'bike' });
    expect(await validate(ok, { whitelist: true })).toEqual([]);
    const bad = plainToInstance(AdminPropertyQueryDto, { bedrooms: 'two', occupancy: 'x', parking: 'truck' });
    expect((await validate(bad)).map((e) => e.property).sort()).toEqual(['bedrooms', 'occupancy', 'parking']);
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

describe('Uploader and upload dates', () => {
  it('combines a staff ID with inclusive India calendar dates', () => {
    const qb:any={andWhere:jest.fn().mockReturnThis(),leftJoin:jest.fn().mockReturnThis()};
    applyCrmPropertyFilters(qb,{uploadedById:7,uploadedFrom:'2026-11-01',uploadedTo:'2026-11-02'});
    expect(qb.andWhere).toHaveBeenCalledWith('p.uploadedByCrmUserId = :uploadedById',{uploadedById:7});
    const start=qb.andWhere.mock.calls.find(([sql]:string[])=>sql.includes(':uploadedFromEpoch'))[1].uploadedFromEpoch;
    const end=qb.andWhere.mock.calls.find(([sql]:string[])=>sql.includes(':uploadedToEpoch'))[1].uploadedToEpoch;
    expect(new Date(start*1000).toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(new Date(end*1000).toISOString()).toBe('2026-11-02T18:30:00.000Z');
    expect(qb.andWhere).toHaveBeenCalledWith('p.createdAt < FROM_UNIXTIME(:uploadedToEpoch)',{uploadedToEpoch:end});
  });
  it.each([{uploadedFrom:'2026-11-03',uploadedTo:'2026-11-02'},{uploadedFrom:'2026-02-30'},{uploadedFrom:'bad'}])('rejects invalid dates %j',query=>{
    const qb:any={andWhere:jest.fn().mockReturnThis(),leftJoin:jest.fn().mockReturnThis()};
    expect(()=>applyCrmPropertyFilters(qb,query)).toThrow();
  });
  it.each([{uploadedById:'1.5'},{uploadedById:0},{uploadedFrom:'2026-02-30'},{uploadedTo:'2026-11-02T15:00:00Z'}])('rejects invalid uploader/date query values %j',async value=>{
    expect((await validate(plainToInstance(AdminPropertyQueryDto,value),{whitelist:true})).length).toBeGreaterThan(0);
  });
});
