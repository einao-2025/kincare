import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '@kincare/shared';
import { Audit, RequirePermissions } from '../../common/decorators';
import { Hl7Service } from './hl7.service';

/** HTTPS-based HL7 v2 ingestion endpoint (alternative to MLLP). */
@ApiTags('hl7')
@ApiBearerAuth()
@Controller('hl7')
export class Hl7Controller {
  constructor(private readonly hl7: Hl7Service) {}

  @Post('ingest')
  @HttpCode(202)
  @Header('Content-Type', 'application/json')
  @RequirePermissions(Permissions.ADMIN_SYSTEM)
  @Audit({ action: 'CREATE', resourceType: 'HL7Message' })
  ingest(@Body('message') raw: string) {
    return this.hl7.ingest(raw);
  }
}
