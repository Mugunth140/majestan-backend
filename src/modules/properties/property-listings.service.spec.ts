jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), {
  virtual: true,
});
jest.mock('meilisearch', () => ({ Meilisearch: jest.fn() }), { virtual: true });

import { DataSource, SelectQueryBuilder } from 'typeorm';
import { ValidationPipe } from '@nestjs/common';
import { Project } from '../../database/entities/project.entity';
import { Property } from '../../database/entities/property.entity';
import { ProjectsService } from '../projects/projects.service';
import { AdminPropertiesService } from '../admin/properties/admin-properties.service';
import { PropertiesService } from './properties.service';
import { PropertyListingsService } from './property-listings.service';
import {
  PropertySearchQueryDto,
  PropertySortOption,
} from './dto/property-search.dto';
import { StorageService } from '../storage/storage.service';

describe('Combined property and project listings', () => {
  let dataSource: DataSource;
  let properties: PropertiesService;
  let service: PropertyListingsService;
  const query = (overrides = {}) =>
    Object.assign(
      new PropertySearchQueryDto(),
      { listingType: 'Sell', city: 'Coimbatore', limit: 12 },
      overrides,
    );

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'mysql',
      database: 'listing_test',
      entities: [__dirname + '/../../database/entities/*.entity.ts'],
    });
    await (dataSource as any).buildMetadatas();
  });
  beforeEach(() => {
    properties = Object.assign(Object.create(PropertiesService.prototype), {
      propertyRepository: dataSource.getRepository(Property),
    });
    service = new PropertyListingsService(properties, dataSource, {
      resolveImageUrls: (images: unknown) => images,
      generateReadUrl: (key: string) => `/files/${key}`,
    } as StorageService);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(['New', 'Resale'])('validates the %s property condition through the query whitelist', async propertyCondition => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    await expect(pipe.transform({ propertyCondition }, { type: 'query', metatype: PropertySearchQueryDto }))
      .resolves.toMatchObject({ propertyCondition });
    await expect(pipe.transform({ propertyCondition: 'anything' }, { type: 'query', metatype: PropertySearchQueryDto })).rejects.toThrow();
  });

  it('filters individual listings by CRM condition, with legacy transaction-type fallback', () => {
    const [newSql, newParams] = properties.databaseSearchQuery(query({ propertyCondition: 'New' })).getQueryAndParameters();
    expect(newSql).toContain('`p`.`property_condition`');
    expect(newSql).toContain('`p`.`transaction_type`');
    expect(newParams).toEqual(expect.arrayContaining(['new', 'under construction', 'new launch']));
    const [, resaleParams] = properties.databaseSearchQuery(query({ propertyCondition: 'Resale' })).getQueryAndParameters();
    expect(resaleParams).toContain('resale');
    expect(resaleParams).not.toContain('new');
  });

  it('includes developer projects under New but excludes them from Resale', () => {
    expect(service.projectSearchQuery(query({ propertyCondition: 'Resale' })).getSql()).toContain('1 = 0');
    expect(service.projectSearchQuery(query({ propertyCondition: 'New' })).getSql()).not.toContain('1 = 0');
  });

  it('does not apply buy conditions to rental inventory', () => {
    const [sql, params] = properties.databaseSearchQuery(query({ listingType: 'Rent', propertyCondition: 'Resale' })).getQueryAndParameters();
    expect(sql).not.toContain('NULLIF(TRIM(`p`.`property_condition`)');
    expect(params).not.toContain('resale');
    expect(service.projectSearchQuery(query({ listingType: 'Rent', propertyCondition: 'Resale' })).getSql()).not.toContain('1 = 0');
  });

  it('shows Available, Sold and Rented properties but excludes Archived from public listing filters', () => {
    const [,params] = properties.databaseSearchQuery(query()).getQueryAndParameters();
    expect(params).toEqual(expect.arrayContaining(['available','sold','rented']));
    expect(params).not.toContain('archived');
    expect(params).not.toContain('unavailable');
  });
  it('admits booked projects and their sold unit configurations in combined listings', () => {
    const [sql,params] = service.projectSearchQuery(query()).getQueryAndParameters();
    expect(params).toEqual(expect.arrayContaining(['published','booked']));
    expect(sql).toContain("OR `project`.`status` = 'booked'");
  });
  it('returns booked projects with unchanged prices and configurations on /projects', async () => {
    const project = {id:1, name:'Booked Project', status:'booked', projectType:'apartment', units: [{id:2,status:'sold',price:'5000000',bedrooms:3,builtupAreaSqft:'1400'}]};
    jest.spyOn(SelectQueryBuilder.prototype,'getManyAndCount').mockResolvedValueOnce([[project as any],1]);
    const api = new ProjectsService(dataSource.getRepository(Project), {generateReadUrl: (key:string)=>key} as any);
    const result = await api.list({} as any);
    expect(result.items[0]).toMatchObject({name:'Booked Project',status:'booked',ranges:{minPrice:5000000,bhk:[3]}});
  });
  it.each(['archived','available'])('keeps the CRM %s section distinct from Sold/Rented archival', async statusFilter => {
    let sql='';
    jest.spyOn(SelectQueryBuilder.prototype,'getManyAndCount').mockImplementationOnce(async function(this:SelectQueryBuilder<Property>) {sql=this.getSql();return [[],0];});
    const admin=Object.assign(Object.create(AdminPropertiesService.prototype),{dataSource});
    await admin.listAll({statusFilter});
    if(statusFilter==='archived') expect(sql).toContain("IN ('archived','unavailable')");
    else expect(sql).toContain("IN ('available','sold','rented')");
  });

  it.each(['available', 'sold', 'rented', 'unavailable'])('returns the complete public detail for %s properties with past availability dates', async status => {
    const property = {id: 2599, title: 'Luxury House', slug: 'luxury-house-ip2599', propertyType: 'individual_portion', status, approvalStatus: 'Approved', availableUntil: '2000-01-01', propertyImages: [], propertyDetails: null, propertyLocations: [], propertyAmenities: [], propertyFurnishings: [], propertyUnits: [], propertyFiles: [], faqs: [], seo: null};
    const lookup = jest.spyOn(dataSource.getRepository(Property), 'findOne').mockResolvedValue(property as any);
    (properties as any).storageService = {resolveImageUrls: (images: unknown) => images, generateReadUrl: (key: string) => key};
    const result = await properties.detailsBySlug(property.slug);
    expect(result).toMatchObject({id: 2599, title: 'Luxury House', status, canonicalSlug: property.slug, shouldRedirect: false, propertyImages: []});
    const where = lookup.mock.calls[0][0].where as any[];
    for (const condition of where) {
      expect(condition.status).toBeUndefined();
      expect(condition.availableUntil).toBeUndefined();
      expect(condition.approvalStatus).toBe('Approved');
    }
  });

  it('retains and validates the opt-in flag through the API whitelist', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: true },
    });
    expect(
      await pipe.transform(
        { includeProjects: 'true' },
        { type: 'query', metatype: PropertySearchQueryDto },
      ),
    ).toMatchObject({ includeProjects: true });
    expect(
      await pipe.transform(
        { includeProjects: 'false' },
        { type: 'query', metatype: PropertySearchQueryDto },
      ),
    ).toMatchObject({ includeProjects: false });
    await expect(
      pipe.transform(
        { includeProjects: 'invalid' },
        { type: 'query', metatype: PropertySearchQueryDto },
      ),
    ).rejects.toThrow();
  });

  it('filters a single available sale unit by type, locality, price, size, bedrooms, facing and furnishing', () => {
    const [sql, params] = service
      .projectSearchQuery(
        query({
          propertyType: 'villa',
          location: 'RS-Puram',
          propertyName: 'Palm',
          minPrice: '5000000',
          maxPrice: '15000000',
          minArea: '1000',
          maxArea: '2500',
          bedrooms: '3+',
          facing: ['north-east'],
          furnishing: ['semi'],
        }),
      )
      .getQueryAndParameters();
    expect(sql).toContain('INNER JOIN `project_units` `u`');
    expect(sql).toContain('`u`.`bedrooms` >= ?');
    expect(sql).toContain('`u`.`price` >= ?');
    expect(sql).toContain('`u`.`price` <= ?');
    expect(sql).toContain('`u`.`furnished_status` IN (?)');
    expect(params).toEqual(
      expect.arrayContaining([
        'available',
        'sale',
        'published',
        'apartment',
        'villa',
        'plot',
        'coimbatore',
        'rs puram',
        '%Palm%',
        5000000,
        15000000,
        1000,
        2500,
        3,
        'north_east',
        'semi_furnished',
      ]),
    );
  });

  it('excludes projects from older property-age buckets without inventing an age', () => {
    expect(
      service.projectSearchQuery(query({ propertyAge: '5-10' })).getSql(),
    ).toContain('1 = 0');
    expect(
      service
        .projectSearchQuery(query({ propertyAge: 'new' }))
        .getQueryAndParameters()[1],
    ).toEqual(
      expect.arrayContaining([
        'new_launch',
        'under_construction',
        'ready_to_move',
      ]),
    );
  });

  it.each([
    { propertyType: 'commercial' },
    { propertyType: 'industrial' },
    { propertyType: 'farmland' },
    { propertyType: 'individual_portion' },
  ])('preserves property-only results for %j', async (filters) => {
    const result = { items: [], total: 0, page: 1, limit: 12 };
    jest.spyOn(properties, 'search').mockResolvedValue(result);
    expect(await service.search(query(filters))).toBe(result);
  });

  it('matches rental units and uses monthly rent for filtering, sorting and project card prices', async () => {
    const [sql, params] = service
      .projectSearchQuery(query({ listingType: 'Rent', minPrice: '25000' }))
      .getQueryAndParameters();
    expect(sql).toContain('`u`.`monthly_rent` >= ?');
    expect(params).toEqual(expect.arrayContaining(['rent', 25000]));
    const databaseQuery = jest
      .spyOn(dataSource, 'query')
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ kind: 'project', id: 7 }]);
    jest
      .spyOn(SelectQueryBuilder.prototype, 'getMany')
      .mockResolvedValueOnce([
        {
          id: 7,
          projectType: 'apartment',
          units: Promise.resolve([
            {
              status: 'available',
              listingMode: 'rent',
              price: '9000000',
              monthlyRent: '30000',
            },
          ]),
        },
      ]);
    const result = await service.search(
      query({ listingType: 'Rent', sort: PropertySortOption.PriceHighToLow }),
    );
    expect(result.items[0]?.project).toMatchObject({
      listingType: 'Rent',
      ranges: { minPrice: 30000, maxPrice: 30000 },
    });
    expect(databaseQuery.mock.calls[1][0]).toContain('MAX(`u`.`monthly_rent`)');
  });

  it('paginates the combined database result, preserves its order, and keeps colliding IDs distinct', async () => {
    const databaseQuery = jest
      .spyOn(dataSource, 'query')
      .mockResolvedValueOnce([{ total: '250' }])
      .mockResolvedValueOnce([
        { kind: 'project', id: 7 },
        { kind: 'property', id: 7 },
      ]);
    jest
      .spyOn(SelectQueryBuilder.prototype, 'getMany')
      .mockResolvedValueOnce([
        {
          id: 7,
          title: 'Individual apartment',
          slug: 'individual-apartment',
          propertyImages: Promise.resolve([]),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 7,
          name: 'Apartment project',
          projectType: 'apartment',
          canonicalSlug: 'apartment-project',
          units: Promise.resolve([
            {
              status: 'available',
              listingMode: 'sale',
              price: '9000000',
              builtupAreaSqft: '1200',
            },
            { status: 'sold', listingMode: 'sale', price: '1000000' },
          ]),
        } as unknown as Project,
      ]);
    const result = await service.search(
      query({ page: 11, sort: PropertySortOption.PriceLowToHigh }),
    );
    expect(result.total).toBe(250);
    expect(result.page).toBe(11);
    expect(result.items.map((item) => [item?.listingKind, item?.id])).toEqual([
      ['project', 7],
      ['property', 7],
    ]);
    expect((result.items[0]?.project as any).ranges.minPrice).toBe(9000000);
    const [sql, params] = databaseQuery.mock.calls[1];
    expect(sql).toContain('UNION ALL');
    expect(sql).toContain('sort_value IS NULL ASC, sort_value ASC');
    expect(sql).toContain(
      'created_at DESC, kind ASC, id DESC LIMIT ? OFFSET ?',
    );
    expect(params?.slice(-2)).toEqual([12, 120]);
    expect(databaseQuery.mock.calls[0][0]).toContain('COUNT(*)');
  });
});
