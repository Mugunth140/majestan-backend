import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import {
  CreatePropertyEnquiryDto,
  VISIT_SLOTS,
} from './dto/create-property-enquiry.dto';
import { CreatePropertySubmissionDto } from './dto/create-property-submission.dto';
import { CrmForwardingService, propertyLabelFromPageUrl } from './crm-forwarding.service';

/** 'YYYY-MM-DD' — the only visit-date form we accept; @IsDateString() also
 * admits compact-ISO ('20261005'), which breaks lexicographic date compares. */
const VISIT_DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

const ORPHAN_PROPERTY_ID = 999; // 'Legacy Unmapped Property' — designated fallback, see migration 1779100000000.

@Injectable()
export class LeadsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly crmForwarding: CrmForwardingService,
  ) {}

  /**
   * Strips formatting, drops a `91` country code or leading trunk `0`, and
   * clamps to the last 10 digits — the shape the `leads.phone` column and the
   * CRM `whatsapp` field both expect.
   */
  private normalizePhoneForInsert(raw: string): string {
    const digitsOnlyForInsert = raw.replace(/\D/g, '');
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
    return normalizedMobile;
  }

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

    const rawPhone = payload.phone ?? '';
    const normalizedMobile = this.normalizePhoneForInsert(rawPhone);

    // The unified schema requires a property link. Generic (property-less)
    // enquiries point at the designated orphan bucket instead of an arbitrary
    // listing — see ORPHAN_PROPERTY_ID.
    const propertyRow = { id: ORPHAN_PROPERTY_ID };

    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into('leads')
      .values({
        // NOTE: keys must be entity property names (camelCase), not column
        // names — the Lead entity maps propertyId/userId to property_id/user_id.
        // This lead is not about a specific listing: it is filed against the
        // orphan bucket, so the true enquiry context lives in message (and the
        // structured copy in CRM).
        propertyId: propertyRow.id,
        userId: null,
        name: (payload.name ?? '').trim().slice(0, 255),
        email: (payload.email ?? '').slice(0, 255),
        phone: normalizedMobile,
        message:
          [contextLine, payload.message].filter(Boolean).join('\n') ||
          '(no message)',
        status: 'new',
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
          listingType: payload.listingType,
          location: payload.location,
          preferences: {
            pageUrl: payload.pageUrl,
            listingType: payload.listingType,
            location: payload.location,
            source: 'whatsapp_popup',
            whatsappOptIn: payload.whatsappOptIn ?? true,
          },
        })
        .catch(() => undefined);
    }

    return {
      id: insertedId,
      submitted: true,
    };
  }

  async createPropertyEnquiry(
    payload: CreatePropertyEnquiryDto,
    userId: number | null,
  ) {
    if (!payload.name?.trim() || !payload.phone?.trim()) {
      throw new BadRequestException('Name and phone are required');
    }
    if (payload.intent === 'site_visit') {
      if (!payload.visitDate || !payload.visitSlot) {
        throw new BadRequestException('Visit date and time slot are required');
      }
      if (!VISIT_DATE_FORMAT.test(payload.visitDate)) {
        throw new BadRequestException('Invalid visit date');
      }
      if (payload.visitDate < new Date().toLocaleDateString('en-CA')) {
        throw new BadRequestException('Visit date cannot be in the past');
      }
      if (!(VISIT_SLOTS as readonly string[]).includes(payload.visitSlot)) {
        throw new BadRequestException('Invalid visit slot');
      }
    }

    const normalizedMobile = this.normalizePhoneForInsert(payload.phone ?? '');

    // The property is resolved from the DB by id, never from the client's
    // propertyCode/slug — those are attacker-controlled.
    const propertyRow = await this.dataSource
      .createQueryBuilder()
      .from('properties', 'p')
      .select('p.id', 'id')
      .addSelect('p.property_code', 'propertyCode')
      .addSelect('p.slug', 'slug')
      .addSelect('p.property_type', 'propertyType')
      .where('p.id = :id', { id: payload.propertyId })
      .getRawOne<{
        id: number;
        propertyCode: string | null;
        slug: string | null;
        propertyType: string | null;
      }>();
    if (!propertyRow) {
      throw new BadRequestException('Property not found');
    }

    const contextLine =
      `[property_page] ${propertyRow.propertyCode ?? payload.propertyId} ${propertyRow.slug ?? ''}`.trim();
    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into('leads')
      .values({
        propertyId: propertyRow.id,
        userId,
        name: (payload.name ?? '').trim().slice(0, 255),
        email: (payload.email ?? '').slice(0, 255),
        phone: normalizedMobile,
        message:
          [contextLine, payload.message].filter(Boolean).join('\n') ||
          '(no message)',
        status: 'new',
      })
      .execute();

    const insertedId =
      Number(result.identifiers[0]?.id) ||
      Number((result.raw as { insertId?: number }).insertId);

    void this.crmForwarding
      .forwardEnquiry({
        name: (payload.name ?? '').trim(),
        mobile: normalizedMobile,
        email: payload.email,
        source: 'Website – Property page',
        propertyType: propertyRow.propertyType ?? undefined,
        intent: payload.intent,
        visitDate: payload.visitDate,
        visitSlot: payload.visitSlot,
        propertyId: propertyRow.id,
        propertyCode: propertyRow.propertyCode ?? undefined,
        propertySlug: propertyRow.slug ?? undefined,
        preferences: { pageUrl: undefined, source: 'property_page' },
      })
      .catch(() => undefined);

    return { id: insertedId, submitted: true };
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
