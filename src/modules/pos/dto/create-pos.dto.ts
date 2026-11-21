import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePointOfSaleDto {
  @ApiProperty({ example: 'Boutique Royal La Marsa', description: 'Nom du point de vente' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'POS-MARSA-01', description: 'Code unique du POS' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'ID de l’entrepôt / réserve associé au point de vente' })
  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @ApiPropertyOptional({ example: 'Avenue Habib Bourguiba, La Marsa' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: '+216 71 777 888' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
