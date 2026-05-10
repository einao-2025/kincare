import { Injectable, NotFoundException } from '@nestjs/common';
import {
  allergyToFhir, conditionToFhir, diagnosticReportToFhir, encounterToFhir,
  makeBundle, observationToFhir, prescriptionToFhir, toFHIRPatient,
  type FHIRBundle, type FHIRPatient,
} from '@kincare/fhir';
import { PrismaService } from '../../common/prisma/prisma.module';

@Injectable()
export class FhirService {
  constructor(private readonly prisma: PrismaService) {}

  async getPatient(id: string): Promise<FHIRPatient> {
    const p = await this.prisma.patientProfile.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!p) throw new NotFoundException('Patient not found');
    return toFHIRPatient(p);
  }

  async searchPatients(q: { mrn?: string; family?: string; given?: string }): Promise<FHIRBundle<FHIRPatient>> {
    const rows = await this.prisma.patientProfile.findMany({
      where: {
        deletedAt: null,
        mrn: q.mrn,
        user: q.family || q.given ? {
          lastName: q.family ? { contains: q.family, mode: 'insensitive' } : undefined,
          firstName: q.given ? { contains: q.given, mode: 'insensitive' } : undefined,
        } : undefined,
      },
      include: { user: true },
      take: 50,
    });
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: rows.length,
      entry: rows.map((r) => ({
        fullUrl: `Patient/${r.id}`,
        resource: toFHIRPatient(r),
      })),
    };
  }

  /**
   * Patient/$everything — returns every clinical resource we have for the patient
   * as a FHIR Bundle. Spec: https://www.hl7.org/fhir/operation-patient-everything.html
   */
  async patientEverything(id: string): Promise<FHIRBundle> {
    const p = await this.prisma.patientProfile.findUnique({
      where: { id },
      include: {
        user: true,
        encounters: { where: { deletedAt: null } },
        observations: { where: { deletedAt: null } },
        conditions: { where: { deletedAt: null } },
        allergies: { where: { deletedAt: null } },
        prescriptions: { where: { deletedAt: null } },
        diagnosticReports: { where: { deletedAt: null } },
      },
    });
    if (!p) throw new NotFoundException('Patient not found');

    const entries = [
      { resource: toFHIRPatient(p) },
      ...p.encounters.map((e) => ({ resource: encounterToFhir(e, p.id) })),
      ...p.conditions.map((c) => ({ resource: conditionToFhir(c, p.id) })),
      ...p.allergies.map((a) => ({ resource: allergyToFhir(a, p.id) })),
      ...p.observations.map((o) => ({ resource: observationToFhir(o, p.id) })),
      ...p.prescriptions.map((rx) => ({ resource: prescriptionToFhir(rx, p.id) })),
      ...p.diagnosticReports.map((r) => ({ resource: diagnosticReportToFhir(r, p.id) })),
    ];
    return makeBundle(entries);
  }
}
