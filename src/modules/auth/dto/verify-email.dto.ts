import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'client@royal.com.tn' })
  @IsEmail({}, { message: 'Format email invalide' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '482915' })
  @IsString()
  @Length(6, 6, { message: 'Le code de vérification doit contenir exactement 6 chiffres.' })
  code: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'client@royal.com.tn' })
  @IsEmail({}, { message: 'Format email invalide' })
  @IsNotEmpty()
  email: string;
}
