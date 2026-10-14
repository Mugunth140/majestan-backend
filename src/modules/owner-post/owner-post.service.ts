import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { PropertyDraft } from '../../database/entities/property-draft.entity';
import { User } from '../../database/entities/user.entity';
import { AdminPropertiesService } from '../admin/properties/admin-properties.service';
import { CreatePropertyDto } from '../admin/properties/dto/create-property.dto';
import { SubmitOwnerPropertyDto } from './dto/submit-owner-property.dto';
import { assertOwnerMediaKey, ownerPayload } from './owner-post-policy';

@Injectable()
export class OwnerPostService {
  constructor(
    @InjectRepository(PropertyDraft)
    private readonly draftRepository: Repository<PropertyDraft>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly adminPropertiesService: AdminPropertiesService,
  ) {}
  async accountFor(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.phone || !user.isVerified || user.role !== 'user')
      throw new ForbiddenException(
        'Verify your phone using OTP login before posting a property.',
      );
    return user;
  }
  async getDraft(userId: number) {
    const user = await this.accountFor(userId);
    return (
      (await this.draftRepository.findOne({ where: { phone: user.phone } }))
        ?.payload ?? null
    );
  }
  async saveDraft(userId: number, payload: Record<string, unknown>) {
    const user = await this.accountFor(userId);
    if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > 100_000)
      throw new BadRequestException(
        'Your draft is too large. Use shorter text and up to 20 photos.',
      );
    // Atomic upsert avoids first-save races against the unique phone key.
    await this.draftRepository.upsert(
      { phone: user.phone, payload } as QueryDeepPartialEntity<PropertyDraft>,
      ['phone'],
    );
    return { saved: true };
  }
  async submit(
    userId: number,
    propertyType: string,
    dto: SubmitOwnerPropertyDto,
  ) {
    const user = await this.accountFor(userId);
    const payload = ownerPayload(propertyType, dto);
    for (const photo of payload.files)
      assertOwnerMediaKey(photo.fileKey, userId);
    for (const plan of dto.floorPlans || [])
      assertOwnerMediaKey(plan.fileKey, userId);
    const created = await this.adminPropertiesService.create(propertyType, {
      ...payload,
      status: 'available',
      verificationStatus: 'Pending',
      approvalStatus: 'Pending',
      source: 'owner-post',
      ownerId: userId,
      ownerName: user.name,
      ownerEmail: user.email,
      ownerPhone: user.phone,
      brokerageType: 'no_brokerage',
    } as CreatePropertyDto & { source: 'owner-post' });
    // A successful property creation must not look like a failed submission
    // merely because deleting its draft failed (which would invite duplicates).
    await this.draftRepository.delete({ phone: user.phone }).catch(() => {});
    return {
      id: created.id,
      propertyCode: created.propertyCode,
      approvalStatus: 'Pending',
    };
  }
}
