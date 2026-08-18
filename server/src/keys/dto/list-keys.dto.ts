import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListKeysDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by script ID' })
  @IsOptional()
  @IsString()
  scriptId?: string;
}
