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

/** Hourly visit start-times (IST wall-clock). Mirrored in site frontend src/lib/visit-slots.ts. */
export const VISIT_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
] as const;

export const PROPERTY_ENQUIRY_INTENTS = ['enquiry', 'site_visit'] as const;
export type PropertyEnquiryIntent = (typeof PROPERTY_ENQUIRY_INTENTS)[number];

export class CreatePropertyEnquiryDto {
  @IsInt()
  @Min(1)
  propertyId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  propertyCode?: string;

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

  @IsIn([...PROPERTY_ENQUIRY_INTENTS])
  intent!: PropertyEnquiryIntent;

  /** Calendar date YYYY-MM-DD. Past-date and slot-required-when-visit rules live in the service. */
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  visitSlot?: string;
}
