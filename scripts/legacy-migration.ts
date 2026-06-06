import { DataSource } from 'typeorm';
import { Property, PropertyType, PropertyStatus } from '../src/database/entities/property.entity';
import { PropertyDetails } from '../src/database/entities/property-details.entity';
import { PropertyImage } from '../src/database/entities/property-image.entity';
import { User, UserRole } from '../src/database/entities/user.entity';

async function runMigration() {
  console.log('Starting Legacy Data Migration...');
  
  // 1. Connect to the NEW database
  const newDb = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3307'),
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '8220',
    database: process.env.DB_NAME || 'majestan',
    entities: [__dirname + '/../src/database/entities/*.entity{.ts,.js}'],
  });

  await newDb.initialize();

  // 2. Connect to the OLD database
  const oldDb = new DataSource({
    type: 'mysql',
    host: process.env.OLD_DB_HOST || 'localhost',
    port: parseInt(process.env.OLD_DB_PORT || '3308'),
    username: process.env.OLD_DB_USER || 'root',
    password: process.env.OLD_DB_PASSWORD || '8220',
    database: process.env.OLD_DB_NAME || 'legacy_majestan',
  });

  await oldDb.initialize();
  console.log('Connected to both databases.');

  // Create a default admin user if none exists
  let adminUser = await newDb.getRepository(User).findOne({ where: { role: UserRole.ADMIN } });
  if (!adminUser) {
    adminUser = new User();
    adminUser.name = 'Migration Admin';
    adminUser.email = 'admin@majestan.com';
    adminUser.phone = '0000000000';
    adminUser.passwordHash = 'temp-hash';
    adminUser.role = UserRole.ADMIN;
    adminUser.isVerified = true;
    adminUser = await newDb.getRepository(User).save(adminUser);
    console.log(`Created default Admin User with ID: ${adminUser.id}`);
  }

  // 3. Migrate Properties
  const tablesToMigrate = [
    { table: 'apartment', type: PropertyType.APARTMENT, codePrefix: 'APT' },
    { table: 'villas', type: PropertyType.VILLA, codePrefix: 'VIL' },
    { table: 'plots', type: PropertyType.PLOT, codePrefix: 'PLT' },
    { table: 'commercial_space', type: PropertyType.COMMERCIAL, codePrefix: 'COM' },
    { table: 'coworkers', type: PropertyType.COWORKING, codePrefix: 'COW' },
    { table: 'farmlands', type: PropertyType.FARMLAND, codePrefix: 'FRM' },
    { table: 'industrial_spaces', type: PropertyType.INDUSTRIAL, codePrefix: 'IND' },
  ];

  for (const mapping of tablesToMigrate) {
    console.log(`Migrating ${mapping.table}...`);
    try {
      const records = await oldDb.query(`SELECT * FROM ${mapping.table}`);
      let count = 0;
      
      for (const record of records) {
        try {
          // Check if already migrated
          const code = `LEGACY-${mapping.codePrefix}-${record.id}`;
          let property = await newDb.getRepository(Property).findOne({ where: { propertyCode: code } });
          
          if (!property) {
            property = new Property();
            property.propertyCode = code;
            
            const nameField = record.property_name || record.name || record.title || `${mapping.type}-${record.id}`;
            property.title = nameField;
            property.slug = record.slug_url || (nameField.toLowerCase().replace(/[^a-z0-9]+/g, '-') + `-${record.id}`);
            property.description = record.description || '';
            
            let safePrice = '0';
            if (record.price || record.expectedsaleprice || record.monthly_rent) {
              const p = record.price || record.expectedsaleprice || record.monthly_rent;
              const parsed = parseFloat(String(p).replace(/[^0-9.]/g, ''));
              if (!isNaN(parsed)) {
                safePrice = parsed > 9999999999.99 ? '9999999999.99' : parsed.toString();
              }
            }
            property.price = safePrice;
            
            property.propertyType = mapping.type;
            property.status = (record.posttype === 'Rent' || String(record.status).toLowerCase().includes('rent')) ? PropertyStatus.RENTED : PropertyStatus.AVAILABLE;
            
            property.city = record.city || 'Coimbatore';
            property.state = record.state || 'Tamil Nadu';
            property.country = 'India';
            property.ownerId = adminUser.id;
            
            property = await newDb.getRepository(Property).save(property);
          }

          // Migrate Details
          let details = await newDb.getRepository(PropertyDetails).findOne({ where: { propertyId: property.id } });
          if (!details) {
            details = new PropertyDetails();
            details.propertyId = property.id;
            details.bedrooms = parseInt(record.bedrooms || '0') || 0;
            details.bathrooms = parseInt(record.bathrooms || '0') || 0;
            
            let safeArea = '0';
            if (record.sq_ft || record.build_up_area || record.cents) {
              const a = record.sq_ft || record.build_up_area || record.cents;
              const parsed = parseFloat(String(a).replace(/[^0-9.]/g, ''));
              if (!isNaN(parsed)) {
                safeArea = parsed.toString();
              }
            }
            details.areaSqft = safeArea;
            
            details.parking = parseInt(record.car_parking || '0') || 0;
            details.furnished = String(record.furnishing).toLowerCase().includes('furnish') || false;
            
            await newDb.getRepository(PropertyDetails).save(details);
          }

          // Migrate Images
          if (record.photo1) {
            const existing1 = await newDb.getRepository(PropertyImage).findOne({ where: { propertyId: property.id, imageUrl: record.photo1 } });
            if (!existing1) {
              const img = new PropertyImage();
              img.propertyId = property.id;
              img.imageUrl = record.photo1;
              img.imageKey = `legacy-key-${Date.now()}-1`;
              img.isPrimary = true;
              await newDb.getRepository(PropertyImage).save(img);
            }
          }
          
          if (record.photo2) {
            const existing2 = await newDb.getRepository(PropertyImage).findOne({ where: { propertyId: property.id, imageUrl: record.photo2 } });
            if (!existing2) {
              const img = new PropertyImage();
              img.propertyId = property.id;
              img.imageUrl = record.photo2;
              img.imageKey = `legacy-key-${Date.now()}-2`;
              img.isPrimary = false;
              await newDb.getRepository(PropertyImage).save(img);
            }
          }
          
          // Migrate Location (Basic mapping to location string)
          if (record.sublocation || record.address) {
             // In the new schema, we might need a `Location` entity first, 
             // but `city` and `address` mapped via API client covers it mostly.
             // We can skip inserting to property_locations if it requires complex linked entities, 
             // or we just rely on `city` and `address` which we mapped in the API.
          }

          count++;
        } catch (e) {
          console.error(`Failed to migrate ${mapping.table} ID: ${record.id}`, e.message);
        }
      }
      console.log(`Successfully migrated/updated ${count} ${mapping.table}.`);
    } catch (e) {
      console.log(`Skipping ${mapping.table} (Table might not exist or schema difference).`);
    }
  }

  await oldDb.destroy();
  await newDb.destroy();
  console.log('Migration Complete.');
}

runMigration().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
