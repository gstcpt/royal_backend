import { IsOptional, IsString } from 'class-validator';

export class CreateAuditLogDto {
  @IsString()
  @IsOptional()
  actorId?: string;

  @IsString()
  @IsOptional()
  actorEmail?: string;

  @IsString()
  @IsOptional()
  actorName?: string;

  @IsString()
  action: string;

  @IsString()
  resourceType: string;

  @IsString()
  @IsOptional()
  resourceId?: string;

  @IsString()
  @IsOptional()
  tableName?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  before?: any;

  @IsOptional()
  after?: any;

  @IsOptional()
  diffJson?: any;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;
}
