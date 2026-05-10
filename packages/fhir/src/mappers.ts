import type { FHIRPatient } from './types';

interface PatientLike {
  id: string;
  mrn: string;
  dateOfBirth: Date;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  user: { firstName: string; lastName: string; email: string; phone?: string | null };
}

const GENDER_MAP: Record<PatientLike['gender'], FHIRPatient['gender']> = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
  UNKNOWN: 'unknown',
};

export function toFHIRPatient(p: PatientLike): FHIRPatient {
  const telecom: FHIRPatient['telecom'] = [
    { system: 'email', value: p.user.email, use: 'home' },
  ];
  if (p.user.phone) telecom.push({ system: 'phone', value: p.user.phone, use: 'mobile' });

  return {
    resourceType: 'Patient',
    id: p.id,
    identifier: [{ system: 'urn:kincare:mrn', value: p.mrn }],
    active: true,
    name: [{ use: 'official', family: p.user.lastName, given: [p.user.firstName] }],
    telecom,
    gender: GENDER_MAP[p.gender],
    birthDate: p.dateOfBirth.toISOString().slice(0, 10),
  };
}
