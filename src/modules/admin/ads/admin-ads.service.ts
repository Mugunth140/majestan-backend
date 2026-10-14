// admin-ads.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ad, AdLinkType, AdPlacement } from '../../../database/entities/ad.entity';
import { StorageService } from '../../storage/storage.service';
import { placementSpec, ratioLabel, type AdPlacementSpec } from '../../ads/ad-placement-specs';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

const RATIO_TOLERANCE = 0.02; // ±2%

// Mirror of the CRM AdForm accept list — bad files fail fast here with a
// clear 400 instead of dying later at upload/finalize time.
const ALLOWED_UPLOAD_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class AdminAdsService {
  constructor(
    @InjectRepository(Ad) private readonly adRepository: Repository<Ad>,
    private readonly storageService: StorageService,
  ) {}

  private async publicTempUrl(key: string): Promise<string> {
    // Temp keys were just minted by generatePresignedUrl, so they are readable
    // at the public base during finalize.
    return this.storageService.generateReadUrl(key);
  }

  private async assertRatio(key: string, slot: 'desktop' | 'mobile', spec: AdPlacementSpec): Promise<void> {
    const slotSpec = slot === 'desktop' ? spec.desktop : spec.mobile;
    if (!slotSpec) throw new BadRequestException('This placement does not take a mobile image');
    const expected = slotSpec.ratio[0] / slotSpec.ratio[1];
    const label = ratioLabel(slotSpec.ratio);
    const { width, height } = await this.storageService.getImageDimensions(
      await this.publicTempUrl(key),
    );
    if (Math.abs(width / height - expected) / expected > RATIO_TOLERANCE) {
      throw new BadRequestException(
        `${slot} image must be ${label} (got ${width}x${height})`,
      );
    }
  }

  // Ratios are checked up front by validateUploads, so this only processes.
  private async finalize(key: string | undefined, slot: 'desktop' | 'mobile', spec: AdPlacementSpec): Promise<string> {
    if (!key) throw new BadRequestException(`${slot} image is required`);
    if (!this.isTempKey(key)) return key; // already finalized (edit without re-upload)
    const bounds = slot === 'desktop' ? spec.desktop.bounds : spec.mobile?.bounds;
    return this.storageService.processAdImage(key, slot, bounds);
  }

  private normalizeAudience(audience: string | null | undefined, spec: AdPlacementSpec): string | null {
    if (!audience) return null;
    if (!spec.audiences.includes(audience)) {
      throw new BadRequestException(
        spec.audiences.length
          ? `audience must be one of: ${spec.audiences.join(', ')} (or empty for all)`
          : 'This placement does not support audience targeting',
      );
    }
    return audience;
  }

  // Validate every freshly-uploaded image BEFORE finalizing any, so a failure
  // on one cannot strand an already-finalized sibling. On failure the temp
  // objects are deleted best-effort.
  private async validateUploads(dto: { desktopImageKey?: string; mobileImageKey?: string | null }, spec: AdPlacementSpec) {
    try {
      if (this.isTempKey(dto.desktopImageKey)) await this.assertRatio(dto.desktopImageKey as string, 'desktop', spec);
      if (dto.mobileImageKey && this.isTempKey(dto.mobileImageKey)) {
        await this.assertRatio(dto.mobileImageKey, 'mobile', spec);
      }
    } catch (err) {
      await this.cleanupTempKeys([dto.desktopImageKey, dto.mobileImageKey ?? undefined]);
      throw err;
    }
  }

  private toAdminView(ad: Ad) {
    return {
      ...ad,
      desktopImage: ad.desktopImageKey ? this.storageService.generateReadUrl(ad.desktopImageKey) : null,
      mobileImage: ad.mobileImageKey ? this.storageService.generateReadUrl(ad.mobileImageKey) : null,
    };
  }

  async list(placement: AdPlacement = AdPlacement.Hero) {
    const [items, total] = await this.adRepository.findAndCount({
      where: { placement },
      order: { sortOrder: 'ASC', id: 'DESC' },
    });
    return { items: items.map((ad) => this.toAdminView(ad)), total };
  }

  async details(id: number) {
    const ad = await this.adRepository.findOne({ where: { id } });
    if (!ad) throw new NotFoundException(`Ad #${id} not found`);
    return this.toAdminView(ad);
  }

  private async findEntity(id: number): Promise<Ad> {
    const ad = await this.adRepository.findOne({ where: { id } });
    if (!ad) throw new NotFoundException(`Ad #${id} not found`);
    return ad;
  }

  private isTempKey(key: string | undefined): boolean {
    return !!key && (key.includes('uploads/temp/') || key.includes('local/temp/'));
  }

  private async cleanupTempKeys(keys: Array<string | undefined>): Promise<void> {
    for (const key of keys) {
      if (this.isTempKey(key)) {
        try {
          await this.storageService.deleteFile(key as string);
        } catch {
          // best-effort: temp cleanup must never mask the validation error
        }
      }
    }
  }

  private async deleteFinalKey(key: string | null | undefined): Promise<void> {
    if (!key) return;
    try {
      await this.storageService.deleteFile(key);
    } catch {
      // best-effort: R2 cleanup must never fail the admin operation
    }
  }

  async create(dto: CreateAdDto, createdBy?: string) {
    const placement = dto.placement ?? AdPlacement.Hero;
    const spec = placementSpec(placement);
    const audience = this.normalizeAudience(dto.audience, spec);
    // A single-image slot ignores any mobile upload; drop the temp object.
    if (!spec.mobile && dto.mobileImageKey) {
      await this.cleanupTempKeys([dto.mobileImageKey]);
      dto.mobileImageKey = undefined;
    }
    if (spec.mobile?.required && !dto.mobileImageKey) {
      await this.cleanupTempKeys([dto.desktopImageKey]);
      throw new BadRequestException('mobile image is required');
    }
    await this.validateUploads(dto, spec);
    const record = this.adRepository.create({
      placement,
      title: dto.title,
      desktopImageKey: await this.finalize(dto.desktopImageKey, 'desktop', spec),
      mobileImageKey: dto.mobileImageKey ? await this.finalize(dto.mobileImageKey, 'mobile', spec) : null,
      audience,
      linkType: dto.linkType ?? AdLinkType.Preset,
      linkPreset: dto.linkPreset ?? null,
      linkCustom: dto.linkCustom ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      createdBy: createdBy ?? null,
    });
    return this.adRepository.save(record);
  }

  async update(id: number, dto: UpdateAdDto) {
    const ad = await this.findEntity(id);
    const placement = dto.placement ?? ad.placement;
    const spec = placementSpec(placement);
    const placementChanged = placement !== ad.placement;
    const fail = async (message: string): Promise<never> => {
      await this.cleanupTempKeys([dto.desktopImageKey, dto.mobileImageKey ?? undefined]);
      throw new BadRequestException(message);
    };
    // Stored images were sized for the old slot — a move needs fresh creatives.
    if (placementChanged && !this.isTempKey(dto.desktopImageKey)) {
      await fail('Upload a new image when changing the placement (each placement has its own size).');
    }
    if (placementChanged && spec.mobile?.required && !this.isTempKey(dto.mobileImageKey ?? undefined)) {
      await fail('Upload a new mobile image when changing the placement.');
    }
    if (spec.mobile?.required && dto.mobileImageKey === null) await fail('mobile image is required');
    if (!spec.mobile && dto.mobileImageKey) {
      await this.cleanupTempKeys([dto.mobileImageKey]);
      dto.mobileImageKey = undefined;
    }
    await this.validateUploads(dto, spec);

    if (dto.desktopImageKey !== undefined) {
      const finalized = await this.finalize(dto.desktopImageKey, 'desktop', spec);
      if (finalized !== ad.desktopImageKey) {
        const oldKey = ad.desktopImageKey;
        ad.desktopImageKey = finalized;
        if (this.isTempKey(dto.desktopImageKey)) await this.deleteFinalKey(oldKey);
      }
    }
    if (!spec.mobile || (placementChanged && !dto.mobileImageKey) || dto.mobileImageKey === null) {
      // Slot has no mobile image, an old-size one would be wrong, or it was cleared.
      await this.deleteFinalKey(ad.mobileImageKey);
      ad.mobileImageKey = null;
    } else if (dto.mobileImageKey !== undefined) {
      const finalized = await this.finalize(dto.mobileImageKey, 'mobile', spec);
      if (finalized !== ad.mobileImageKey) {
        const oldKey = ad.mobileImageKey;
        ad.mobileImageKey = finalized;
        if (this.isTempKey(dto.mobileImageKey)) await this.deleteFinalKey(oldKey);
      }
    }
    if (dto.audience !== undefined || placementChanged) {
      ad.audience = this.normalizeAudience(dto.audience !== undefined ? dto.audience : ad.audience, spec);
    }
    if (dto.title !== undefined) ad.title = dto.title;
    if (dto.linkType !== undefined) ad.linkType = dto.linkType;
    if (dto.linkPreset !== undefined) ad.linkPreset = dto.linkPreset ?? null;
    if (dto.linkCustom !== undefined) ad.linkCustom = dto.linkCustom ?? null;
    if (dto.sortOrder !== undefined) ad.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) ad.isActive = dto.isActive;
    ad.placement = placement;
    return this.adRepository.save(ad);
  }

  async updateStatus(id: number, isActive: boolean) {
    const ad = await this.findEntity(id);
    ad.isActive = isActive;
    return this.adRepository.save(ad);
  }

  async remove(id: number) {
    const ad = await this.findEntity(id);
    await this.adRepository.delete(id);
    await this.deleteFinalKey(ad.desktopImageKey);
    await this.deleteFinalKey(ad.mobileImageKey);
    return { id: ad.id, deleted: true };
  }

  async reorder(ids: number[]) {
    const ads = await this.adRepository.find({ where: ids.map((id) => ({ id })) } as any);
    const byId = new Map(ads.map((a) => [a.id, a]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) throw new NotFoundException(`Ads not found: ${missing.join(',')}`);
    const saved: Ad[] = [];
    for (let i = 0; i < ids.length; i++) {
      const ad = byId.get(ids[i])!;
      ad.sortOrder = i;
      saved.push(await this.adRepository.save(ad));
    }
    return saved;
  }

  presignedUrl(fileName: string, fileType: string) {
    if (!fileName?.trim() || !fileType?.trim()) {
      throw new BadRequestException('fileName and fileType are required');
    }
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(fileType)) {
      throw new BadRequestException(
        `fileType must be one of: ${[...ALLOWED_UPLOAD_MIME_TYPES].join(', ')}`,
      );
    }
    return this.storageService.generatePresignedUrl(fileName, fileType);
  }
}
