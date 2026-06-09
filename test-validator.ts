import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { IsObject } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';

class UpsertRecordDto {
  @IsObject()
  data: Record<string, unknown>;
}

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

async function run() {
  const input = { data: { city_name: 'Coimbatore', is_active: 1 } };
  try {
    const result = await pipe.transform(input, { type: 'body', metatype: UpsertRecordDto });
    console.log("Success:", result);
  } catch(e) {
    console.error("Error:", e.response);
  }
}
run();
