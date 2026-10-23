import { MigrationInterface, QueryRunner } from 'typeorm';

// Editorial overrides on individual listings and customized template values are retained.
export class PropertyTypeSeoTemplates1785100000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const profiles: Record<string, [boolean, string, string, string]> = {
      apartment: [
        true,
        'BHK, area, floor plans, photos and apartment amenities',
        'Floor Plan',
        'Amenities',
      ],
      villa: [
        true,
        'villa layout, built-up area, plot details and photos',
        'Villa Floor Plan',
        'Villa Features',
      ],
      individual_portion: [
        true,
        'house layout, built-up area, land details and photos',
        'House Floor Plan',
        'House Features',
      ],
      plot: [
        false,
        'land area, plot layout, road access, approval details and site photos',
        'Plot Layout',
        'Access & Infrastructure',
      ],
      farmland: [
        false,
        'land area, location, access, recorded water details and site photos',
        'Land Layout',
        'Land Features',
      ],
      commercial: [
        false,
        'commercial area, space layout, frontage, access and photos',
        'Space Layout',
        'Business Facilities',
      ],
      industrial: [
        false,
        'industrial area, building layout, recorded power details, access and photos',
        'Site & Building Layout',
        'Industrial Facilities',
      ],
      coworking: [
        false,
        'workspace layout, available facilities, location and photos',
        'Workspace Layout',
        'Workspace Facilities',
      ],
    };
    for (const [
      type,
      [residential, details, layout, facilities],
    ] of Object.entries(profiles)) {
      for (const intent of ['buy', 'rent']) {
        const transaction = intent === 'rent' ? 'Rent' : 'Sale';
        const rows = await q.query(
          "SELECT * FROM seo_configs WHERE scope='template' AND config_key=?",
          [`template:property:${type}:${intent}`],
        );
        for (const row of rows) {
          const oldTitle = `{BHK} {Property_Type} for ${transaction} in {Sub_Locality}, {City} ({SqFt} Sq.Ft) - {Property_Name} | Majestan Realty`;
          const oldDescription = `Explore {Property_Type} for ${transaction} in {Sub_Locality}, {City}. Compare prices, photographs and property details with Majestan Realty.`;
          const oldHeading = `{BHK} {Property_Type} for ${transaction} in {Sub_Locality}, {City}`;
          const prefix = residential ? '{BHK} ' : '';
          const title = `${prefix}{Property_Type} for ${transaction} in {Sub_Locality} | {Property_Name}`;
          const description = `Explore {Property_Type} for ${transaction} in {Sub_Locality}, {City}. View ${details} for {Property_Name}.`;
          const parse = (value: any) =>
            typeof value === 'string' ? JSON.parse(value) : value || {};
          const settings = parse(row.settings);
          const originalAlt =
            '{Property_Name} - {BHK} {Property_Type} in {Sub_Locality}, {City} - View {Index}';
          if (
            !settings.image_alt_template ||
            settings.image_alt_template === originalAlt
          )
            settings.image_alt_template = `{Property_Name} - ${prefix}{Property_Type} for ${transaction} in {Sub_Locality} - View {Index}`;
          // Keep section overrides intact; the existing section resolver supplies defaults.
          await q.query(
            'UPDATE seo_configs SET meta_title=?,meta_description=?,h1=?,settings=?,revision=revision+1 WHERE id=?',
            [
              !row.meta_title || row.meta_title === oldTitle
                ? title
                : row.meta_title,
              !row.meta_description || row.meta_description === oldDescription
                ? description
                : row.meta_description,
              !row.h1 || row.h1 === oldHeading
                ? `${prefix}{Property_Type} for ${transaction} in {Sub_Locality}, {City}`
                : row.h1,
              JSON.stringify({
                ...settings,
                property_type: type,
                scope: 'property',
                intent,
              }),
              row.id,
            ],
          );
          // Only replace system-generated section wording, never staff-written copy.
          const sections = parse(row.section_seo);
          for (const key of ['floor_plan', 'floor-plan']) {
            const section = sections[key];
            if (!section) continue;
            const defaults: Record<string, string[]> = {
              meta_title: [
                '{Property_Name} Floor Plan - {BHK} {Property_Type} ({SqFt} Sq.Ft) in {Sub_Locality}',
                '{Property_Name} Floor Plans | Majestan Realty',
              ],
              h1: [
                '{Property_Name} 2D Floor Plan & Dimensions',
                'Floor Plans for {Property_Name}',
              ],
              meta_description: [
                'View {Property_Name} floor plans, unit configurations and area details in {Sub_Locality}, {City}.',
                'Explore the floor plans and layouts for {Property_Name} in {City}.',
              ],
            };
            for (const field of ['meta_title', 'h1', 'meta_description']) {
              if (defaults[field].includes(section[field]))
                section[field] =
                  field === 'meta_description'
                    ? `View the ${layout.toLowerCase()} and recorded area details for {Property_Name} in {Sub_Locality}, {City}.`
                    : `{Property_Name} ${layout} | {Sub_Locality}`;
            }
          }
          if (
            sections.photos?.meta_title ===
            '{Property_Name} Photos - {BHK} {Property_Type} for {Transaction_Type} in {Sub_Locality}'
          )
            sections.photos.meta_title = `{Property_Name} Photos - ${prefix}{Property_Type} for ${transaction} in {Sub_Locality}`;
          // Save the differentiated terminology only for untouched default sections.
          if (
            sections.amenities?.meta_title ===
            '{Property_Name} Amenities | {Sub_Locality}'
          )
            sections.amenities.meta_title = `{Property_Name} ${facilities} | {Sub_Locality}`;
          await q.query('UPDATE seo_configs SET section_seo=? WHERE id=?', [
            JSON.stringify(sections),
            row.id,
          ]);
        }
      }
    }
  }
  async down(): Promise<void> {
    // Content migration: retain editorial values rather than overwrite subsequent edits.
  }
}
