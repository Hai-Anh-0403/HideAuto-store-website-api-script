import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicSellerStatisticsDto {
  @ApiProperty() publishedScripts!: number;
  @ApiProperty() downloads!: number;
  @ApiProperty() views!: number;
  @ApiProperty() ratingAvg!: number;
  @ApiProperty() ratingCount!: number;
}

export class PublicMarketplaceSellerDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() verified!: boolean;
  @ApiPropertyOptional({ nullable: true }) avatarUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) headline!: string | null;
  @ApiProperty({ format: 'date-time' }) joinedAt!: string;
  @ApiProperty({ type: () => PublicSellerStatisticsDto }) statistics!: PublicSellerStatisticsDto;
}

export class PublicMarketplaceSellerPageDto {
  @ApiProperty({ type: () => [PublicMarketplaceSellerDto] }) items!: PublicMarketplaceSellerDto[];
  @ApiProperty() total!: number;
  @ApiProperty() skip!: number;
  @ApiProperty() limit!: number;
}
