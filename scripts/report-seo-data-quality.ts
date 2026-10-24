/** Read-only source-data report. Never guesses or rewrites measurements. */
import source from '../src/database/data-source';
async function main() {
try {
  await source.initialize();
  const rows = await source.query(`SELECT p.id,p.title,p.slug,p.property_type,d.area_sqft,d.built_up_area,d.carpet_area,
    CASE WHEN p.property_type IN ('apartment','villa','individual_portion') AND d.area_sqft<100 THEN 'Verify residential area and source units' ELSE 'Review metadata identity' END AS issue
    FROM properties p LEFT JOIN property_details d ON d.property_id=p.id
    LEFT JOIN seo_configs c ON c.property_id=p.id
    WHERE (p.property_type IN ('apartment','villa','individual_portion') AND d.area_sqft>0 AND d.area_sqft<100)
      OR c.meta_title REGEXP '0[.]?0* Sq[.]?Ft' ORDER BY p.id`);
  console.log(JSON.stringify({ reviewDate: new Date().toISOString(), count: rows.length, records: rows }, null, 2));
} finally { if (source.isInitialized) await source.destroy(); }

}
void main().catch(error => { console.error(error); process.exitCode = 1; });
