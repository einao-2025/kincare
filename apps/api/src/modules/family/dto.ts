import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { PermissionScope, RelationshipType } from '@kincare/db';

export class InviteDelegateDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiProperty({ enum: RelationshipType }) @IsEnum(RelationshipType) relation!: RelationshipType;
  @ApiProperty({ enum: PermissionScope, isArray: true })
  @IsArray() @ArrayNotEmpty() @IsEnum(PermissionScope, { each: true })
  scopes!: PermissionScope[];
}

export class AcceptInviteDto {
  @ApiProperty() @IsString() token!: string;
}

export class UpdateGrantsDto {
  @ApiProperty({ enum: PermissionScope, isArray: true })
  @IsArray() @IsEnum(PermissionScope, { each: true })
  scopes!: PermissionScope[];
}
