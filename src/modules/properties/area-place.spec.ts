import { areaMatches, areaPlace } from './area-place';

describe('area matching for listing searches', () => {
  it('drops the city and stray commas from the searched area', () => {
    expect(areaPlace('medavakkam', 'chennai')).toBe('medavakkam');
    expect(areaPlace('Medavakkam, Chennai', 'chennai')).toBe('medavakkam');
    expect(areaPlace('Electronic City,', 'bangalore')).toBe('electronic city');
    expect(areaPlace('sai-baba-colony', 'coimbatore')).toBe('sai baba colony');
    expect(areaPlace('Egattur, OMR', 'chennai')).toBe('egattur, omr');
  });

  it('matches stored areas with or without their city', () => {
    const sql = areaMatches('project.sublocation', 'project.city', 'area');
    expect(sql).toContain("TRIM(TRAILING ',' FROM TRIM(project.sublocation))");
    expect(sql).toContain(
      "IN (:area, CONCAT(:area, ', ', LOWER(TRIM(project.city))))",
    );
  });
});
