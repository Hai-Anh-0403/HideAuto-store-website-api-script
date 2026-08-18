import { ApiProperty } from '@nestjs/swagger';

export class PageDto<T> {
  @ApiProperty()
  items: T[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  skip: number;

  @ApiProperty()
  limit: number;

  constructor(items: T[], total: number, skip: number, limit: number) {
    this.items = items;
    this.total = total;
    this.skip = skip;
    this.limit = limit;
  }
}
