import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListMembersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by user email' })
  @IsOptional()
  @IsString()
  search?: string;
}
