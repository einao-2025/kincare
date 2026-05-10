import { getField, type HL7Message } from './parser';

/**
 * Transforms an HL7 v2 ADT (Admit/Discharge/Transfer) message into a partial
 * FHIR-aligned payload that the API can persist as Patient + Encounter.
 */
export interface AdtTransformResult {
  patient: {
    mrn: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;     // ISO date
    gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
    phone?: string;
  };
  encounter?: {
    class: 'INPATIENT' | 'OUTPATIENT' | 'EMERGENCY' | 'AMBULATORY';
    status: 'ARRIVED' | 'IN_PROGRESS' | 'FINISHED';
    location?: string;
    startAt?: string;
  };
  trigger: string;            // e.g., A01, A03
}

const SEX_MAP: Record<string, AdtTransformResult['patient']['gender']> = {
  M: 'MALE', F: 'FEMALE', O: 'OTHER', U: 'UNKNOWN',
};

const CLASS_MAP: Record<string, AdtTransformResult['encounter'] extends infer E ? E extends { class: infer C } ? C : never : never> = {
  I: 'INPATIENT', O: 'OUTPATIENT', E: 'EMERGENCY', A: 'AMBULATORY',
};

function parseHL7DateTime(raw: string): string | undefined {
  if (!raw) return undefined;
  const y = raw.slice(0, 4), m = raw.slice(4, 6), d = raw.slice(6, 8);
  const hh = raw.slice(8, 10) || '00', mm = raw.slice(10, 12) || '00';
  if (!y || !m || !d) return undefined;
  return `${y}-${m}-${d}T${hh}:${mm}:00Z`;
}

export function transformAdt(msg: HL7Message): AdtTransformResult {
  const trigger = msg.messageType.split('^')[1] ?? '';
  const pid = msg.bySegment('PID');
  const pv1 = msg.bySegment('PV1');

  const mrn = getField(pid, 3, 0) || getField(pid, 2, 0);
  const lastName = getField(pid, 5, 0);
  const firstName = getField(pid, 5, 1);
  const dob = parseHL7DateTime(getField(pid, 7));
  const sexCode = getField(pid, 8);
  const phone = getField(pid, 13);

  const result: AdtTransformResult = {
    trigger,
    patient: {
      mrn,
      lastName,
      firstName,
      dateOfBirth: dob?.slice(0, 10),
      gender: SEX_MAP[sexCode] ?? 'UNKNOWN',
      phone: phone || undefined,
    },
  };

  if (pv1) {
    const cls = getField(pv1, 2);
    const loc = getField(pv1, 3);
    const adm = parseHL7DateTime(getField(pv1, 44));
    let status: AdtTransformResult['encounter'] extends infer E ? E extends { status: infer S } ? S : never : never = 'IN_PROGRESS';
    if (trigger === 'A01' || trigger === 'A04') status = 'ARRIVED';
    if (trigger === 'A03') status = 'FINISHED';
    result.encounter = {
      class: CLASS_MAP[cls] ?? 'AMBULATORY',
      status,
      location: loc || undefined,
      startAt: adm,
    };
  }
  return result;
}
