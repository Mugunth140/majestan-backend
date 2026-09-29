// site/majestan-backend/src/modules/sms/sms.module.spec.ts
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import smsConfig from '../../config/sms.config';
import { Pay4SmsProvider } from './pay4sms.provider';
import { SmsModule } from './sms.module';
import { SmsService } from './sms.service';

describe('SmsModule DI', () => {
  it('resolves Pay4SmsProvider and SmsService via Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, load: [smsConfig] }),
        SmsModule,
      ],
    }).compile();

    expect(moduleRef.get(Pay4SmsProvider)).toBeDefined();
    expect(moduleRef.get(SmsService)).toBeDefined();

    await moduleRef.close();
  });
});
