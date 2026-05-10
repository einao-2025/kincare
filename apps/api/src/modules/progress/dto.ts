import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export enum ProgressCategory {
  ADMISSION = 'ADMISSION',
  PROCEDURE_COMPLETED = 'PROCEDURE_COMPLETED',
  DISCHARGE = 'DISCHARGE',
  STATUS = 'STATUS',
}

export class CreateProgressUpdateDto {
  @ApiProperty() @IsUUID() patientId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() encounterId?: string;
  @ApiProperty({ enum: ProgressCategory }) @IsEnum(ProgressCategory) category!: ProgressCategory;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(140) title!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(2000) message!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notifyFamily?: boolean;
}
