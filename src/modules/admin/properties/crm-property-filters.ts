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
  if (query.specialPurpose?.trim()) qb.andWhere('(filterDetails.specialPurpose LIKE :filterPurpose OR filterDetails.propertyUse LIKE :filterPurpose)', { filterPurpose: `%${query.specialPurpose.trim()}%` });
  if (query.roadName?.trim()) qb.andWhere('p.roadName = :filterRoad', { filterRoad: query.roadName.trim() });
  if (query.furnishingStatus) {
    const status = query.furnishingStatus.toLowerCase().replace(/[\s-]/g, '');
    const canonical = status === 'furnished' ? 'fullyfurnished' : status;
    if (!['fullyfurnished','semifurnished','unfurnished','bareshell'].includes(canonical)) throw new BadRequestException('Invalid furnishing status');
    const normalized = "REPLACE(REPLACE(LOWER(TRIM(filterDetails.furnishingStatus)), ' ', ''), '-', '')";
    const fallback = !['fullyfurnished','unfurnished'].includes(canonical) ? '' : ` OR (NULLIF(TRIM(filterDetails.furnishingStatus), '') IS NULL AND filterDetails.furnished = :filterFurnished)`;
    qb.andWhere(`(${normalized} = :filterFurnishing${fallback})`, { filterFurnishing: canonical, filterFurnished: canonical === 'fullyfurnished' });
  }
}
