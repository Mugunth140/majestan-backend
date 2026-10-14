import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export const PROJECT_ENQUIRY_INTENTS = ['enquiry', 'site_visit'] as const;
export type ProjectEnquiryIntent = (typeof PROJECT_ENQUIRY_INTENTS)[number];

export class CreateProjectEnquiryDto {
  @IsInt()
  @Min(1)
  projectId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  projectCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  slug?: string;

  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsString()
  @MaxLength(32)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsIn([...PROJECT_ENQUIRY_INTENTS])
  intent!: ProjectEnquiryIntent;

  /** Calendar date YYYY-MM-DD. Past-date and slot-required-when-visit rules live in the service. */
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  visitSlot?: string;
}
