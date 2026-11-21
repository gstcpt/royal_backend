import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Atelier Fonte & Cuivre S.A.', description: 'Nom de la société fournisseur' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'SUP-FONTE-01', description: 'Code fournisseur unique' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'commercial@fournisseur.tn' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+216 71 888 999' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Zone Industrielle Megrine' })
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

  @ApiPropertyOptional({ example: 'MF1234567/A' })
  @IsString()
  @IsOptional()
  taxId?: string;

  @ApiPropertyOptional({ example: 'COMPANY', enum: ['COMPANY', 'INDIVIDUAL'], default: 'COMPANY' })
  @IsString()
  @IsOptional()
  supplierType?: 'COMPANY' | 'INDIVIDUAL' = 'COMPANY';

  @ApiPropertyOptional({ example: '08123456', description: 'N° CIN si personne physique / particulier' })
  @IsString()
  @IsOptional()
  cin?: string;

  @ApiPropertyOptional({ example: 'Mohamed Salah (Gérant)', description: 'Contact représentant légal' })
  @IsString()
  @IsOptional()
  contactPerson?: string;

  @ApiPropertyOptional({ example: 30, description: 'Conditions de paiement en jours' })
  @IsInt()
  @Min(0)
  @IsOptional()
  paymentTerms?: number;

  @ApiPropertyOptional({ example: 7, description: 'Délai de livraison moyen en jours (de la commande à la réception)' })
  @IsInt()
  @Min(0)
  @IsOptional()
  leadTimeDays?: number = 7;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
