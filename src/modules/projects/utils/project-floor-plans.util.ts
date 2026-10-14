import { BadRequestException } from '@nestjs/common';

export type ProjectFloorPlan = { floorName: string; imageKey: string; imageUrl?: string };
type UnitPlans = { floorPlans?: ProjectFloorPlan[] | null; floorPlanImageKey?: string | null; floorPlanImageUrl?: string | null };

export const floorNameIdentity = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export function readUnitFloorPlans(unit: UnitPlans): ProjectFloorPlan[] {
  if (Array.isArray(unit.floorPlans)) return unit.floorPlans;
  const key = unit.floorPlanImageKey || unit.floorPlanImageUrl;
  return key ? [{ floorName: 'Existing plan', imageKey: key, imageUrl: unit.floorPlanImageUrl || key }] : [];
}

export function validateUnitFloorPlans(plans: ProjectFloorPlan[]): ProjectFloorPlan[] {
  const names = new Set<string>();
  return plans.map((plan) => {
    if (typeof plan?.floorName !== 'string' || !plan.floorName.trim() || typeof plan.imageKey !== 'string' || !plan.imageKey.trim())
      throw new BadRequestException('Each floor needs a name and one floor-plan image.');
    const name = floorNameIdentity(plan.floorName);
    if (names.has(name)) throw new BadRequestException('Use each floor name only once within a unit configuration.');
    names.add(name);
    return { floorName: plan.floorName.trim().replace(/\s+/g, ' '), imageKey: plan.imageKey.trim(), imageUrl: plan.imageUrl };
  });
}

export function resolveUnitFloorPlans(unit: UnitPlans, readUrl: (key: string) => string): ProjectFloorPlan[] {
  return readUnitFloorPlans(unit).map((plan) => ({ ...plan, imageUrl: readUrl(plan.imageKey || plan.imageUrl || '') }));
}
