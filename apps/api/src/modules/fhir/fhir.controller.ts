import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FhirService } from './fhir.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions } from '../../common/decorators';
import { Permissions } from '@kincare/shared';

/**
 * RESTful FHIR R4 endpoints, mounted at the root (no /api/v1 prefix).
 * Spec: https://www.hl7.org/fhir/http.html
 */
@ApiTags('fhir')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('fhir')
export class FhirController {
  constructor(private readonly fhir: FhirService) {}

  @Get('Patient/:id')
  @RequirePermissions(Permissions.PATIENT_READ_ANY)
  patient(@Param('id') id: string) {
    return this.fhir.getPatient(id);
  }

  @Get('Patient/:id/$everything')
  @RequirePermissions(Permissions.PATIENT_READ_ANY)
  everything(@Param('id') id: string) {
    return this.fhir.patientEverything(id);
  }

  @Get('Patient')
  @RequirePermissions(Permissions.PATIENT_READ_ANY)
  searchPatient(
    @Query('identifier') mrn?: string,
    @Query('family') family?: string,
    @Query('given') given?: string,
  ) {
    return this.fhir.searchPatients({ mrn, family, given });
  }

  @Get('metadata')
  capability() {
    return {
      resourceType: 'CapabilityStatement',
      status: 'active',
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['json'],
      rest: [{
        mode: 'server',
        resource: [
          { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }],
            operation: [{ name: 'everything', definition: 'http://hl7.org/fhir/OperationDefinition/Patient-everything' }] },
          { type: 'Encounter', interaction: [{ code: 'read' }] },
          { type: 'Observation', interaction: [{ code: 'read' }] },
          { type: 'Condition', interaction: [{ code: 'read' }] },
          { type: 'AllergyIntolerance', interaction: [{ code: 'read' }] },
          { type: 'MedicationRequest', interaction: [{ code: 'read' }] },
          { type: 'DiagnosticReport', interaction: [{ code: 'read' }] },
        ],
      }],
    };
  }
}
