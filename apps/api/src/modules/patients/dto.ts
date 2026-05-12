import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsDateString, IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BloodGroup, Gender, Genotype, PermissionScope, RelationshipType } from '@kincare/db';

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

/**
 * Admin-driven patient account creation. Issued by HOSPITAL_ADMIN / SUPER_ADMIN
 * to onboard a patient without self-registration. If `password` is omitted, the
 * configured `PATIENT_DEFAULT_PASSWORD` is used. The plaintext password used is
 * returned in the response so the admin can deliver it out-of-band; the patient
 * should rotate it on first login.
 */
export class CreatePatientDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) firstName!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) lastName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateOfBirth?: string;
  @ApiPropertyOptional({ enum: Gender }) @IsOptional() @IsEnum(Gender) gender?: Gender;

  /** Optional explicit initial password; otherwise falls back to PATIENT_DEFAULT_PASSWORD. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @Matches(/[A-Z]/, { message: 'Password must contain an uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must contain a lowercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain a digit' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain a symbol' })
  password?: string;

  /** Optional family delegate to provision and link at the same time. */
  @ApiPropertyOptional({ type: () => CreatePatientDelegateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePatientDelegateDto)
  delegate?: CreatePatientDelegateDto;
}

/**
 * Family delegate provisioning sub-DTO. Either links to an existing user with
 * the given email (within the admin's tenant) or creates a new FAMILY_DELEGATE
 * user. The delegate receives the listed permission scopes against the new
 * patient via a `FamilyRelationship` + `PermissionGrant`s — bypassing the
 * normal invite flow because the admin acts as the authoritative grantor.
 */
export class CreatePatientDelegateDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) firstName!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) lastName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @ApiProperty({ enum: RelationshipType }) @IsEnum(RelationshipType) relation!: RelationshipType;
  @ApiProperty({ enum: PermissionScope, isArray: true })
  @IsArray() @ArrayNotEmpty() @IsEnum(PermissionScope, { each: true })
  scopes!: PermissionScope[];

  /** Optional explicit password; otherwise falls back to PATIENT_DEFAULT_PASSWORD. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @Matches(/[A-Z]/, { message: 'Password must contain an uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must contain a lowercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain a digit' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain a symbol' })
  password?: string;
}
