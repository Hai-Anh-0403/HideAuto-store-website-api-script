import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicTagDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class PublicSellerDto {
  @ApiProperty()
  displayName!: string;
}

export class PublicScriptStatisticsDto {
  @ApiProperty()
  ratingAvg!: number;

  @ApiProperty()
  ratingCount!: number;

  @ApiProperty()
  downloads!: number;

  @ApiProperty()
  views!: number;
}

export class PublicScriptSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  shortDescription!: string;

  @ApiPropertyOptional({ nullable: true })
  thumbnailUrl!: string | null;

  @ApiProperty({ type: () => PublicSellerDto })
  seller!: PublicSellerDto;

  @ApiProperty({ type: () => [PublicTagDto] })
  tags!: PublicTagDto[];

  @ApiProperty()
  latestApprovedVersion!: string;

  @ApiProperty({ example: '$29' })
  price!: string;

  @ApiProperty({ example: 29 })
  priceAmount!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ type: () => PublicScriptStatisticsDto })
  statistics!: PublicScriptStatisticsDto;

  @ApiProperty({ format: 'date-time' })
  publishedAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PublicScriptVersionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  version!: string;

  @ApiPropertyOptional({ nullable: true })
  changelog!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  releasedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class PublicScriptDetailDto extends PublicScriptSummaryDto {
  @ApiPropertyOptional({ nullable: true })
  descriptionHtml!: string | null;

  @ApiProperty({ type: () => [String] })
  galleryUrls!: string[];

  @ApiProperty({ type: () => [String] })
  capabilities!: string[];

  @ApiProperty({ type: () => [PublicScriptVersionDto] })
  versions!: PublicScriptVersionDto[];
}

export class PublicScriptPageDto {
  @ApiProperty({ type: () => [PublicScriptSummaryDto] })
  items!: PublicScriptSummaryDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  skip!: number;

  @ApiProperty()
  limit!: number;
}
