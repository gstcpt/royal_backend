import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Responsable Marketing Senior' })
  @IsString()
  @MinLength(2)
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ example: 'Gère l’ensemble du marketing et des campagnes' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: ['cuid_perm_1', 'cuid_perm_2'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissionIds?: string[];
}
