import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty({ example: 'Dépôt Central Tunis Lac', description: 'Nom de l’entrepôt' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'DEPOT-CENTRAL', description: 'Code unique de l’entrepôt' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: '12 Rue des Métiers, Z.I. Charguia' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'Tunis' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ default: 'TN' })
  @IsString()
  @IsOptional()
  country?: string = 'TN';

  @ApiPropertyOptional({ example: '+216 71 222 333' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'depot.central@royal.com.tn' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'ID de l’utilisateur responsable' })
  @IsString()
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @ApiPropertyOptional({ default: false, description: 'Est-ce l’entrepôt principal par défaut ?' })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean = false;
}
