import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderChannel, OrderStatus } from '@royal/shared-types';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryOrdersDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: OrderChannel })
  @IsEnum(OrderChannel)
  @IsOptional()
  channel?: OrderChannel;

  @ApiPropertyOptional({ description: 'Recherche par numéro de commande, nom, email ou téléphone' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Date de début (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Date de fin (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filtrer par identifiant client' })
  @IsString()
  @IsOptional()
  customerId?: string;
}
