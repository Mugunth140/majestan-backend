jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), {
  virtual: true,
});
jest.mock('meilisearch', () => ({ Meilisearch: jest.fn() }), { virtual: true });
import { getMetadataArgsStorage } from 'typeorm';
import { AdminPropertiesService } from './admin-properties.service';
import { Property } from '../../../database/entities/property.entity';
import { PropertyDetails } from '../../../database/entities/property-details.entity';
import { PropertyCurationTwo1786300000000 } from '../../../database/migrations/1786300000000-PropertyCurationTwo';
function setup(existing: Record<string, unknown> = {}) {
  const saved: any[] = [];
  const manager = {
    save: jest.fn(async (row: any) => {
      row.id ??= 7;
      saved.push(row);
      return row;
    }),
    delete: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(async (entity: unknown) =>
      entity === PropertyDetails
        ? {
            curationDetails: existing,
            floorPlanImages: [],
            bathrooms: 7,
            areaSqft: '1200',
            builtUpArea: '1000',
            propertyFacing: 'East',
            carParking: 5,
          }
        : { id: 7, slug: 'synthetic-property' },
    ),
  };
  const runner = {
    manager,
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };
  const service = new AdminPropertiesService(
    { createQueryRunner: () => runner } as any,
    {} as any,
    { indexProperty: jest.fn(async () => {}) } as any,
  );
  jest.spyOn(service as any, 'resolveLocation').mockResolvedValue({
    city: {
      cityName: 'Synthetic',
      stateName: 'Synthetic',
      countryName: 'India',
    },
    sublocation: { id: 1, localityName: 'Synthetic' },
  });
  jest
    .spyOn(service as any, 'triggerFrontendRevalidation')
    .mockImplementation(() => {});
  jest
    .spyOn(service as any, 'triggerListingRevalidation')
    .mockImplementation(() => {});
  jest.spyOn(service, 'details').mockResolvedValue({ id: 7 } as any);
  return { service, saved, manager };
}
it('writes new contact details privately and stores the bathroom sum for legacy consumers', async () => {
  const { service, saved } = setup();
  const curationDetails = {
    individualBathrooms: 2,
    attachedBathrooms: 1,
    hasCanteen: false,
  };
  const contactDetails = {
    ownerAlternatives: [{ role: 'Manager', name: 'Synthetic' }],
    agentPhone: 'synthetic-private',
  };
  await service.create('apartment', {
    title: 'Synthetic',
    price: 1000000,
    details: { bathrooms: 9, curationDetails },
    contactDetails,
  } as any);
  expect(saved.find((row) => row instanceof PropertyDetails)).toMatchObject({
    bathrooms: 3,
    curationDetails,
  });
  expect(saved.find((row) => row instanceof Property)).toMatchObject({
    contactDetails,
  });
  const column = getMetadataArgsStorage().columns.find(
    (c) => c.target === Property && c.propertyName === 'contactDetails',
  );
  expect(column?.options.select).toBe(false);
});
it('merges partial specification edits and derives total lifts', async () => {
  const { service, saved } = setup({
    hasCanteen: true,
    individualBathrooms: 2,
    attachedBathrooms: 1,
  });
  await service.update('commercial', 7, {
    details: { curationDetails: { passengerLifts: 2, serviceLifts: 1 } },
  });
  expect(saved.find((row) => row instanceof PropertyDetails)).toMatchObject({
    noOfLifts: 3,
    curationDetails: {
      hasCanteen: true,
      individualBathrooms: 2,
      attachedBathrooms: 1,
      passengerLifts: 2,
      serviceLifts: 1,
    },
  });
});
it('does not drop legacy bathroom totals when no split is supplied', async () => {
  const { service, saved } = setup();
  await service.update('apartment', 7, {
    details: { bathrooms: 4, curationDetails: { portions: [] } },
  });
  expect(saved.find((row) => row instanceof PropertyDetails).bathrooms).toBe(4);
});
it('adds only missing nullable JSON columns, with an idempotent rerun', async () => {
  const columns = new Set<string>();
  const query = jest.fn();
  const q = {
    hasColumn: jest.fn(async (table: string, column: string) => {
      const key = table + column;
      const existed = columns.has(key);
      columns.add(key);
      return existed;
    }),
    query,
  };
  const migration = new PropertyCurationTwo1786300000000();
  await migration.up(q as any);
  await migration.up(q as any);
  expect(query.mock.calls.map(([sql]) => sql)).toEqual([
    'ALTER TABLE properties ADD COLUMN contact_details JSON NULL',
    'ALTER TABLE property_details ADD COLUMN curation_details JSON NULL',
  ]);
});

