import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { CreatePropertySubmissionDto } from './dto/create-property-submission.dto';
import { CrmForwardingService, propertyLabelFromPageUrl } from './crm-forwarding.service';

@Injectable()
export class LeadsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly crmForwarding: CrmForwardingService,
  ) {}

  async createEnquiry(payload: CreateEnquiryDto) {
    if (payload.source === 'whatsapp_popup') {
      const trimmedName = payload.name?.trim() ?? '';
      const trimmedPhone = payload.phone?.trim() ?? '';
      if (!trimmedName || !trimmedPhone) {
        throw new BadRequestException(
          'Name and phone are required for WhatsApp enquiries',
        );
      }
    }

    let contextLine: string | null = null;
    if (payload.source === 'whatsapp_popup') {
      const detail = [payload.listingType, payload.propertyType, payload.location]
        .filter(Boolean)
        .join(' / ');
      contextLine = `[whatsapp_popup] ${payload.pageUrl ?? ''} | ${detail}`;
    }

    const requirementValue = (
      [contextLine, payload.message].filter(Boolean).join('\n') ||
      '(no message)'
    ).slice(0, 255);

    const rawPhone = payload.phone ?? '';
    const digitsOnlyForInsert = rawPhone.replace(/\D/g, '');
    let normalizedMobile = digitsOnlyForInsert;
    if (
      normalizedMobile.length === 12 &&
      normalizedMobile.startsWith('91')
    ) {
      normalizedMobile = normalizedMobile.slice(2);
    } else if (
      normalizedMobile.length === 11 &&
      normalizedMobile.startsWith('0')
    ) {
      normalizedMobile = normalizedMobile.slice(1);
    }
    if (normalizedMobile.length > 10) {
      normalizedMobile = normalizedMobile.slice(-10);
    }

    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into('enquiry')
      .values({
        date: new Date().toISOString().slice(0, 10),
        name: (payload.name ?? '').trim().slice(0, 100),
        mobileno: normalizedMobile,
        email: (payload.email ?? '').slice(0, 100),
        requirement: requirementValue,
        propertytype: payload.propertyType ?? null,
        status: 1,
      })
      .execute();

    const insertedId =
      Number(result.identifiers[0]?.id) ||
      Number((result.raw as { insertId?: number }).insertId);

    if (payload.source === 'whatsapp_popup' && payload.phone) {
      const trimmed = (payload.name ?? '').trim();
      const digitsOnly = payload.phone.replace(/\D/g, '');
      let mobile = digitsOnly;
      if (mobile.length === 12 && mobile.startsWith('91')) {
        mobile = mobile.slice(2);
      } else if (mobile.length === 11 && mobile.startsWith('0')) {
        mobile = mobile.slice(1);
      }
      if (mobile.length > 10) {
        mobile = mobile.slice(-10);
      }
      void this.crmForwarding
        .forwardEnquiry({
          name: trimmed,
          mobile,
          email: payload.email,
          source: 'Website – WhatsApp popup',
          propertyType: payload.propertyType ?? propertyLabelFromPageUrl(payload.pageUrl) ?? undefined,
          preferences: {
            pageUrl: payload.pageUrl,
            listingType: payload.listingType,
            location: payload.location,
            source: 'whatsapp_popup',
          },
        })
        .catch(() => undefined);
    }

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
