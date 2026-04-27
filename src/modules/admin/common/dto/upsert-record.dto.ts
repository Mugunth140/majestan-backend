import { IsObject } from 'class-validator';

export class UpsertRecordDto {
  @IsObject()
  data!: Record<string, unknown>;
}
