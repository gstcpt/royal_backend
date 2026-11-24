import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateContactDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  subject: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  message: string;
}

export class UpdateContactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  replyContent?: string;
}

export class UpsertFaqDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty()
  @IsString()
  question: string;

  @ApiProperty()
  @IsString()
  answer: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCmsPageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty()
  @IsString()
  content: string;
}

export class UpdateShippingConfigDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  freeShippingThreshold: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  standardShippingFee?: number;
}

export class SubscribeNewsletterDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;
}

export class CreateProductReviewDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rating: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  authorEmail?: string;
}

export class UpdateMyProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  shippingAddress?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  billingAddress?: Record<string, any>;
}

export class ModerateReviewDto {
  @ApiProperty()
  @IsString()
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
}

export class ToggleWishlistDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional({ enum: ['ADD', 'REMOVE', 'TOGGLE'] })
  @IsOptional()
  @IsString()
  @IsIn(['ADD', 'REMOVE', 'TOGGLE'])
  action?: 'ADD' | 'REMOVE' | 'TOGGLE';
}

export class ToggleReactionDto {
  @ApiProperty({ enum: ['LIKE', 'DISLIKE'] })
  @IsString()
  @IsIn(['LIKE', 'DISLIKE'])
  reaction: 'LIKE' | 'DISLIKE';

  @ApiProperty()
  @IsString()
  productId: string;
}

export class CreateSupportMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  threadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  message: string;
}

export class ReplySupportThreadDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  message: string;
}

export class UpdateSupportStatusDto {
  @ApiProperty({ enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED'] })
  @IsString()
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED'])
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
}

export class UpdateCmsIdentityDto {
  @ApiPropertyOptional() @IsOptional() @IsString() appName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() companyName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rcNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() slogan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() faviconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() whatsapp?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() instagram?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() facebook?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tiktok?: string;
  @ApiPropertyOptional() @IsOptional() showrooms?: any[];
}

export class UpdateCmsLayoutDto {
  @ApiPropertyOptional() @IsOptional() @IsObject() theme?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsObject() header?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsObject() footer?: Record<string, any>;
}

export class UpdateCmsViewsDto {
  @ApiPropertyOptional() @IsOptional() @IsObject() views?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsArray() heroSlides?: any[];
}

export class UpsertCuratedTestimonialDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateLabel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatar?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() stars?: number;
  @ApiProperty() @IsString() comment: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpsertEmailTemplateDto {
  @ApiProperty() @IsString() category: 'auth' | 'campaign' | 'messages' | 'orders';
  @ApiProperty() @IsString() key: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() subject: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subjectAr?: string;
  @ApiProperty() @IsString() bodyHtml: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bodyHtmlAr?: string;
  @ApiPropertyOptional() @IsOptional() variables?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpsertShowroomDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() address: string;
  @ApiProperty() @IsString() city: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ReorderFaqDto {
  @ApiProperty({ type: [String] })
  orderedIds: string[];
}

export class UpdateSysConfigDto {
  @ApiProperty()
  @Allow()
  value: any;
}

export class ApplyStockLifecycleDto {
  @ApiProperty({ enum: ['BS', 'BL', 'FACT', 'BE', 'BR', 'RET', 'INV', 'TRF'] })
  @IsIn(['BS', 'BL', 'FACT', 'BE', 'BR', 'RET', 'INV', 'TRF'])
  docType: 'BS' | 'BL' | 'FACT' | 'BE' | 'BR' | 'RET' | 'INV' | 'TRF';

  @ApiProperty()
  @IsString()
  docReference: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  restore?: boolean;

  @ApiProperty()
  @IsArray()
  items: Array<{ variantId?: string; sku?: string; quantity: number }>;
}

export class SmtpTestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() host?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() port?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() user?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() to?: string;
}

export class TestMediaStorageDto {
  @ApiPropertyOptional() @IsOptional() @IsObject() config?: Record<string, any>;
}

export class FlouciInitDto {
  @ApiProperty() @IsString() orderReference: string;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0.1) amountTnd: number;
  @ApiPropertyOptional() @IsOptional() @IsString() successUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() failUrl?: string;
}

export class SendDeliveryDocumentsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() sendInvoice?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() sendDeliverySlip?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() customEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customNote?: string;
}

export class AiGenerateDto {
  @ApiProperty({
    enum: ['PRODUCT_COPY', 'ANALYTICS_INSIGHT', 'SECTION_RECAP', 'FORM_AUTOFILL', 'TEST'],
  })
  @IsIn(['PRODUCT_COPY', 'ANALYTICS_INSIGHT', 'SECTION_RECAP', 'FORM_AUTOFILL', 'TEST'])
  mode: 'PRODUCT_COPY' | 'ANALYTICS_INSIGHT' | 'SECTION_RECAP' | 'FORM_AUTOFILL' | 'TEST';

  @ApiPropertyOptional() @IsOptional() @IsObject() payload?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsObject() overrideConfig?: Record<string, any>;
}

export class CarrierWebhookDto {
  @ApiPropertyOptional() @IsOptional() @IsString() trackingNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() orderReference?: string;
  @ApiProperty() @IsString() status: string;
  @ApiPropertyOptional() @IsOptional() @IsString() secret?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() codCollected?: boolean;
}

export class TrackTelemetryDto {
  @ApiProperty() @IsString() sessionHash: string;

  @ApiProperty({
    enum: ['PAGE_VIEW', 'PAGE_LEAVE', 'PRODUCT_VIEW', 'ADD_TO_CART', 'BEGIN_CHECKOUT', 'PURCHASE'],
  })
  @IsIn(['PAGE_VIEW', 'PAGE_LEAVE', 'PRODUCT_VIEW', 'ADD_TO_CART', 'BEGIN_CHECKOUT', 'PURCHASE'])
  eventType:
    | 'PAGE_VIEW'
    | 'PAGE_LEAVE'
    | 'PRODUCT_VIEW'
    | 'ADD_TO_CART'
    | 'BEGIN_CHECKOUT'
    | 'PURCHASE';

  @ApiPropertyOptional() @IsOptional() @IsString() pagePath?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pageTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() referrer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() utmSource?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() utmMedium?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() utmCampaign?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deviceType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() browserFamily?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) durationSeconds?: number;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, any>;
}
