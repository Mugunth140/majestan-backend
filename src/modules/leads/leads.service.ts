import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { CreatePropertySubmissionDto } from './dto/create-property-submission.dto';

@Injectable()
export class LeadsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createEnquiry(payload: CreateEnquiryDto) {
    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into('enquiry')
      .values({
        name: payload.name ?? null,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        property_type: payload.propertyType ?? null,
        purchase_type: payload.purchaseType ?? null,
        listing_type: payload.listingType ?? null,
        budget: payload.budget ?? null,
        message: payload.message ?? null,
        status: 1,
      })
      .execute();

    const insertedId =
      Number(result.identifiers[0]?.id) ||
      Number((result.raw as { insertId?: number }).insertId);

    return {
      id: insertedId,
      submitted: true,
    };
  }

  async createPropertySubmission(payload: CreatePropertySubmissionDto) {
    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into('propertydetails')
      .values({
        name: payload.name ?? null,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        property_type: payload.propertyType ?? null,
        listing_type: payload.listingType ?? null,
        location: payload.location ?? null,
        message: payload.message ?? null,
        status: 1,
      })
      .execute();

    const insertedId =
      Number(result.identifiers[0]?.id) ||
      Number((result.raw as { insertId?: number }).insertId);

    return {
      id: insertedId,
      submitted: true,
    };
  }
}
