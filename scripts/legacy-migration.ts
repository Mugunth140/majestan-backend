import { DataSource } from 'typeorm';
import { Property, PropertyType, PropertyStatus } from '../src/database/entities/property.entity';
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
          const property = new Property();
          property.propertyCode = `LEGACY-${mapping.codePrefix}-${record.id}`;
          
          // Legacy tables are inconsistent with column names. Handle name/property_name.
          const nameField = record.property_name || record.name || record.title || `${mapping.type}-${record.id}`;
          property.title = nameField;
          property.slug = nameField.toLowerCase().replace(/[^a-z0-9]+/g, '-') + `-${record.id}`;
          property.description = record.description || '';
          
          // Sanitize price to avoid 'Incorrect decimal value' errors
          let safePrice = '0';
          if (record.price) {
            const parsed = parseFloat(String(record.price).replace(/[^0-9.]/g, ''));
            if (!isNaN(parsed)) {
              safePrice = parsed > 9999999999.99 ? '9999999999.99' : parsed.toString();
            }
          }
          property.price = safePrice;
          
          property.propertyType = mapping.type;
          property.status = PropertyStatus.AVAILABLE;
          
          property.city = record.city || 'Coimbatore';
          property.state = record.state || 'Tamil Nadu';
          property.country = 'India';
          property.ownerId = adminUser.id;
          
          await newDb.getRepository(Property).save(property);
          count++;
        } catch (e) {
          console.error(`Failed to migrate ${mapping.table} ID: ${record.id}`, e.message);
        }
      }
      console.log(`Successfully migrated ${count} ${mapping.table}.`);
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
