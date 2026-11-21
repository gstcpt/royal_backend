import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@royal/shared-types';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.CONFIRMED })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional({ description: 'Commentaire ou motif du changement d’état' })
  @IsString()
  @IsOptional()
  comment?: string;
}
