import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAdDto } from './update-ad.dto';

async function errorsFor(payload: any) {
  return validate(plainToInstance(UpdateAdDto, payload), { whitelist: true });
}

describe('UpdateAdDto', () => {
  it('validates a PATCH-style title-only payload clean', async () => {
    expect(await errorsFor({ title: 'New title' })).toEqual([]);
  });

  it('rejects a protocol-relative custom link', async () => {
    const errors = await errorsFor({ linkType: 'custom', linkCustom: '//evil.example/phish' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts an internal custom path', async () => {
    expect(await errorsFor({ linkType: 'custom', linkCustom: '/rent' })).toEqual([]);
  });
});
