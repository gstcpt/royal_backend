import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Jean', description: 'Prénom de l’utilisateur' })
  @IsString({ message: 'Le prénom doit être une chaîne de caractères' })
  @MinLength(2, { message: 'Le prénom doit contenir au moins 2 caractères' })
  @IsNotEmpty({ message: 'Le prénom est requis' })
  firstName: string;

  @ApiProperty({ example: 'Dupont', description: 'Nom de famille de l’utilisateur' })
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  @IsNotEmpty({ message: 'Le nom est requis' })
  lastName: string;

  @ApiProperty({ example: 'client@example.com', description: 'Adresse email unique' })
  @IsEmail({}, { message: 'Format email invalide' })
  @IsNotEmpty({ message: 'L’email est requis' })
  email: string;

  @ApiProperty({ example: 'ClientPass2026!', description: 'Mot de passe sécurisé' })
  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  password: string;

  @ApiPropertyOptional({ example: '+216 20 123 456', description: 'Numéro de téléphone' })
  @IsString()
  @IsOptional()
  phone?: string;
}
