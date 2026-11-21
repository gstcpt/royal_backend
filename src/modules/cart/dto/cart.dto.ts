import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddToCartDto {
  @ApiPropertyOptional({ description: 'Identifiant du produit', example: 'prod_123' })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ description: 'Identifiant de la variante (si applicable)' })
  @IsString()
  @IsOptional()
  variantId?: string;

  @ApiProperty({ description: 'Quantité à ajouter', default: 1 })
  @IsInt()
  @Min(1)
  quantity: number = 1;
}

export class UpdateCartItemDto {
  @ApiProperty({ description: 'Nouvelle quantité', example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}
