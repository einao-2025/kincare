/**
 * Minimal HL7 FHIR R4 type aliases — intentionally narrow.
 * For full coverage swap with `@types/fhir` later.
 */
export type FHIRResourceType =
  | 'Patient' | 'Practitioner' | 'RelatedPerson'
  | 'Encounter' | 'Observation' | 'DiagnosticReport'
  | 'Condition' | 'Procedure' | 'AllergyIntolerance'
  | 'MedicationRequest' | 'MedicationDispense'
  | 'CareTeam' | 'Consent' | 'AuditEvent';

export interface FHIRResourceBase<T extends FHIRResourceType = FHIRResourceType> {
  resourceType: T;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
}

export interface FHIRBundle<T = unknown> {
  resourceType: 'Bundle';
  type: 'searchset' | 'collection' | 'transaction' | 'document';
  total?: number;
  entry: { fullUrl?: string; resource: T }[];
}

export interface FHIRHumanName {
  use?: 'usual' | 'official';
  family?: string;
  given?: string[];
}

export interface FHIRCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

export interface FHIRReference {
  reference: string;
  display?: string;
}

export interface FHIRPatient extends FHIRResourceBase<'Patient'> {
  identifier?: { system?: string; value: string }[];
  active?: boolean;
  name?: FHIRHumanName[];
  telecom?: { system: 'phone' | 'email'; value: string; use?: string }[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
}
