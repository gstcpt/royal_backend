import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StockTransferStatus } from '@prisma/client';

export class UpdateStockTransferDto {
  @ApiPropertyOptional({ enum: StockTransferStatus })
  @IsEnum(StockTransferStatus)
  @IsOptional()
  status?: StockTransferStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
