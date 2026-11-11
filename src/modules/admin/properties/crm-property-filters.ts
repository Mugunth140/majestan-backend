import { BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { Property } from '../../../database/entities/property.entity';
import { AdminPropertyQueryDto } from './dto/admin-property-query.dto';

export function applyCrmPropertyFilters(qb: SelectQueryBuilder<Property>, query: AdminPropertyQueryDto) {
  if (query.minSqft !== undefined && query.maxSqft !== undefined && query.minSqft > query.maxSqft) throw new BadRequestException('Minimum Sq.ft cannot exceed maximum');
  if (query.minBudget !== undefined && query.maxBudget !== undefined && query.minBudget > query.maxBudget) throw new BadRequestException('Minimum budget cannot exceed maximum');
  if (query.uploadedFrom && query.uploadedTo && query.uploadedFrom > query.uploadedTo) throw new BadRequestException('Uploaded from date cannot be after uploaded to date');
  if (query.uploadedById !== undefined) qb.andWhere('p.uploadedByCrmUserId = :uploadedById', { uploadedById: query.uploadedById });
  // Local business dates in India, inclusive through the end day. FROM_UNIXTIME
  // keeps this correct even if the database session timezone differs from UTC.
  for (const [date, key, operator, extraDay] of [
    [query.uploadedFrom, 'uploadedFromEpoch', '>=', 0],
    [query.uploadedTo, 'uploadedToEpoch', '<', 86400],
  ] as const) {
    if (!date) continue;
    const instant = new Date(`${date}T00:00:00+05:30`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(instant.getTime()) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date) throw new BadRequestException('Invalid upload date');
    qb.andWhere(`p.createdAt ${operator} FROM_UNIXTIME(:${key})`, { [key]: instant.getTime() / 1000 + extraDay });
  }
  qb.leftJoin('p.propertyDetails', 'filterDetails');
  if (query.sublocationId) qb.andWhere('sl.id = :filterLocation', { filterLocation: query.sublocationId });
  for (const [key, expression, operator] of [
    ['minSqft', 'filterDetails.areaSqft', '>='], ['maxSqft', 'filterDetails.areaSqft', '<='],
    ['minBudget', 'p.price', '>='], ['maxBudget', 'p.price', '<='],
  ] as const) {
    if (query[key] !== undefined) qb.andWhere(`${expression} ${operator} :${key}`, { [key]: query[key] });
  }
  if (query.floor?.trim()) qb.andWhere('LOWER(TRIM(filterDetails.floorNumber)) = LOWER(:filterFloor)', { filterFloor: query.floor.trim() });
  // The form keeps the picked purposes in curation details; older rows in the columns.
  if (query.specialPurpose?.trim()) qb.andWhere('(filterDetails.specialPurpose LIKE :filterPurpose OR filterDetails.propertyUse LIKE :filterPurpose OR JSON_SEARCH(filterDetails.curationDetails, \'one\', :filterPurposeExact, NULL, \'$.specialPurposes\') IS NOT NULL)', { filterPurpose: `%${query.specialPurpose.trim()}%`, filterPurposeExact: query.specialPurpose.trim() });
  if (query.roadName?.trim()) qb.andWhere('p.roadName = :filterRoad', { filterRoad: query.roadName.trim() });
  if (query.furnishingStatus) {
    const status = query.furnishingStatus.toLowerCase().replace(/[\s-]/g, '');
    const canonical = status === 'furnished' ? 'fullyfurnished' : status;
    if (!['fullyfurnished','semifurnished','unfurnished','bareshell'].includes(canonical)) throw new BadRequestException('Invalid furnishing status');
    const normalized = "REPLACE(REPLACE(LOWER(TRIM(filterDetails.furnishingStatus)), ' ', ''), '-', '')";
    const fallback = !['fullyfurnished','unfurnished'].includes(canonical) ? '' : ` OR (NULLIF(TRIM(filterDetails.furnishingStatus), '') IS NULL AND filterDetails.furnished = :filterFurnished)`;
    qb.andWhere(`(${normalized} = :filterFurnishing${fallback})`, { filterFurnishing: canonical, filterFurnished: canonical === 'fullyfurnished' });
  }
  applyMoreFilters(qb, query);
}

/** Counts like "2" match exactly; "5+" means five or more. */
const countFilter = (value: string) => ({ operator: value.endsWith('+') ? '>=' : '=', count: parseInt(value, 10) });

function applyMoreFilters(qb: SelectQueryBuilder<Property>, query: AdminPropertyQueryDto) {
  for (const [key, column] of [['bedrooms', 'filterDetails.bedrooms'], ['bathrooms', 'filterDetails.bathrooms']] as const) {
    const value = query[key];
    if (!value) continue;
    const { operator, count } = countFilter(value);
    qb.andWhere(`${column} ${operator} :${key}Count`, { [`${key}Count`]: count });
  }
  if (query.facing?.trim()) qb.andWhere('LOWER(TRIM(filterDetails.propertyFacing)) = LOWER(:filterFacing)', { filterFacing: query.facing.trim() });
  if (query.possessionStatus?.trim()) qb.andWhere('LOWER(TRIM(filterDetails.possessionStatus)) = LOWER(:filterPossession)', { filterPossession: query.possessionStatus.trim() });
  if (query.occupancy === 'tenant') qb.andWhere("LOWER(TRIM(p.tenantOccupied)) = 'yes'");
  if (query.occupancy === 'vacant') qb.andWhere("LOWER(TRIM(p.tenantOccupied)) = 'no'");
  if (query.occupancy === 'owner') qb.andWhere("JSON_UNQUOTE(JSON_EXTRACT(filterDetails.curationDetails, '$.ownerOccupied')) = 'true'");
  if (query.negotiable) qb.andWhere('p.negotiable = :filterNegotiable', { filterNegotiable: query.negotiable === 'yes' });
  // Older listings record a count per vehicle; newer ones a breakdown in curation details.
  if (query.parking === 'car') qb.andWhere("(filterDetails.carParking > 0 OR JSON_SEARCH(filterDetails.curationDetails, 'one', 'Car', NULL, '$.parkingSpaces[*].vehicle') IS NOT NULL)");
  if (query.parking === 'bike') qb.andWhere("(filterDetails.bikeParking > 0 OR JSON_SEARCH(filterDetails.curationDetails, 'one', 'Bike', NULL, '$.parkingSpaces[*].vehicle') IS NOT NULL)");
}
