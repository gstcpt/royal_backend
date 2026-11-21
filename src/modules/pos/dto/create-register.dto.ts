import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCashRegisterDto {
  @ApiProperty({ description: 'ID du point de vente associé' })
  @IsString()
  @IsNotEmpty()
  posId: string;

  @ApiProperty({ example: 'Caisse Principale 1', description: 'Nom de la caisse enregistreuse' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
