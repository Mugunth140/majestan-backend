import { BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { Property } from '../../../database/entities/property.entity';
import { AdminPropertyQueryDto } from './dto/admin-property-query.dto';

export function applyCrmPropertyFilters(qb: SelectQueryBuilder<Property>, query: AdminPropertyQueryDto) {
  if (query.minSqft !== undefined && query.maxSqft !== undefined && query.minSqft > query.maxSqft) throw new BadRequestException('Minimum Sq.ft cannot exceed maximum');
  if (query.minBudget !== undefined && query.maxBudget !== undefined && query.minBudget > query.maxBudget) throw new BadRequestException('Minimum budget cannot exceed maximum');
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
