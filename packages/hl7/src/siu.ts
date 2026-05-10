import { getField, type HL7Message } from './parser';

/**
 * SIU^S12..S26 — Scheduling Information Unsolicited (appointments).
 * Parses SCH (schedule) + AIS/AIL/AIP segments and PID for the patient.
 * Spec: HL7 v2.5 Chapter 10.
 */

export interface SiuTransformResult {
  trigger: string;          // S12 = new appt, S13 = reschedule, S15 = cancel ...
  patient: { mrn: string };
  appointment: {
    placerId?: string;      // SCH-1
    fillerId?: string;      // SCH-2
    reason?: string;        // SCH-7
    startAt?: string;       // SCH-11.4
    durationMinutes?: number; // SCH-11.2
    status?: string;        // SCH-25.1
    location?: string;      // AIL-3.1
    practitionerName?: string; // AIP-3.2
    serviceCode?: string;   // AIS-3.1
    serviceName?: string;   // AIS-3.2
  };
}

function parseHL7DateTime(raw: string): string | undefined {
  if (!raw) return undefined;
  const y = raw.slice(0, 4), m = raw.slice(4, 6), d = raw.slice(6, 8);
  const hh = raw.slice(8, 10) || '00', mm = raw.slice(10, 12) || '00';
  if (!y || !m || !d) return undefined;
  return `${y}-${m}-${d}T${hh}:${mm}:00Z`;
}

export function transformSiu(msg: HL7Message): SiuTransformResult {
  const trigger = msg.messageType.split('^')[1] ?? '';
  const pid = msg.bySegment('PID');
  const sch = msg.bySegment('SCH');
  const ais = msg.bySegment('AIS');
  const ail = msg.bySegment('AIL');
  const aip = msg.bySegment('AIP');

  // SCH-11 is a TQ data type: comp1 quantity, comp2 interval, comp4 start datetime.
  const tq = sch?.fields[11];
  const startAt = tq ? parseHL7DateTime(tq[3] ?? '') : undefined;
  const duration = Number(tq?.[1]) || undefined;

  return {
    trigger,
    patient: { mrn: getField(pid, 3, 0) || getField(pid, 2, 0) },
    appointment: {
      placerId: sch?.fields[1]?.[0],
      fillerId: sch?.fields[2]?.[0],
      reason: sch?.fields[7]?.[0],
      startAt,
      durationMinutes: duration,
      status: sch?.fields[25]?.[0],
      location: ail?.fields[3]?.[0],
      practitionerName: aip?.fields[3]?.[1],
      serviceCode: ais?.fields[3]?.[0],
      serviceName: ais?.fields[3]?.[1],
    },
  };
}
