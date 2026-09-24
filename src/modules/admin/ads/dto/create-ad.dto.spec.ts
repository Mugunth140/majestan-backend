import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAdDto } from './create-ad.dto';

async function errorsFor(payload: any) {
  return validate(plainToInstance(CreateAdDto, payload), { whitelist: true });
}

describe('CreateAdDto', () => {
  it('accepts a full hero banner payload', async () => {
    const errors = await errorsFor({
      title: 'Diwali Offer',
      desktopImageKey: 'uploads/temp/1-a.png',
      mobileImageKey: 'uploads/temp/1-b.png',
      linkType: 'preset',
      linkPreset: 'buy-apartments',
      sortOrder: 0,
      isActive: true,
    });
    expect(errors).toEqual([]);
  });

  it('rejects a custom link that escapes the site', async () => {
    const errors = await errorsFor({
      title: 'X',
      desktopImageKey: 'uploads/temp/1-a.png',
      mobileImageKey: 'uploads/temp/1-b.png',
      linkType: 'custom',
      linkCustom: 'https://evil.example/phish',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects preset type without a preset key', async () => {
    const errors = await errorsFor({
      title: 'X',
      desktopImageKey: 'uploads/temp/1-a.png',
      mobileImageKey: 'uploads/temp/1-b.png',
      linkType: 'preset',
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
