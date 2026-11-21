import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CashMovementType } from '@prisma/client';

export class OpenSessionDto {
  @ApiProperty({ example: 200.0, description: 'Fond de caisse initial en TND' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingBalance: number;

  @ApiPropertyOptional({ example: 'Ouverture de matinée par le chef de caisse' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CloseSessionDto {
  @ApiProperty({ example: 845.5, description: 'Montant réel physique compté en caisse en TND' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  closingBalance: number;

  @ApiPropertyOptional({ example: 'Clôture de soirée après comptage du tiroir-caisse' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CashMovementDto {
  @ApiProperty({ enum: CashMovementType, example: CashMovementType.WITHDRAWAL })
  @IsEnum(CashMovementType)
  type: CashMovementType;

  @ApiProperty({ example: 300.0, description: 'Montant en TND' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount: number;

  @ApiPropertyOptional({ example: 'Prélèvement coffre-fort de sécurité' })
  @IsString()
  @IsOptional()
  description?: string;
}
