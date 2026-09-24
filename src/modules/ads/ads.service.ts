import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ad, AdPlacement } from '../../database/entities/ad.entity';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class AdsService {
  constructor(
    @InjectRepository(Ad) private readonly adRepository: Repository<Ad>,
    private readonly storageService: StorageService,
  ) {}

  async listActive(placement: AdPlacement = AdPlacement.Hero) {
    const ads = await this.adRepository.find({
      where: { placement, isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const items = ads
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((ad) => ({
      id: ad.id,
      title: ad.title,
      desktopImage: this.storageService.generateReadUrl(ad.desktopImageKey),
      mobileImage: this.storageService.generateReadUrl(ad.mobileImageKey),
      linkType: ad.linkType,
      linkPreset: ad.linkPreset,
      linkCustom: ad.linkCustom,
    }));
    return { items, total: items.length };
  }
}
