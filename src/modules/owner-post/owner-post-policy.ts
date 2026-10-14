import { BadRequestException } from '@nestjs/common';
import type {
  OwnerDetailsDto,
  SubmitOwnerPropertyDto,
} from './dto/submit-owner-property.dto';

export const OWNER_CATEGORIES = [
  'apartment',
  'villa',
  'individual_portion',
  'plot',
  'farmland',
  'commercial',
  'industrial',
  'coworking',
];
const common = ['areaSqft', 'facing'];
const building = [
  'carpetArea',
  'buildUpArea',
  'floorNumber',
  'totalFloors',
  'furnishingStatus',
  'furnished',
  'propertyAge',
  'parking',
  'parkingType',
  'waterSupply',
  'powerBackup',
];
const residential = [
  'bedrooms',
  'bathrooms',
  'balconies',
  'poojaRoom',
  'studyRoom',
  'unitType',
];
const land = [
  'plotArea',
  'areaUnit',
  'plotSizeCents',
  'plotLength',
  'plotWidth',
  'roadWidth',
  'boundaryWall',
  'waterSources',
];
const categoryKeys: Record<string, string[]> = {
  apartment: [...building, ...residential, 'superBuiltUpArea'],
  villa: [...building, ...residential, 'plotArea'],
  individual_portion: [...building, ...residential, 'plotArea'],
  plot: land,
  farmland: [
    ...land,
    'landType',
    'soilType',
    'existingPlantation',
    'fencing',
    'boreWell',
  ],
  commercial: [
    ...building,
    'propertyUse',
    'noOfLifts',
    'sharedWashrooms',
    'individualWashrooms',
    'hasPantry',
    'fireSafety',
    'ceilingHeightFt',
    'hasRestroom',
  ],
  industrial: [
    ...building,
    'propertyUse',
    'fireSafety',
    'ceilingHeightFt',
    'coveredArea',
    'openArea',
    'powerSupplyHp',
    'truckParking',
    'heavyVehicleAccess',
    'craneAvailable',
    'hasRestroom',
  ],
  coworking: [
    ...building,
    'hasPantry',
    'availableWorkstations',
    'minSeats',
    'privateCabins',
    'meetingRooms',
    'rentPerSeat',
    'highSpeedWifi',
    'airConditioning',
    'hasRestroom',
  ],
};
const countKeys = new Set([
  'bedrooms',
  'bathrooms',
  'balconies',
  'parking',
  'totalFloors',
  'noOfLifts',
  'sharedWashrooms',
  'individualWashrooms',
  'truckParking',
  'availableWorkstations',
  'minSeats',
  'privateCabins',
  'meetingRooms',
]);
export function assertOwnerMediaKey(key: string, userId: number) {
  if (
    !new RegExp(
      `^(uploads|local)/temp/[0-9]+-owner-${userId}-[a-f0-9-]{36}-[A-Za-z0-9._-]+$`,
    ).test(key)
  )
    throw new BadRequestException(
      'Use files uploaded from your own account. Please remove and upload this file again.',
    );
}
export function ownerPayload(category: string, dto: SubmitOwnerPropertyDto) {
  if (!OWNER_CATEGORIES.includes(category))
    throw new BadRequestException('Choose a supported property category.');
  if (category === 'farmland' && dto.listingType === 'Rent')
    throw new BadRequestException(
      'Farmland is available for sale listings only.',
    );
  if (!dto.title?.trim() || !dto.description?.trim())
    throw new BadRequestException('Enter a listing title and description.');
  if (
    !Number.isFinite(Number(dto.price)) ||
    Number(dto.price) <= 0 ||
    Number(dto.price) > 9999999999.99
  )
    throw new BadRequestException('Enter a positive price in rupees.');
  if (!dto.location?.address?.trim())
    throw new BadRequestException('Enter the property address.');
  if (!dto.cityId || !dto.sublocationId)
    throw new BadRequestException('Choose a city and locality.');
  if (
    !dto.details ||
    typeof dto.details.areaSqft !== 'number' ||
    !Number.isFinite(dto.details.areaSqft) ||
    dto.details.areaSqft <= 0
  )
    throw new BadRequestException(
      'Enter a valid property area in square feet.',
    );
  const allowed = new Set([
    ...common,
    ...categoryKeys[category],
    ...(dto.listingType === 'Sell' && !['plot', 'farmland'].includes(category)
      ? ['possessionStatus']
      : []),
  ]);
  if (dto.listingType === 'Sell') allowed.delete('rentPerSeat');
  const details = Object.fromEntries(
    Object.entries(dto.details).filter(([key]) => allowed.has(key)),
  ) as OwnerDetailsDto;
  for (const [key, value] of Object.entries(details)) {
    if (
      typeof value === 'number' &&
      (!Number.isFinite(value) ||
        value < 0 ||
        value > 9999999999 ||
        (countKeys.has(key) && (!Number.isInteger(value) || value > 10000)))
    )
      throw new BadRequestException(`Enter a valid value for ${key}.`);
    if (typeof value === 'string' && value.length > 255)
      throw new BadRequestException(`Use 255 characters or fewer for ${key}.`);
  }
  if (['apartment', 'villa', 'individual_portion'].includes(category)) {
    if (
      !details.bedrooms ||
      details.bedrooms < 1 ||
      details.bathrooms === undefined
    )
      throw new BadRequestException('Enter bedrooms and bathrooms.');
    details.unitType = `${details.bedrooms}BHK`;
  }
  if (
    details.carpetArea &&
    details.carpetArea > (details.buildUpArea || details.areaSqft!)
  )
    throw new BadRequestException(
      'Carpet area cannot exceed the built up area.',
    );
  if (category === 'coworking' && !details.availableWorkstations)
    throw new BadRequestException('Enter the available workstations.');
  if (!details.parking) delete details.parkingType;
  details.furnished = details.furnishingStatus
    ? details.furnishingStatus === 'FULLY FURNISHED'
    : undefined;
  const isLand = ['plot', 'farmland'].includes(category);
  if (
    isLand &&
    details.areaUnit &&
    !['Sq Ft', 'Cents', 'Acres', 'Grounds'].includes(details.areaUnit)
  )
    throw new BadRequestException('Choose a supported land area unit.');
  const rent = dto.listingType === 'Rent';
  const money = (value: string | undefined) => {
    if (value === undefined || value === '') return undefined;
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(value))
      throw new BadRequestException(
        'Enter charges in rupees with at most 2 decimal places.',
      );
    return value;
  };
  if (
    rent &&
    dto.availableFrom &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(dto.availableFrom) ||
      !Number.isFinite(Date.parse(dto.availableFrom)) ||
      new Date(dto.availableFrom).toISOString().slice(0, 10) !==
        dto.availableFrom)
  )
    throw new BadRequestException('Choose a valid availability date.');
  return {
    title: dto.title.trim(),
    description: dto.description.trim(),
    price: dto.price,
    listingType: dto.listingType,
    cityId: dto.cityId,
    sublocationId: dto.sublocationId,
    projectName: !isLand ? dto.projectName : undefined,
    negotiable: dto.negotiable ?? false,
    reraNumber: !rent ? dto.reraNumber?.trim() || null : null,
    ownershipType: !rent ? dto.ownershipType : undefined,
    transactionType: !rent && !isLand ? dto.transactionType : undefined,
    expectedSalePrice: !rent ? dto.price : undefined,
    monthlyRent: rent ? dto.price : undefined,
    bookingAmount: !rent ? money(dto.bookingAmount) : undefined,
    securityDeposit: rent ? money(dto.securityDeposit) : undefined,
    maintenanceCharges: !isLand ? money(dto.maintenanceCharges) : undefined,
    lockInPeriod: rent ? dto.lockInPeriod : undefined,
    availableFrom: rent ? dto.availableFrom : undefined,
    details,
    location: {
      address: dto.location.address.trim(),
      pincode: dto.location.pincode || undefined,
    },
    amenities: !isLand ? dto.amenities : [],
    furnishingItems: ['FULLY FURNISHED', 'SEMI FURNISHED'].includes(
      details.furnishingStatus || '',
    )
      ? dto.furnishingItems
      : [],
    files: dto.files || [],
    documents: (dto.floorPlans || []).map((plan) => ({
      ...plan,
      documentType: 'floor_plan',
      title: plan.fileName || 'Floor plan',
      isPublic: true,
    })),
  };
}
