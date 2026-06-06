import { DataSource } from 'typeorm';
import { Property, PropertyType, PropertyStatus } from '../src/database/entities/property.entity';
import { PropertyDetails } from '../src/database/entities/property-details.entity';
import { PropertyImage } from '../src/database/entities/property-image.entity';
import { PropertyLocation } from '../src/database/entities/property-location.entity';
import { User, UserRole } from '../src/database/entities/user.entity';

async function seedDatabase() {
  console.log('Connecting to database to clear and seed...');
  
  const db = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '8220',
    database: process.env.DB_NAME || 'majestan',
    entities: [__dirname + '/../src/database/entities/*.entity{.ts,.js}'],
  });

  await db.initialize();
  console.log('Database connected!');

  // Disable foreign key checks to safely clear tables
  await db.query('SET FOREIGN_KEY_CHECKS = 0;');
  await db.query('TRUNCATE TABLE property_images;');
  await db.query('TRUNCATE TABLE property_details;');
  await db.query('TRUNCATE TABLE property_locations;');
  await db.query('TRUNCATE TABLE properties;');
  await db.query('SET FOREIGN_KEY_CHECKS = 1;');
  
  console.log('Database cleared!');

  // Create an admin user if not exists
  let adminUser = await db.getRepository(User).findOne({ where: { email: 'admin@majestan.com' } });
  if (!adminUser) {
    adminUser = new User();
    adminUser.name = 'Demo Admin';
    adminUser.email = 'admin@majestan.com';
    adminUser.phone = '9999999999';
    adminUser.passwordHash = 'hashed_password_here';
    adminUser.role = UserRole.ADMIN;
    adminUser.isVerified = true;
    adminUser = await db.getRepository(User).save(adminUser);
  }

  const dummyProperties = [
    // --- SELL PROPERTIES ---
    {
      title: 'Luxury 4BHK Villa in RS Puram',
      slug: 'luxury-4bhk-villa-rs-puram',
      description: '<p>A stunning, ultra-luxury 4BHK villa located in the heart of RS Puram.</p>',
      price: '55000000',
      listingType: 'Sell',
      propertyType: PropertyType.VILLA,
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      details: { bedrooms: 4, bathrooms: 5, areaSqft: '4500', parking: 2, furnished: true },
      images: ['https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&q=80']
    },
    {
      title: 'Modern 3BHK Apartment near Tidel Park',
      slug: 'modern-3bhk-apartment-tidel-park',
      description: '<p>Beautiful 3 bedroom apartment overlooking the city skyline.</p>',
      price: '12000000',
      listingType: 'Sell',
      propertyType: PropertyType.APARTMENT,
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      details: { bedrooms: 3, bathrooms: 3, areaSqft: '1850', parking: 1, furnished: false },
      images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80']
    },
    {
      title: 'Spacious 2BHK Flat in Saravanampatti',
      slug: 'spacious-2bhk-flat-saravanampatti',
      description: '<p>Excellent investment opportunity! Brand new 2BHK flat.</p>',
      price: '6500000',
      listingType: 'Sell',
      propertyType: PropertyType.APARTMENT,
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      details: { bedrooms: 2, bathrooms: 2, areaSqft: '1200', parking: 1, furnished: true },
      images: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80']
    },
    {
      title: 'Independent House in Vadavalli',
      slug: 'independent-house-vadavalli',
      description: '<p>A serene independent house with a lush garden.</p>',
      price: '18500000',
      listingType: 'Sell',
      propertyType: PropertyType.INDIVIDUAL_PORTION, // Used for independent house
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      details: { bedrooms: 3, bathrooms: 3, areaSqft: '2400', parking: 1, furnished: false },
      images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80']
    },
    {
      title: 'Premium Plot in Kovaipudur',
      slug: 'premium-plot-kovaipudur',
      description: '<p>Ready to build premium plot in a gated community.</p>',
      price: '4500000',
      listingType: 'Sell',
      propertyType: PropertyType.PLOT,
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      details: { bedrooms: 0, bathrooms: 0, areaSqft: '1500', parking: 0, furnished: false },
      images: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80']
    },
    {
      title: 'Agricultural Farmland in Thondamuthur',
      slug: 'agricultural-farmland-thondamuthur',
      description: '<p>Fertile farmland with abundant water supply.</p>',
      price: '25000000',
      listingType: 'Sell',
      propertyType: PropertyType.FARMLAND,
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      details: { bedrooms: 0, bathrooms: 0, areaSqft: '217800', parking: 0, furnished: false },
      images: ['https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&q=80']
    },
    
    // --- RENT PROPERTIES ---
    {
      title: 'Prime Commercial Space in Gandhipuram',
      slug: 'prime-commercial-space-gandhipuram',
      description: '<p>High-visibility commercial space right on the main road.</p>',
      price: '350000',
      listingType: 'Rent',
      propertyType: PropertyType.COMMERCIAL,
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      details: { bedrooms: 0, bathrooms: 2, areaSqft: '3200', parking: 5, furnished: false },
      images: ['https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80']
    },
    {
      title: 'Fully Furnished 2BHK for Rent in Peelamedu',
      slug: 'furnished-2bhk-rent-peelamedu',
      description: '<p>Beautifully furnished apartment available for rent.</p>',
      price: '25000',
      listingType: 'Rent',
      propertyType: PropertyType.APARTMENT,
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      details: { bedrooms: 2, bathrooms: 2, areaSqft: '1100', parking: 1, furnished: true },
      images: ['https://images.unsplash.com/photo-1502672260266-1c1de2d9d115?auto=format&fit=crop&q=80']
    },
    {
      title: 'Coworking Space in Race Course',
      slug: 'coworking-space-race-course',
      description: '<p>Premium coworking seats and private cabins.</p>',
      price: '8000',
      listingType: 'Rent',
      propertyType: PropertyType.COWORKING,
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      details: { bedrooms: 0, bathrooms: 4, areaSqft: '5000', parking: 10, furnished: true },
      images: ['https://images.unsplash.com/photo-1497215848143-66236b288df7?auto=format&fit=crop&q=80']
    },
    {
      title: 'Industrial Warehouse in Kurumbapalayam',
      slug: 'industrial-warehouse-kurumbapalayam',
      description: '<p>Large industrial shed with heavy vehicle access.</p>',
      price: '150000',
      listingType: 'Rent',
      propertyType: PropertyType.INDUSTRIAL,
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      details: { bedrooms: 0, bathrooms: 2, areaSqft: '10000', parking: 15, furnished: false },
      images: ['https://images.unsplash.com/photo-1586528116311-ad8ed7ce30f0?auto=format&fit=crop&q=80']
    }
  ];

  for (const item of dummyProperties) {
    const propertyCode = `DUMMY-${Math.floor(Math.random() * 10000)}`;
    const propertyResult = await db.query(
      `INSERT INTO \`properties\`(\`property_code\`, \`slug\`, \`title\`, \`description\`, \`price\`, \`property_type\`, \`listing_type\`, \`status\`, \`owner_id\`, \`city\`, \`state\`, \`country\`, \`created_at\`, \`updated_at\`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DEFAULT, DEFAULT)`,
      [
        propertyCode,
        item.slug,
        item.title,
        item.description,
        item.price,
        item.propertyType,
        item.listingType,
        PropertyStatus.AVAILABLE,
        adminUser.id,
        item.city,
        item.state,
        'India'
      ]
    );

    const savedProp = { id: propertyResult.insertId };

    const details = new PropertyDetails();
    details.propertyId = savedProp.id;
    details.bedrooms = item.details.bedrooms;
    details.bathrooms = item.details.bathrooms;
    details.areaSqft = item.details.areaSqft;
    details.parking = item.details.parking;
    details.furnished = item.details.furnished;
    await db.getRepository(PropertyDetails).save(details);

    for (let i = 0; i < item.images.length; i++) {
      const img = new PropertyImage();
      img.propertyId = savedProp.id;
      img.imageUrl = item.images[i];
      img.imageKey = `dummy-key-${Date.now()}-${i}`;
      img.isPrimary = i === 0; // First image is primary
      await db.getRepository(PropertyImage).save(img);
    }
    
    console.log(`Seeded: ${item.title}`);
  }

  await db.destroy();
  console.log('Seeding Complete! 🎉');
}

seedDatabase().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
