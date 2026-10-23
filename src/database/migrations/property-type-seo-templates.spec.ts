import { QueryRunner } from 'typeorm';
import { PropertyTypeSeoTemplates1785100000000 } from './1785100000000-PropertyTypeSeoTemplates';

describe('property type SEO defaults', () => {
  it('updates land defaults without BHK and preserves custom apartment copy', async () => {
    const updates: any[][] = [];
    const query = jest.fn(async (sql: string, args: any[] = []) => {
      if (sql.startsWith('SELECT')) {
        const key = args[0];
        return [
          {
            id: key,
            meta_title: key.includes(':apartment:') ? 'Staff title' : '',
            meta_description: '',
            h1: '',
            settings: { image_alt_template: 'Staff alt' },
            section_seo: {
              floor_plan: {
                meta_title:
                  '{Property_Name} Floor Plan - {BHK} {Property_Type} ({SqFt} Sq.Ft) in {Sub_Locality}',
                h1: 'Staff layout heading',
              },
            },
          },
        ];
      }
      updates.push([sql, args]);
      return [];
    });
    await new PropertyTypeSeoTemplates1785100000000().up({
      query,
    } as unknown as QueryRunner);
    const main = updates.filter(([sql]) => sql.includes('meta_title=?'));
    expect(main).toHaveLength(16);
    const land = main.find(
      ([, args]) => args.at(-1) === 'template:property:farmland:rent',
    )![1];
    expect(land[0]).not.toContain('BHK');
    expect(land[0]).toContain('Rent');
    expect(land[1]).toContain('water');
    expect(JSON.parse(land[3]).image_alt_template).toBe('Staff alt');
    expect(
      main.find(
        ([, args]) => args.at(-1) === 'template:property:apartment:buy',
      )![1][0],
    ).toBe('Staff title');
    const layout = updates.find(
      ([sql, args]) =>
        sql.includes('section_seo=?') &&
        args[1] === 'template:property:farmland:rent',
    )![1];
    expect(JSON.parse(layout[0]).floor_plan).toEqual({
      meta_title: '{Property_Name} Land Layout | {Sub_Locality}',
      h1: 'Staff layout heading',
    });
    expect(updates.every(([sql]) => sql.startsWith('UPDATE seo_configs'))).toBe(
      true,
    );
  });
});
