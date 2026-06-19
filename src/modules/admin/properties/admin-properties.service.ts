import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Property, PropertyStatus, PropertyType } from '../../../database/entities/property.entity';
import { PropertyDetails } from '../../../database/entities/property-details.entity';
import { PropertyLocation } from '../../../database/entities/property-location.entity';
import { PropertyAmenity } from '../../../database/entities/property-amenity.entity';
import { PropertyUnit } from '../../../database/entities/property-unit.entity';
import { PropertyFile } from '../../../database/entities/property-file.entity';
import { PropertyImage } from '../../../database/entities/property-image.entity';
import { PropertyFaq } from '../../../database/entities/property-faq.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { AdminPropertyQueryDto } from './dto/admin-property-query.dto';

import { generateSeoSlug, normalizeSeoSlug, getPropertyTypeCode, enforceSlugSuffix } from '../../properties/utils/property-slug.util';
import { Sublocation } from '../../../database/entities/sublocation.entity';
import { City } from '../../../database/entities/city.entity';
import { StorageService } from '../../storage/storage.service';

@Injectable()
export class AdminPropertiesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

  async list(propertyType: string, query: AdminPropertyQueryDto) {
    const qb = this.dataSource.getRepository(Property).createQueryBuilder('p')
      .leftJoinAndSelect('p.propertyImages', 'images', 'images.isPrimary = true');
    
    if (propertyType && propertyType !== 'all') {
      qb.where('p.propertyType = :propertyType', { propertyType });
    }
    
    if (query.listingType) {
      qb.andWhere('p.listingType = :listingType', { listingType: query.listingType });
    }
    
    // Pagination (defaults to 0, 10)
    const page = query.page || 1;
    const limit = query.limit || 10;
    qb.skip((page - 1) * limit).take(limit);

    if (query.search) {
      qb.andWhere('(p.title LIKE :search OR p.propertyCode LIKE :search OR p.city LIKE :search)', { search: `%${query.search}%` });
    }

    const [data, total] = await qb.getManyAndCount();
    
    const mappedData = await Promise.all(data.map(async p => {
      // TypeORM leftJoinAndSelect populates the relation, but it's still wrapped in a Promise
      const images = await p.propertyImages || [];
      return {
        ...p,
        propertyImages: this.storageService.resolveImageUrls(images)
      };
    }));

    return { items: mappedData, total, propertyType, page, limit };
  }

  async details(propertyType: string, id: number) {
    const record = await this.dataSource.getRepository(Property).findOne({
      where: { id, propertyType: propertyType as PropertyType },
      relations: [
        'propertyDetails',
        'propertyLocations',
        'propertyLocations.sublocation',
        'propertyAmenities',
        'propertyUnits',
        'propertyFiles',
        'propertyImages',
        'faqs',
      ],
    });

    if (!record) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    const [
      propertyDetails,
      propertyLocations,
      propertyAmenitiesRaw,
      propertyUnits,
      propertyFiles,
      propertyImages,
      faqs,
    ] = await Promise.all([
      record.propertyDetails,
      record.propertyLocations,
      record.propertyAmenities,
      record.propertyUnits,
      record.propertyFiles,
      record.propertyImages,
      record.faqs,
    ]);

    const propertyAmenities = propertyAmenitiesRaw ? await Promise.all(
      propertyAmenitiesRaw.map(async (pa) => {
        const amenity = await pa.amenity;
        return { ...pa, amenity };
      })
    ) : [];

    return {
      ...record,
      propertyDetails,
      propertyLocations,
      propertyAmenities,
      propertyUnits,
      propertyFiles,
      propertyImages: this.storageService.resolveImageUrls(propertyImages || []),
      faqs,
    };
  }

  async create(propertyType: string, payload: CreatePropertyDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const selectedLocation = await this.resolveLocation(
        queryRunner.manager,
        payload,
      );

      // 1. Create Base Property
      const property = new Property();
      Object.assign(property, {
        propertyCode: payload.propertyCode || `PROP-${Date.now()}`,
        slug: `temp-slug-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        title: payload.title,
        description: payload.description,
        price: payload.price,
        propertyType: propertyType as PropertyType,
        listingType: payload.listingType || 'Sell',
        status: payload.status,
        city: selectedLocation.city.cityName,
        state: selectedLocation.city.stateName,
        country: selectedLocation.city.countryName,
        ownerId: payload.ownerId,
        builderName: payload.builderName,
        propertyCondition: payload.propertyCondition,
        ownershipType: payload.ownershipType,
        reraNumber: payload.reraNumber,
        projectName: payload.projectName,
        negotiable: payload.negotiable ?? false,
        maintenanceCharges: payload.maintenanceCharges,
        securityDeposit: payload.securityDeposit,
        bookingAmount: payload.bookingAmount,
        brokerageType: payload.brokerageType || 'no_brokerage',
        brokerageValue: payload.brokerageValue,
        availableFrom: payload.availableFrom ? new Date(payload.availableFrom) : null,
        availableUntil: payload.availableUntil ? new Date(payload.availableUntil) : null,
        verificationStatus: payload.verificationStatus || 'Pending',
        approvalStatus: payload.approvalStatus || 'Pending',
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription,
        metaKeywords: payload.metaKeywords,
        ownerName: payload.ownerName,
        ownerEmail: payload.ownerEmail,
        ownerPhone: payload.ownerPhone,
      });
      let savedProperty = await queryRunner.manager.save(property);
      
      // Update with correct slug and propertyCode now that we have ID
      if (payload.slug) {
         savedProperty.slug = enforceSlugSuffix(payload.slug, savedProperty.propertyType, savedProperty.id);
      } else {
         savedProperty.slug = generateSeoSlug(savedProperty.title, savedProperty.propertyType, savedProperty.id);
      }

      if (!payload.propertyCode) {
         const prefix = getPropertyTypeCode(savedProperty.propertyType).toUpperCase();
         savedProperty.propertyCode = `${prefix}${String(savedProperty.id).padStart(3, '0')}`;
      }

      savedProperty = await queryRunner.manager.save(savedProperty);

      // 2. Create Details
      if (payload.details) {
        const details = new PropertyDetails();
        Object.assign(details, {
          bedrooms: payload.details.bedrooms ?? 0,
          bathrooms: payload.details.bathrooms ?? 0,
          areaSqft: payload.details.areaSqft ?? 0,
          parking: payload.details.parking ?? 0,
          furnished: payload.details.furnished ?? false,
          balconies: payload.details.balconies ?? 0,
          floorNumber: payload.details.floorNumber,
          totalFloors: payload.details.totalFloors ?? 0,
          builtUpArea: payload.details.buildUpArea,
          carpetArea: payload.details.carpetArea,
          superBuiltUpArea: payload.details.superBuiltUpArea,
          plotArea: payload.details.plotArea,
          areaUnit: payload.details.areaUnit || 'Sq Ft',
          propertyFacing: payload.details.facing,
          propertyAge: payload.details.propertyAge,
          possessionStatus: payload.details.possessionStatus,
          waterSupply: payload.details.waterSupply,
          powerBackup: payload.details.powerBackup,
          roadWidth: payload.details.roadWidth,
          openSides: payload.details.openSides ?? 0,
          // Previously added fields
          plotLength: payload.details.plotLength,
          plotWidth: payload.details.plotWidth,
          boundaryWall: payload.details.boundaryWall,
          suitableFor: payload.details.suitableFor,
          hasPantry: payload.details.hasPantry,
          hasCentralAc: payload.details.hasCentralAc,
          ceilingHeightFt: payload.details.ceilingHeightFt,
          heavyVehicleAccess: payload.details.heavyVehicleAccess,
          // Plot
          plotSizeCents: payload.details.plotSizeCents,
          // Coworking
          minSeats: payload.details.minSeats,
          rentPerSeat: payload.details.rentPerSeat,
          privateCabins: payload.details.privateCabins,
          meetingRooms: payload.details.meetingRooms,
          availableWorkstations: payload.details.availableWorkstations,
          hasRestroom: payload.details.hasRestroom,
          // Commercial
          floorsOccupied: payload.details.floorsOccupied,
          // Industrial
          truckParking: payload.details.truckParking,
          carParking: payload.details.carParking,
          bikeParking: payload.details.bikeParking,
          coveredArea: payload.details.coveredArea,
          openArea: payload.details.openArea,
          floorType: payload.details.floorType,
          powerSupplyHp: payload.details.powerSupplyHp,
          // Apartment
          guestParking: payload.details.guestParking,
        });
        details.propertyId = savedProperty.id;
        await queryRunner.manager.save(details);
      }

      // 3. Create Location
      if (payload.location || payload.sublocationId) {
        const location = new PropertyLocation();
        Object.assign(location, payload.location);
        location.propertyId = savedProperty.id;
        location.locationId = selectedLocation.sublocation.id;
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

      // 6. Create Images
      if (payload.files && payload.files.length > 0) {
        const images = payload.files.map((f, idx) => {
          const pi = new PropertyImage();
          pi.propertyId = savedProperty.id;
          pi.imageUrl = f.fileUrl;
          pi.imageKey = f.fileKey ?? f.fileUrl; // prefer explicit R2 key
          pi.isPrimary = idx === 0;
          return pi;
        });
        await queryRunner.manager.save(images);
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
      if (savedProperty.slug) {
        this.triggerFrontendRevalidation(savedProperty.slug);
      }
      return this.details(propertyType, savedProperty.id);

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(propertyType: string, id: number, payload: Partial<CreatePropertyDto>) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const shouldUpdateLocation =
        payload.cityId !== undefined ||
        payload.sublocationId !== undefined ||
        payload.city !== undefined ||
        payload.location !== undefined;
      const selectedLocation = shouldUpdateLocation
        ? await this.resolveLocation(queryRunner.manager, payload)
        : null;

      // 1. Update Base Property
      const updateData: any = {};
      if (payload.title) updateData.title = payload.title;
      if (payload.description) updateData.description = payload.description;
      if (payload.price) updateData.price = payload.price;
      if (payload.listingType) updateData.listingType = payload.listingType;
      if (payload.status) updateData.status = payload.status;
      if (payload.slug) updateData.slug = enforceSlugSuffix(payload.slug, propertyType, id);
      
      if (selectedLocation) {
        updateData.city = selectedLocation.city.cityName;
        updateData.state = selectedLocation.city.stateName;
        updateData.country = selectedLocation.city.countryName;
      }
      if (payload.builderName) updateData.builderName = payload.builderName;
      if (payload.propertyCondition !== undefined) updateData.propertyCondition = payload.propertyCondition;
      if (payload.ownershipType !== undefined) updateData.ownershipType = payload.ownershipType;
      if (payload.reraNumber !== undefined) updateData.reraNumber = payload.reraNumber;
      if (payload.projectName !== undefined) updateData.projectName = payload.projectName;
      if (payload.negotiable !== undefined) updateData.negotiable = payload.negotiable;
      if (payload.maintenanceCharges !== undefined) updateData.maintenanceCharges = payload.maintenanceCharges;
      if (payload.securityDeposit !== undefined) updateData.securityDeposit = payload.securityDeposit;
      if (payload.bookingAmount !== undefined) updateData.bookingAmount = payload.bookingAmount;
      if (payload.brokerageType !== undefined) updateData.brokerageType = payload.brokerageType;
      if (payload.brokerageValue !== undefined) updateData.brokerageValue = payload.brokerageValue;
      if (payload.availableFrom !== undefined) updateData.availableFrom = payload.availableFrom ? new Date(payload.availableFrom) : null;
      if (payload.availableUntil !== undefined) updateData.availableUntil = payload.availableUntil ? new Date(payload.availableUntil) : null;
      if (payload.verificationStatus !== undefined) updateData.verificationStatus = payload.verificationStatus;
      if (payload.approvalStatus !== undefined) updateData.approvalStatus = payload.approvalStatus;
      if (payload.metaTitle !== undefined) updateData.metaTitle = payload.metaTitle;
      if (payload.metaDescription !== undefined) updateData.metaDescription = payload.metaDescription;
      if (payload.metaKeywords !== undefined) updateData.metaKeywords = payload.metaKeywords;
      if (payload.ownerName !== undefined) updateData.ownerName = payload.ownerName;
      if (payload.ownerEmail !== undefined) updateData.ownerEmail = payload.ownerEmail;
      if (payload.ownerPhone !== undefined) updateData.ownerPhone = payload.ownerPhone;

      if (Object.keys(updateData).length > 0) {
        await queryRunner.manager.update(Property, { id }, updateData);
      }

      // 2. Update Details
      if (payload.details) {
        await queryRunner.manager.delete(PropertyDetails, { propertyId: id });
        const details = new PropertyDetails();
        Object.assign(details, {
          bedrooms: payload.details.bedrooms ?? 0,
          bathrooms: payload.details.bathrooms ?? 0,
          areaSqft: payload.details.areaSqft ?? 0,
          parking: payload.details.parking ?? 0,
          furnished: payload.details.furnished ?? false,
          balconies: payload.details.balconies ?? 0,
          floorNumber: payload.details.floorNumber,
          totalFloors: payload.details.totalFloors ?? 0,
          builtUpArea: payload.details.buildUpArea,
          carpetArea: payload.details.carpetArea,
          superBuiltUpArea: payload.details.superBuiltUpArea,
          plotArea: payload.details.plotArea,
          areaUnit: payload.details.areaUnit || 'Sq Ft',
          propertyFacing: payload.details.facing,
          propertyAge: payload.details.propertyAge,
          possessionStatus: payload.details.possessionStatus,
          waterSupply: payload.details.waterSupply,
          powerBackup: payload.details.powerBackup,
          roadWidth: payload.details.roadWidth,
          openSides: payload.details.openSides ?? 0,
          // Previously added fields
          plotLength: payload.details.plotLength,
          plotWidth: payload.details.plotWidth,
          boundaryWall: payload.details.boundaryWall,
          suitableFor: payload.details.suitableFor,
          hasPantry: payload.details.hasPantry,
          hasCentralAc: payload.details.hasCentralAc,
          ceilingHeightFt: payload.details.ceilingHeightFt,
          heavyVehicleAccess: payload.details.heavyVehicleAccess,
          // Plot
          plotSizeCents: payload.details.plotSizeCents,
          // Coworking
          minSeats: payload.details.minSeats,
          rentPerSeat: payload.details.rentPerSeat,
          privateCabins: payload.details.privateCabins,
          meetingRooms: payload.details.meetingRooms,
          availableWorkstations: payload.details.availableWorkstations,
          hasRestroom: payload.details.hasRestroom,
          // Commercial
          floorsOccupied: payload.details.floorsOccupied,
          // Industrial
          truckParking: payload.details.truckParking,
          carParking: payload.details.carParking,
          bikeParking: payload.details.bikeParking,
          coveredArea: payload.details.coveredArea,
          openArea: payload.details.openArea,
          floorType: payload.details.floorType,
          powerSupplyHp: payload.details.powerSupplyHp,
          // Apartment
          guestParking: payload.details.guestParking,
        });
        details.propertyId = id;
        await queryRunner.manager.save(details);
      }

      // 3. Update Location
      if (selectedLocation) {
        await queryRunner.manager.delete(PropertyLocation, { propertyId: id });
        const location = new PropertyLocation();
        Object.assign(location, payload.location);
        location.propertyId = id;
        location.locationId = selectedLocation.sublocation.id;
        await queryRunner.manager.save(location);
      }

      // 4. Update Amenities
      if (payload.amenities !== undefined) {
        await queryRunner.manager.delete(PropertyAmenity, { propertyId: id });
        if (payload.amenities.length > 0) {
          const amenities = payload.amenities.map(a => {
            const pa = new PropertyAmenity();
            Object.assign(pa, a);
            pa.propertyId = id;
            return pa;
          });
          await queryRunner.manager.save(amenities);
        }
      }

      // 5. Update Images (diff-delete orphaned R2 files)
      if (payload.files !== undefined) {
        const existingImages = await queryRunner.manager.find(PropertyImage, { where: { propertyId: id } });
        const existingKeys = existingImages.map(img => img.imageKey).filter(Boolean) as string[];
        const newKeys = payload.files.map(f => f.fileUrl);
        const orphanedKeys = existingKeys.filter(k => !newKeys.includes(k));

        await queryRunner.manager.delete(PropertyImage, { propertyId: id });
        if (payload.files.length > 0) {
          const images = payload.files.map((f, idx) => {
            const pi = new PropertyImage();
            pi.propertyId = id;
            pi.imageUrl = f.fileUrl;
            pi.imageKey = f.fileKey ?? f.fileUrl; // prefer explicit R2 key
            pi.isPrimary = idx === 0;
            return pi;
          });
          await queryRunner.manager.save(images);
        }

        // Delete orphaned R2 files after transaction data is safe
        if (orphanedKeys.length > 0) {
          this.storageService.deleteFiles(orphanedKeys).catch(err =>
            console.error(`[AdminProperties] Failed to delete orphaned R2 images`, err)
          );
        }
      }

      // 5b. Update Units (floor plans) — diff-delete orphaned R2 files
      if (payload.units !== undefined) {
        const existingUnits = await queryRunner.manager.find(PropertyUnit, { where: { propertyId: id } });
        const existingUnitKeys = existingUnits
          .map(u => u.floorPlanImageKey)
          .filter(Boolean) as string[];
        const newUnitKeys = (payload.units || [])
          .map(u => u.floorPlanImageKey)
          .filter(Boolean) as string[];
        const orphanedUnitKeys = existingUnitKeys.filter(k => !newUnitKeys.includes(k));

        await queryRunner.manager.delete(PropertyUnit, { propertyId: id });
        if (payload.units.length > 0) {
          const units = payload.units.map(u => {
            const pu = new PropertyUnit();
            Object.assign(pu, u);
            pu.propertyId = id;
            return pu;
          });
          await queryRunner.manager.save(units);
        }

        if (orphanedUnitKeys.length > 0) {
          this.storageService.deleteFiles(orphanedUnitKeys).catch(err =>
            console.error(`[AdminProperties] Failed to delete orphaned R2 unit images`, err)
          );
        }
      }

      // 6. Update FAQs
      if (payload.faqs !== undefined) {
        await queryRunner.manager.delete(PropertyFaq, { propertyId: id });
        if (payload.faqs.length > 0) {
          const faqs = payload.faqs.map(f => {
            const pfaq = new PropertyFaq();
            Object.assign(pfaq, f);
            pfaq.propertyId = id;
            return pfaq;
          });
          await queryRunner.manager.save(faqs);
        }
      }

      await queryRunner.commitTransaction();
      const prop = await this.details(propertyType, id);
      if (prop.slug) {
        this.triggerFrontendRevalidation(prop.slug);
      }
      return prop;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateStatus(propertyType: string, id: number, status: string) {
    await this.dataSource.getRepository(Property).update({ id }, { status: status as PropertyStatus });
    const prop = await this.details(propertyType, id);
    if (prop.slug) {
      this.triggerFrontendRevalidation(prop.slug);
    }
    return prop;
  }

  async remove(propertyType: string, id: number) {
    // Gather all R2 keys before deleting from DB
    const [images, units] = await Promise.all([
      this.dataSource.getRepository(PropertyImage).find({ where: { propertyId: id } }),
      this.dataSource.getRepository(PropertyUnit).find({ where: { propertyId: id } }),
    ]);
    const imageKeys = images.map(img => img.imageKey).filter(Boolean) as string[];
    const unitKeys = units.map(u => u.floorPlanImageKey).filter(Boolean) as string[];
    const allKeys = [...imageKeys, ...unitKeys];

    const result = await this.dataSource.getRepository(Property).delete({ id });
    if (!result.affected || result.affected === 0) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    if (allKeys.length > 0) {
      this.storageService.deleteFiles(allKeys).catch(err =>
        console.error(`[AdminProperties] Failed to delete R2 files for property ${id}`, err)
      );
    }

    return { deleted: true, id };
  }

  private async resolveLocation(
    manager: EntityManager,
    payload: Partial<CreatePropertyDto>,
  ): Promise<{ city: City; sublocation: Sublocation }> {
    const cityRepository = manager.getRepository(City);
    const sublocationRepository = manager.getRepository(Sublocation);

    const city = payload.cityId
      ? await cityRepository.findOne({
          where: { id: payload.cityId, isActive: 1 },
        })
      : await cityRepository
          .createQueryBuilder('city')
          .where('LOWER(city.cityName) = LOWER(:cityName)', {
            cityName: payload.city?.trim() ?? '',
          })
          .andWhere('city.isActive = :active', { active: 1 })
          .getOne();

    if (!city) {
      throw new BadRequestException('Please select an active city');
    }

    const localityName = payload.location?.subLocation?.trim();
    const sublocation = payload.sublocationId
      ? await sublocationRepository.findOne({
          where: {
            id: payload.sublocationId,
            cityId: city.id,
            isActive: 1,
          },
        })
      : await sublocationRepository
          .createQueryBuilder('sublocation')
          .where('sublocation.cityId = :cityId', { cityId: city.id })
          .andWhere('LOWER(sublocation.localityName) = LOWER(:localityName)', {
            localityName: localityName ?? '',
          })
          .andWhere('sublocation.isActive = :active', { active: 1 })
          .getOne();

    if (!sublocation) {
      throw new BadRequestException(
        'Please select an active sublocation for the selected city',
      );
    }

    return { city, sublocation };
  }

  private triggerFrontendRevalidation(slug: string) {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      console.warn('[AdminProperties] FRONTEND_URL is not set — skipping ISR revalidation');
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    fetch(`${frontendUrl}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        secret: process.env.REVALIDATE_SECRET || 'majestan-isr-secret',
      }),
      signal: controller.signal as any,
    })
      .then(() => clearTimeout(timeoutId))
      .catch(error => {
        clearTimeout(timeoutId);
        console.error(`Failed to revalidate frontend for slug: ${slug}`, error);
      });
  }
}
