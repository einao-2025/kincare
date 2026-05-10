import { getField, type HL7Message } from './parser';

/**
 * ORU^R01 — Observation Result Unsolicited.
 * Maps OBR (order/test) + OBX (result rows) into our DiagnosticReport + Observation shape.
 * Spec: HL7 v2.5 Chapter 7.
 */

export interface OruObservation {
  loinc?: string;          // OBX-3 component 1
  display: string;         // OBX-3 component 2
  valueType: string;       // OBX-2  (e.g. NM | ST | CE)
  value: string;           // OBX-5
  unit?: string;           // OBX-6
  referenceRange?: string; // OBX-7
  abnormalFlag?: string;   // OBX-8
  status?: string;         // OBX-11 (F | P | C | X)
  observedAt?: string;     // OBX-14
}

export interface OruTransformResult {
  trigger: string;
  patient: { mrn: string; firstName?: string; lastName?: string };
  report: {
    code?: string;          // OBR-4 component 1
    display?: string;       // OBR-4 component 2
    category?: string;
    issuedAt?: string;      // OBR-22 / MSH-7 fallback
    conclusion?: string;
  };
  observations: OruObservation[];
}

function parseHL7DateTime(raw: string): string | undefined {
  if (!raw) return undefined;
  const y = raw.slice(0, 4), m = raw.slice(4, 6), d = raw.slice(6, 8);
  const hh = raw.slice(8, 10) || '00', mm = raw.slice(10, 12) || '00';
  if (!y || !m || !d) return undefined;
  return `${y}-${m}-${d}T${hh}:${mm}:00Z`;
}

export function transformOru(msg: HL7Message): OruTransformResult {
  const trigger = msg.messageType.split('^')[1] ?? '';
  const pid = msg.bySegment('PID');
  const obr = msg.bySegment('OBR');
  const obxs = msg.allSegments('OBX');
  const ntes = msg.allSegments('NTE');

  const observations: OruObservation[] = obxs.map((seg) => ({
    valueType: getField(seg, 2, 0),
    loinc: seg.fields[3]?.[0],
    display: seg.fields[3]?.[1] ?? seg.fields[3]?.[0] ?? '',
    value: getField(seg, 5, 0),
    unit: seg.fields[6]?.[0],
    referenceRange: seg.fields[7]?.[0],
    abnormalFlag: seg.fields[8]?.[0],
    status: seg.fields[11]?.[0],
    observedAt: parseHL7DateTime(getField(seg, 14, 0)),
  }));

  return {
    trigger,
    patient: {
      mrn: getField(pid, 3, 0) || getField(pid, 2, 0),
      lastName: pid?.fields[5]?.[0],
      firstName: pid?.fields[5]?.[1],
    },
    report: {
      code: obr?.fields[4]?.[0],
      display: obr?.fields[4]?.[1] ?? obr?.fields[4]?.[0],
      issuedAt: parseHL7DateTime(getField(obr, 22, 0)) ?? parseHL7DateTime(msg.timestamp ?? ''),
      conclusion: ntes.map((n) => n.fields[3]?.[0] ?? '').filter(Boolean).join('\n') || undefined,
    },
    observations,
  };
}
