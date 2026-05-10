import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class CreatePrescriptionDto {
  @ApiProperty() @IsUUID() patientId!: string;
  @ApiProperty() @IsString() medicationCode!: string;
  @ApiProperty() @IsString() medicationName!: string;
  @ApiProperty() @IsString() dosage!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() route?: string;
  @ApiProperty() @IsString() frequency!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(365) durationDays?: number;
  @ApiProperty() @IsInt() @Min(1) quantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(12) refillsAllowed?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateRefillRequestDto {
  @ApiProperty() @IsUUID() prescriptionId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class AuthorizePickupDto {
  @ApiProperty() @IsUUID() refillRequestId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() delegateUserId?: string;
}

export class ApproveRefillDto {
  @ApiProperty() @IsUUID() refillRequestId!: string;
}

export class DenyRefillDto {
  @ApiProperty() @IsUUID() refillRequestId!: string;
  @ApiProperty() @IsString() @MinLength(3) reason!: string;
}

export class DispenseDto {
  @ApiProperty() @IsUUID() refillRequestId!: string;
  @ApiProperty() @IsInt() @Min(1) quantityDispensed!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() lotNumber?: string;
}

export class ConfirmPickupDto {
  @ApiProperty() @IsString() pickupCode!: string;
  @ApiProperty() @IsString() pickedUpByName!: string;
  @ApiProperty() @IsString() pickedUpByIdRef!: string;
}
