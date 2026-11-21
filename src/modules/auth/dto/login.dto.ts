import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'root@royal.com.tn', description: 'Adresse email de connexion' })
  @IsEmail({}, { message: 'Format email invalide' })
  @IsNotEmpty({ message: 'L’email est requis' })
  email: string;

  @ApiProperty({ example: 'RootAdmin2026!', description: 'Mot de passe utilisateur' })
  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  password: string;
}
