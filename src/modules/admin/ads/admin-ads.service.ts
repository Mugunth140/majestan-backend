// admin-ads.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ad, AdLinkType, AdPlacement } from '../../../database/entities/ad.entity';
import { StorageService } from '../../storage/storage.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

const DESKTOP_RATIO = 32 / 9;
const MOBILE_RATIO = 4 / 5;
const RATIO_TOLERANCE = 0.02; // ±2%

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

  private async assertRatio(key: string, slot: 'desktop' | 'mobile'): Promise<void> {
    const expected = slot === 'desktop' ? DESKTOP_RATIO : MOBILE_RATIO;
    const label = slot === 'desktop' ? '32:9' : '4:5';
    const { width, height } = await this.storageService.getImageDimensions(
      await this.publicTempUrl(key),
    );
    if (Math.abs(width / height - expected) / expected > RATIO_TOLERANCE) {
      throw new BadRequestException(
        `${slot} image must be ${label} (got ${width}x${height})`,
      );
    }
  }

  private async finalize(key: string | undefined, slot: 'desktop' | 'mobile'): Promise<string> {
    if (!key) throw new BadRequestException(`${slot} image is required`);
    if (!key.includes('uploads/temp/')) return key; // already finalized (edit without re-upload)
    await this.assertRatio(key, slot);
    return this.storageService.processAdImage(key, slot);
  }

  async list(placement: AdPlacement = AdPlacement.Hero) {
    const [items, total] = await this.adRepository.findAndCount({
      where: { placement },
      order: { sortOrder: 'ASC', id: 'DESC' },
    });
    return { items, total };
  }

  async details(id: number) {
    const ad = await this.adRepository.findOne({ where: { id } });
    if (!ad) throw new NotFoundException(`Ad #${id} not found`);
    return ad;
  }

  async create(dto: CreateAdDto, createdBy?: string) {
    const record = this.adRepository.create({
      placement: dto.placement ?? AdPlacement.Hero,
      title: dto.title,
      desktopImageKey: await this.finalize(dto.desktopImageKey, 'desktop'),
      mobileImageKey: await this.finalize(dto.mobileImageKey, 'mobile'),
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
    const ad = await this.details(id);
    if (dto.desktopImageKey !== undefined) {
      ad.desktopImageKey = await this.finalize(dto.desktopImageKey, 'desktop');
    }
    if (dto.mobileImageKey !== undefined) {
      ad.mobileImageKey = await this.finalize(dto.mobileImageKey, 'mobile');
    }
    if (dto.title !== undefined) ad.title = dto.title;
    if (dto.linkType !== undefined) ad.linkType = dto.linkType;
    if (dto.linkPreset !== undefined) ad.linkPreset = dto.linkPreset ?? null;
    if (dto.linkCustom !== undefined) ad.linkCustom = dto.linkCustom ?? null;
    if (dto.sortOrder !== undefined) ad.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) ad.isActive = dto.isActive;
    if (dto.placement !== undefined) ad.placement = dto.placement;
    return this.adRepository.save(ad);
  }

  async updateStatus(id: number, isActive: boolean) {
    const ad = await this.details(id);
    ad.isActive = isActive;
    return this.adRepository.save(ad);
  }

  async remove(id: number) {
    const ad = await this.details(id);
    await this.adRepository.delete(id);
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
    return this.storageService.generatePresignedUrl(fileName, fileType);
  }
}
