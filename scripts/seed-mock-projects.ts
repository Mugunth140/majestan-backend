import dataSource from '../src/database/data-source';

async function seedProjects() {
  await dataSource.initialize();
  
  try {
    const projects = [
      {
        name: 'Lakeview Residences',
        slug: 'lakeview-residences-chennai',
        canonical_slug: 'lakeview-residences-chennai',
        project_type: 'apartment',
        project_code: 'PRA0001',
        city: 'Chennai',
        sublocation: 'Sholinganallur',
        status: 'published',
        cover_image_url: '/assets/images/home/apartment-buy.png',
        possession_status: 'ready_to_move'
      },
      {
        name: 'Palm Meadows Villas',
        slug: 'palm-meadows-villas-coimbatore',
        canonical_slug: 'palm-meadows-villas-coimbatore',
        project_type: 'villa',
        project_code: 'PRV0002',
        city: 'Coimbatore',
        sublocation: 'Eachanari',
        status: 'published',
        cover_image_url: '/assets/images/home/villa-buy.png',
        possession_status: 'under_construction'
      },
      {
        name: 'Emerald Heights',
        slug: 'emerald-heights-coimbatore',
        canonical_slug: 'emerald-heights-coimbatore',
        project_type: 'apartment',
        project_code: 'PRA0003',
        city: 'Coimbatore',
        sublocation: 'Saravanampatti',
        status: 'published',
        cover_image_url: '/assets/images/home/apartment-rent.png',
        possession_status: 'ready_to_move'
      }
    ];

    for (const p of projects) {
      // Insert project
      const res: any = await dataSource.query(`
        INSERT INTO projects (
          name, slug, canonical_slug, project_type, project_code, 
          city, sublocation, status, cover_image_url, possession_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [p.name, p.slug, p.canonical_slug, p.project_type, p.project_code, p.city, p.sublocation, p.status, p.cover_image_url, p.possession_status]);
      
      const projectId = res.insertId;

      // Insert mock units to generate the ranges shown in your screenshot
      if (p.name === 'Lakeview Residences') {
        await dataSource.query(`
          INSERT INTO project_units (project_id, unit_code, bedrooms, price, carpet_area_sqft, status)
          VALUES (?, 'U1', 2, 7500000, 1200, 'available')
        `, [projectId]);
      } else if (p.name === 'Palm Meadows Villas') {
        await dataSource.query(`
          INSERT INTO project_units (project_id, unit_code, bedrooms, price, carpet_area_sqft, status)
          VALUES (?, 'U1', 3, 15000000, 2000, 'available'),
                 (?, 'U2', 4, 22000000, 3000, 'available')
        `, [projectId, projectId]);
      } else if (p.name === 'Emerald Heights') {
        await dataSource.query(`
          INSERT INTO project_units (project_id, unit_code, bedrooms, price, carpet_area_sqft, status)
          VALUES (?, 'U1', 2, 6000000, 1000, 'available'),
                 (?, 'U2', 3, 9000000, 1400, 'available'),
                 (?, 'U3', 4, 12000000, 1800, 'available')
        `, [projectId, projectId, projectId]);
      }
    }
    
    console.log("Successfully seeded 3 projects!");
  } catch (err) {
    console.error("Error seeding:", err);
  } finally {
    await dataSource.destroy();
  }
}

seedProjects();
