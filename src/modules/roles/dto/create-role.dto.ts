import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'MARKETING_MANAGER', description: 'Nom technique en majuscules' })
  @IsString()
  @Matches(/^[A-Z0-9_]+$/, { message: 'Le nom du rôle doit être en MAJUSCULES (ex: MARKETING_MANAGER)' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Responsable Marketing', description: 'Nom d’affichage convivial' })
  @IsString()
  @MinLength(2)
  @IsNotEmpty()
  displayName: string;

  @ApiPropertyOptional({ example: 'Gère les promotions, coupons et bannières' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: ['cuid_perm_1', 'cuid_perm_2'], description: 'IDs des permissions à associer' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissionIds?: string[];
}
