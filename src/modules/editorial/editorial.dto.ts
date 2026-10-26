import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class SavePostDto {
  @IsString() @MinLength(1) @MaxLength(255) title!: string;
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(180)
  slug!: string;
  @IsString() @MaxLength(500) excerpt!: string;
  @IsString() @MaxLength(500000) content!: string;
  @IsString() @MinLength(1) @MaxLength(120) author_name!: string;
  @IsString() @MaxLength(100) category!: string;
  @IsString() @MaxLength(2048) cover_image!: string;
  @IsString() @MaxLength(255) cover_alt!: string;
  @IsString() @MaxLength(120) meta_title!: string;
  @IsString() @MaxLength(320) meta_description!: string;
  @IsString() @MaxLength(2048) social_image!: string;
  @IsBoolean() noindex!: boolean;
  @IsIn(['draft', 'published']) status!: 'draft' | 'published';
  @IsOptional() @IsISO8601() published_at?: string | null;
  @IsOptional() @IsInt() @Min(1) revision?: number;
}

/** Content managed in CRM. SEO and publication timestamps have separate ownership. */
export class SaveBlogContentDto {
  @IsString() @MinLength(1) @MaxLength(255) title!: string;
  @IsString() @MaxLength(500) excerpt!: string;
  @IsString() @MaxLength(500000) content!: string;
  @IsString() @MaxLength(100) category!: string;
  @IsString() @MaxLength(2048) cover_image!: string;
  @IsString() @MaxLength(255) cover_alt!: string;
  @IsIn(['draft', 'published']) status!: 'draft' | 'published';
  @IsOptional() @IsString() @MaxLength(120) author_name?: string;
  @IsOptional() @IsInt() @Min(1) revision?: number;
}
export class SaveBlogSeoDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(180)
  slug!: string;
  @IsString() @MaxLength(120) meta_title!: string;
  @IsString() @MaxLength(320) meta_description!: string;
  @IsString() @MaxLength(2048) social_image!: string;
  @IsBoolean() noindex!: boolean;
  @IsInt() @Min(1) revision!: number;
}
