import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderChannel, PaymentMethod } from '@royal/shared-types';

export class OrderItemInputDto {
  @ApiProperty({ description: 'Identifiant de la variante de produit', example: 'var_123' })
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({ description: 'Quantité commandée', default: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class AddressInputDto {
  @ApiProperty({ example: 'Amine' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Ben Salem' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '+216 98 123 456' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: '15 Rue des Orangers' })
  @IsString()
  @IsOptional()
  street?: string;

  @ApiPropertyOptional({ example: 'Appartement 4B, Résidence Jasmin' })
  @IsString()
  @IsOptional()
  street2?: string;

  @ApiProperty({ example: 'La Marsa' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Tunis' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiPropertyOptional({ example: '2070' })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'TN', default: 'TN' })
  @IsString()
  @IsOptional()
  country?: string = 'TN';
}

export class GuestInfoDto {
  @ApiPropertyOptional({ example: 'amine.client@royal.com.tn' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'Amine' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Ben Salem' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: '+216 98 123 456' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ description: 'Champs dynamiques configurés par l’administrateur' })
  @IsObject()
  @IsOptional()
  extraFields?: Record<string, any>;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemInputDto], description: 'Articles de la commande' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];

  @ApiPropertyOptional({ type: GuestInfoDto, description: 'Renseignements pour commande invité (sans compte)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => GuestInfoDto)
  guestInfo?: GuestInfoDto;

  @ApiProperty({ type: AddressInputDto, description: 'Adresse de livraison' })
  @ValidateNested()
  @Type(() => AddressInputDto)
  shippingAddress: AddressInputDto;

  @ApiPropertyOptional({ type: AddressInputDto, description: 'Adresse de facturation (si différente)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInputDto)
  billingAddress?: AddressInputDto;

  @ApiProperty({
    enum: PaymentMethod,
    default: PaymentMethod.CASH_ON_DELIVERY,
    example: PaymentMethod.CASH_ON_DELIVERY,
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod = PaymentMethod.CASH_ON_DELIVERY;

  @ApiPropertyOptional({ description: 'Mode de livraison', example: 'STANDARD_HOME' })
  @IsString()
  @IsOptional()
  deliveryMethod?: string = 'STANDARD_HOME';

  @ApiPropertyOptional({ description: 'Code promotionnel appliqué' })
  @IsString()
  @IsOptional()
  couponCode?: string;

  @ApiPropertyOptional({ description: 'Instructions de livraison ou remarques client' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ enum: OrderChannel, default: OrderChannel.ONLINE })
  @IsEnum(OrderChannel)
  @IsOptional()
  channel?: OrderChannel = OrderChannel.ONLINE;

  @ApiPropertyOptional({ description: 'Entrepôt assigné pour l’expédition (par défaut Central)' })
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Type de traitement : DELIVERY ou SHOWROOM_PICKUP', default: 'DELIVERY' })
  @IsString()
  @IsOptional()
  fulfillmentType?: 'DELIVERY' | 'SHOWROOM_PICKUP' = 'DELIVERY';

  @ApiPropertyOptional({ description: 'Identifiant société de livraison choisie au checkout' })
  @IsString()
  @IsOptional()
  deliveryCompanyId?: string;

  @ApiPropertyOptional({ description: 'Identifiant Showroom choisi pour retrait en magasin' })
  @IsString()
  @IsOptional()
  pickupShowroomId?: string;
}
