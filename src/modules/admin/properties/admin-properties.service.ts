import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Property, PropertyStatus, PropertyType } from '../../../database/entities/property.entity';
import { PropertyDetails } from '../../../database/entities/property-details.entity';
import { PropertyLocation } from '../../../database/entities/property-location.entity';
import { PropertyAmenity } from '../../../database/entities/property-amenity.entity';
import { PropertyUnit } from '../../../database/entities/property-unit.entity';
import { PropertyFile } from '../../../database/entities/property-file.entity';
import { PropertyFaq } from '../../../database/entities/property-faq.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { AdminPropertyQueryDto } from './dto/admin-property-query.dto';

@Injectable()
export class AdminPropertiesService {
  constructor(private readonly dataSource: DataSource) {}

  async list(propertyType: string, query: AdminPropertyQueryDto) {
    const qb = this.dataSource.getRepository(Property).createQueryBuilder('p');
    qb.where('p.propertyType = :propertyType', { propertyType });
    
    // Pagination (defaults to 0, 10)
    const page = query.page || 1;
    const limit = query.limit || 10;
    qb.skip((page - 1) * limit).take(limit);

    if (query.search) {
      qb.andWhere('(p.title LIKE :search OR p.propertyCode LIKE :search OR p.city LIKE :search)', { search: `%${query.search}%` });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, propertyType, page, limit };
  }

  async details(propertyType: string, id: number) {
    const record = await this.dataSource.getRepository(Property).findOne({
      where: { id, propertyType: propertyType as PropertyType },
      relations: ['propertyDetails', 'propertyLocations', 'propertyAmenities', 'propertyUnits', 'propertyFiles', 'faqs'],
    });

    if (!record) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    return { propertyType, record };
  }

  async create(propertyType: string, payload: CreatePropertyDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Base Property
      const property = new Property();
      Object.assign(property, {
        propertyCode: payload.propertyCode || `PROP-${Date.now()}`,
        slug: payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + `-${Date.now()}`,
        title: payload.title,
        description: payload.description,
        price: payload.price,
        propertyType: propertyType as PropertyType,
        status: payload.status,
        city: payload.city,
        state: payload.state,
        country: payload.country,
        ownerId: payload.ownerId,
      });
      const savedProperty = await queryRunner.manager.save(property);

      // 2. Create Details
      if (payload.details) {
        const details = new PropertyDetails();
        Object.assign(details, payload.details);
        details.propertyId = savedProperty.id;
        await queryRunner.manager.save(details);
      }

      // 3. Create Location
      if (payload.location) {
        const location = new PropertyLocation();
        Object.assign(location, payload.location);
        location.propertyId = savedProperty.id;
        await queryRunner.manager.save(location);
      }

      // 4. Create Amenities
      if (payload.amenities && payload.amenities.length > 0) {
        const amenities = payload.amenities.map(a => {
          const pa = new PropertyAmenity();
          Object.assign(pa, a);
          pa.propertyId = savedProperty.id;
          return pa;
        });
        await queryRunner.manager.save(amenities);
      }

      // 5. Create Units
      if (payload.units && payload.units.length > 0) {
        const units = payload.units.map(u => {
          const pu = new PropertyUnit();
          Object.assign(pu, u);
          pu.propertyId = savedProperty.id;
          return pu;
        });
        await queryRunner.manager.save(units);
      }

      // 6. Create Files
      if (payload.files && payload.files.length > 0) {
        const files = payload.files.map(f => {
          const pf = new PropertyFile();
          Object.assign(pf, f);
          pf.propertyId = savedProperty.id;
          return pf;
        });
        await queryRunner.manager.save(files);
      }

      // 7. Create FAQs
      if (payload.faqs && payload.faqs.length > 0) {
        const faqs = payload.faqs.map(f => {
          const pfaq = new PropertyFaq();
          Object.assign(pfaq, f);
          pfaq.propertyId = savedProperty.id;
          return pfaq;
        });
        await queryRunner.manager.save(faqs);
      }

      await queryRunner.commitTransaction();
      return this.details(propertyType, savedProperty.id);

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(propertyType: string, id: number, payload: Partial<CreatePropertyDto>) {
    // Only updates base table fields for now. 
    // In a fully featured admin panel, we would do a diff against existing sub-entities.
    const updateData: any = {};
    if (payload.title) updateData.title = payload.title;
    if (payload.description) updateData.description = payload.description;
    if (payload.price) updateData.price = payload.price;
    if (payload.status) updateData.status = payload.status;

    if (Object.keys(updateData).length > 0) {
      await this.dataSource.getRepository(Property).update({ id }, updateData);
    }
    
    return this.details(propertyType, id);
  }

  async updateStatus(propertyType: string, id: number, status: string) {
    await this.dataSource.getRepository(Property).update({ id }, { status: status as PropertyStatus });
    return this.details(propertyType, id);
  }

  async remove(propertyType: string, id: number) {
    await this.dataSource.getRepository(Property).delete({ id });
    return { deleted: true, id };
  }
}
