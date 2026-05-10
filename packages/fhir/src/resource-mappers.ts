import type {
  FHIRBundle, FHIRPatient, FHIRResourceBase, FHIRReference,
} from './types';

// ── Discriminated FHIR resource shapes used by Bundle export ────

export interface FHIREncounter extends FHIRResourceBase<'Encounter'> {
  status: string;
  class?: { system?: string; code?: string };
  subject: FHIRReference;
  period?: { start?: string; end?: string };
  location?: { location: { display?: string } }[];
}

export interface FHIRObservation extends FHIRResourceBase<'Observation'> {
  status: string;
  category?: { coding: { code: string }[] }[];
  code: { coding?: { system?: string; code?: string; display?: string }[]; text?: string };
  subject: FHIRReference;
  effectiveDateTime?: string;
  valueQuantity?: { value: number; unit?: string };
  valueString?: string;
}

export interface FHIRCondition extends FHIRResourceBase<'Condition'> {
  clinicalStatus?: { coding: { code: string }[] };
  code: { coding?: { system?: string; code?: string }[]; text?: string };
  subject: FHIRReference;
  onsetDateTime?: string;
}

export interface FHIRMedicationRequest extends FHIRResourceBase<'MedicationRequest'> {
  status: string;
  intent: 'order';
  medicationCodeableConcept: { coding?: { system?: string; code?: string; display?: string }[]; text?: string };
  subject: FHIRReference;
  authoredOn?: string;
  dispenseRequest?: { quantity?: { value: number }; numberOfRepeatsAllowed?: number };
}

export interface FHIRAllergyIntolerance extends FHIRResourceBase<'AllergyIntolerance'> {
  patient: FHIRReference;
  code: { text: string };
  reaction?: { manifestation: { text: string }[]; severity?: string }[];
  recordedDate?: string;
}

export interface FHIRDiagnosticReport extends FHIRResourceBase<'DiagnosticReport'> {
  status: string;
  code: { text: string; coding?: { code?: string }[] };
  subject: FHIRReference;
  issued?: string;
  conclusion?: string;
}

// ── Mappers (Prisma row → FHIR resource) ────────────────────────

const ref = (type: string, id: string): FHIRReference => ({ reference: `${type}/${id}` });

export function encounterToFhir(e: any, patientId: string): FHIREncounter {
  return {
    resourceType: 'Encounter',
    id: e.id,
    status: e.status.toLowerCase().replace('_', '-'),
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: e.class },
    subject: ref('Patient', patientId),
    period: { start: e.startAt?.toISOString?.(), end: e.endAt?.toISOString?.() ?? undefined },
    location: e.location ? [{ location: { display: e.location } }] : undefined,
  };
}

export function observationToFhir(o: any, patientId: string): FHIRObservation {
  return {
    resourceType: 'Observation',
    id: o.id,
    status: o.status,
    category: o.category ? [{ coding: [{ code: o.category }] }] : undefined,
    code: { coding: [{ system: 'http://loinc.org', code: o.code, display: o.display }], text: o.display },
    subject: ref('Patient', patientId),
    effectiveDateTime: o.effectiveAt?.toISOString?.(),
    valueQuantity: o.valueNumeric != null ? { value: Number(o.valueNumeric), unit: o.unit ?? undefined } : undefined,
    valueString: o.valueString ?? undefined,
  };
}

export function conditionToFhir(c: any, patientId: string): FHIRCondition {
  return {
    resourceType: 'Condition',
    id: c.id,
    clinicalStatus: { coding: [{ code: c.clinicalStatus }] },
    code: { coding: [{ system: 'http://snomed.info/sct', code: c.code }], text: c.display },
    subject: ref('Patient', patientId),
    onsetDateTime: c.onsetDate?.toISOString?.(),
  };
}

export function prescriptionToFhir(p: any, patientId: string): FHIRMedicationRequest {
  return {
    resourceType: 'MedicationRequest',
    id: p.id,
    status: p.status.toLowerCase(),
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: p.medicationCode, display: p.medicationName }],
      text: p.medicationName,
    },
    subject: ref('Patient', patientId),
    authoredOn: p.prescribedAt?.toISOString?.(),
    dispenseRequest: { quantity: { value: p.quantity }, numberOfRepeatsAllowed: p.refillsAllowed },
  };
}

export function allergyToFhir(a: any, patientId: string): FHIRAllergyIntolerance {
  return {
    resourceType: 'AllergyIntolerance',
    id: a.id,
    patient: ref('Patient', patientId),
    code: { text: a.substance },
    reaction: a.reaction ? [{ manifestation: [{ text: a.reaction }], severity: a.severity ?? undefined }] : undefined,
    recordedDate: a.recordedAt?.toISOString?.(),
  };
}

export function diagnosticReportToFhir(r: any, patientId: string): FHIRDiagnosticReport {
  return {
    resourceType: 'DiagnosticReport',
    id: r.id,
    status: r.status.toLowerCase(),
    code: { text: r.display, coding: [{ code: r.code }] },
    subject: ref('Patient', patientId),
    issued: r.issuedAt?.toISOString?.(),
    conclusion: r.conclusion ?? undefined,
  };
}

export function makeBundle(entries: { resource: FHIRResourceBase }[]): FHIRBundle {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: entries.length,
    entry: entries.map((e) => ({
      fullUrl: `${e.resource.resourceType}/${e.resource.id}`,
      resource: e.resource,
    })),
  };
}