it('keeps omitted legacy counts and measurements in a metadata-only patch', async () => {
  const { service, saved } = setup();
  await service.update('industrial', 7, {
    details: { curationDetails: { hasCanteen: true } },
  });
  expect(saved.find((row) => row instanceof PropertyDetails)).toMatchObject({
    bathrooms: 7,
    areaSqft: '1200',
    builtUpArea: '1000',
    propertyFacing: 'East',
    carParking: 5,
  });
});
it('uses the merged bathroom split on a partial split edit', async () => {
  const { service, saved } = setup({
    individualBathrooms: 2,
    attachedBathrooms: 1,
  });
  await service.update('apartment', 7, {
    details: { curationDetails: { attachedBathrooms: 2 } },
  });
  expect(saved.find((row) => row instanceof PropertyDetails)).toMatchObject({
    bathrooms: 4,
    curationDetails: { individualBathrooms: 2, attachedBathrooms: 2 },
  });
});
it('clears stale split classification when an older client changes only the total', async () => {
  const { service, saved } = setup({
    individualBathrooms: 2,
    attachedBathrooms: 1,
  });
  await service.update('apartment', 7, { details: { bathrooms: 5 } });
  const details = saved.find((row) => row instanceof PropertyDetails);
  expect(details.bathrooms).toBe(5);
  expect(details.curationDetails).not.toHaveProperty('individualBathrooms');
});
it('derives legacy parking totals only after an explicit structured edit', async () => {
  const { service, saved } = setup();
  await service.update('commercial', 7, {
    details: {
      curationDetails: {
        parkingSpaces: [
          { vehicle: 'Car', type: 'Covered', count: 1 },
          { vehicle: 'Bike', type: 'Open', count: 2 },
        ],
      },
    },
  });
  expect(saved.find((row) => row instanceof PropertyDetails)).toMatchObject({
    carParking: 1,
    bikeParking: 2,
    parking: 3,
  });
});
it('allows explicit no-parking and ignores nullable legacy parking metadata', async () => {
  const { service, saved } = setup();
  await service.update('commercial', 7, {
    details: { curationDetails: { parkingSpaces: [] } },
  });
  expect(saved.find((row) => row instanceof PropertyDetails)).toMatchObject({
    carParking: 0,
    bikeParking: 0,
    parking: 0,
  });
  const second = setup();
  await expect(
    second.service.update('commercial', 7, {
      details: { curationDetails: { parkingSpaces: null } },
    } as any),
  ).resolves.toBeDefined();
  expect(
    second.saved.find((row) => row instanceof PropertyDetails).carParking,
  ).toBe(5);
});
it('rejects a portion count that contradicts its BHK configurations', async () => {
  const { service } = setup();
  await expect(
    service.update('commercial', 7, {
      details: {
        numberOfPortions: 4,
        curationDetails: {
          portions: [
            { bhk: '3 BHK', count: 2 },
            { bhk: '2 BHK', count: 1 },
          ],
        },
      },
    }),
  ).rejects.toThrow('must equal');
});

it('preserves other private contacts during an alternative-agent phone patch', async () => {
  const { service, manager } = setup();
  const findOne = manager.findOne.getMockImplementation()!;
  manager.findOne.mockImplementation(async (entity: unknown) =>
    entity === Property
      ? {
          id: 7,
          slug: 'synthetic-property',
          contactDetails: {
            ownerAlternatives: [{ name: 'Synthetic owner alternative' }],
            agentEmail: 'synthetic@example.test',
            agentAlternative: {
              name: 'Synthetic agent alternative',
              phone: 'old',
            },
          },
        }
      : findOne(entity),
  );
  await service.update('apartment', 7, {
    contactDetails: { agentAlternative: { phone: 'new' } },
  });
  expect(manager.update).toHaveBeenCalledWith(
    Property,
    { id: 7 },
    expect.objectContaining({
      contactDetails: {
        ownerAlternatives: [{ name: 'Synthetic owner alternative' }],
        agentEmail: 'synthetic@example.test',
        agentAlternative: { name: 'Synthetic agent alternative', phone: 'new' },
      },
    }),
  );
});

it.each([
  ['100 HP', 100],
  ['High Density', null],
  ['', null],
])(
  'maps the chosen power capacity %s for legacy numeric consumers',
  async (powerSupplyCapacity, expected) => {
    const { service, saved } = setup();
    await service.update('industrial', 7, {
      details: { powerSupplyHp: 50, curationDetails: { powerSupplyCapacity } },
    });
    expect(
      saved.find((row) => row instanceof PropertyDetails).powerSupplyHp,
    ).toBe(expected);
  },
);
