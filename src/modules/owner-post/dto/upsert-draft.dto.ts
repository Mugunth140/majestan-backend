import { IsObject } from 'class-validator';

export class UpsertDraftDto {
  @IsObject()
  payload!: Record<string, unknown>;
}
