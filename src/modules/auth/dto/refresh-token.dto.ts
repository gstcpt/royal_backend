import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Jeton de rafraîchissement (refresh token)' })
  @IsString({ message: 'Le refresh token doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le refresh token est requis' })
  refreshToken: string;
}
