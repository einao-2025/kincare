import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { Roles, type Role } from '@kincare/shared';

export class RegisterDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) firstName!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) lastName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @Matches(/[A-Z]/, { message: 'Password must contain an uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must contain a lowercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain a digit' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain a symbol' })
  password!: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;

  /** Self-registration is restricted to PATIENT; staff are provisioned by admin. */
  @ApiProperty({ enum: [Roles.PATIENT], default: Roles.PATIENT, required: false })
  @IsOptional() @IsEnum([Roles.PATIENT]) role?: Role;
}

export class LoginDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() password!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() mfaCode?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() deviceLabel?: string;
}

export class RefreshDto {
  @ApiProperty() @IsString() refreshToken!: string;
}

export class MfaEnableConfirmDto {
  @ApiProperty() @IsString() code!: string;
}

export class PasswordResetRequestDto {
  @ApiProperty() @IsEmail() email!: string;
}

export class PasswordResetConfirmDto {
  @ApiProperty() @IsString() token!: string;
  @ApiProperty() @IsString() @MinLength(12) newPassword!: string;
}
