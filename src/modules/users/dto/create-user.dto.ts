import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsArray,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Jean' })
  @IsString()
  @MinLength(2)
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString()
  @MinLength(2)
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'jean.dupont@royal.com.tn' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Secr3tPassword2026!' })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ example: '+216 20 123 456' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: ['cuid_of_role'], description: 'IDs des rôles à assigner' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roleIds?: string[];

  @ApiPropertyOptional({ description: 'ID de l’entrepôt assigné (pour Stock Manager)' })
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'ID du point de vente assigné (pour Cashier)' })
  @IsString()
  @IsOptional()
  posId?: string;
}
