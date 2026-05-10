import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TestResultStatus } from '@kincare/db';

export class CreateDiagnosticReportDto {
  @ApiProperty() @IsUUID() patientId!: string;
  @ApiProperty() @IsString() code!: string;
  @ApiProperty() @IsString() display!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() conclusion?: string;
  @ApiPropertyOptional({ enum: TestResultStatus })
  @IsOptional() @IsEnum(TestResultStatus) status?: TestResultStatus;
}

export class CreateTestResultDto {
  @ApiProperty() @IsUUID() patientId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() reportId?: string;
  @ApiProperty() @IsString() testName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() testCode?: string;
  @ApiProperty() @IsString() resultValue!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() referenceRange?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() flag?: string;
  @ApiProperty() @IsDateString() performedAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
