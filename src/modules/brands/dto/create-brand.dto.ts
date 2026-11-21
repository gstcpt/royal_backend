import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ example: 'Le Creuset', description: 'Nom de la marque' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'le-creuset' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'Fabricant français renommé d’ustensiles de cuisine et fonte émaillée' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '/images/brands/le-creuset.svg' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'https://www.lecreuset.fr' })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
