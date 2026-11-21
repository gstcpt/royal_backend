import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({ example: ['cuid_perm_1', 'cuid_perm_2'], description: 'Liste des IDs de permissions à affecter au rôle' })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  permissionIds: string[];
}
