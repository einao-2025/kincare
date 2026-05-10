import { getField, type HL7Message } from './parser';

/**
 * ORM^O01 — Order Message (medication / lab / imaging order).
 * Maps ORC + RXO/RXE + OBR into a generic order shape we can fan out
 * to Prescription (RX) or DiagnosticReport pre-record (lab/imaging).
 * Spec: HL7 v2.5 Chapter 4.
 */

export interface OrmTransformResult {
  trigger: string;
  patient: { mrn: string };
  order: {
    placerOrderNumber?: string;     // ORC-2
    fillerOrderNumber?: string;     // ORC-3
    orderControl?: string;          // ORC-1 (NW | OK | CA | DC ...)
    orderingProviderName?: string;  // ORC-12 component 2
    orderedAt?: string;             // ORC-9
  };
  medication?: {
    code?: string;                  // RXO-1.1 / RXE-2.1
    name?: string;                  // RXO-1.2 / RXE-2.2
    dosage?: string;                // RXO-2 / RXE-3
    route?: string;                 // RXO-6.2 / RXE-6.2
    frequency?: string;             // RXE-1.2  (interval) — best-effort
    quantity?: number;              // RXO-11 / RXE-10
  };
  test?: {
    code?: string;                  // OBR-4.1
    display?: string;               // OBR-4.2
    requestedAt?: string;           // OBR-6
  };
}

function parseHL7DateTime(raw: string): string | undefined {
  if (!raw) return undefined;
  const y = raw.slice(0, 4), m = raw.slice(4, 6), d = raw.slice(6, 8);
  const hh = raw.slice(8, 10) || '00', mm = raw.slice(10, 12) || '00';
  if (!y || !m || !d) return undefined;
  return `${y}-${m}-${d}T${hh}:${mm}:00Z`;
}

export function transformOrm(msg: HL7Message): OrmTransformResult {
  const trigger = msg.messageType.split('^')[1] ?? '';
  const pid = msg.bySegment('PID');
  const orc = msg.bySegment('ORC');
  const rxo = msg.bySegment('RXO');
  const rxe = msg.bySegment('RXE');
  const obr = msg.bySegment('OBR');

  const result: OrmTransformResult = {
    trigger,
    patient: { mrn: getField(pid, 3, 0) || getField(pid, 2, 0) },
    order: {
      orderControl: orc?.fields[1]?.[0],
      placerOrderNumber: orc?.fields[2]?.[0],
      fillerOrderNumber: orc?.fields[3]?.[0],
      orderingProviderName: orc?.fields[12]?.[1],
      orderedAt: parseHL7DateTime(getField(orc, 9, 0)),
    },
  };

  const rx = rxo ?? rxe;
  if (rx) {
    result.medication = {
      code: rx.fields[1]?.[0] ?? rx.fields[2]?.[0],
      name: rx.fields[1]?.[1] ?? rx.fields[2]?.[1],
      dosage: rx === rxo ? rx.fields[2]?.[0] : rx.fields[3]?.[0],
      route: rx === rxo ? rx.fields[6]?.[1] : rx.fields[6]?.[1],
      quantity: Number(rx === rxo ? rx.fields[11]?.[0] : rx.fields[10]?.[0]) || undefined,
      frequency: rxe?.fields[1]?.[1],
    };
  } else if (obr) {
    result.test = {
      code: obr.fields[4]?.[0],
      display: obr.fields[4]?.[1] ?? obr.fields[4]?.[0],
      requestedAt: parseHL7DateTime(getField(obr, 6, 0)),
    };
  }
  return result;
}
