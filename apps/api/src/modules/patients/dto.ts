import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { BloodGroup, Gender, Genotype, RelationshipType } from '@kincare/db';

export class UpdatePatientProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateOfBirth?: string;
  @ApiPropertyOptional({ enum: Gender }) @IsOptional() @IsEnum(Gender) gender?: Gender;
  @ApiPropertyOptional({ enum: BloodGroup }) @IsOptional() @IsEnum(BloodGroup) bloodGroup?: BloodGroup;
  @ApiPropertyOptional({ enum: Genotype }) @IsOptional() @IsEnum(Genotype) genotype?: Genotype;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) nationalId?: string;
}

export class CreateEmergencyContactDto {
  @ApiProperty() @IsString() @MaxLength(120) name!: string;
  @ApiProperty({ enum: RelationshipType }) @IsEnum(RelationshipType) relation!: RelationshipType;
  @ApiProperty() @IsString() phone!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
}

export class CreateAllergyDto {
  @ApiProperty() @IsString() substance!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reaction?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() severity?: string;
}

export class CreateConditionDto {
  @ApiProperty() @IsString() code!: string;
  @ApiProperty() @IsString() display!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() onsetDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
