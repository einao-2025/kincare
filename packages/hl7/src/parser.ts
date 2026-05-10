/**
 * Lightweight HL7 v2.x message parser.
 * Supports the message types Kincare ingests: ADT, ORM, ORU, SIU.
 *
 * Standard HL7 v2 delimiters (declared in MSH-1/MSH-2):
 *   field      |
 *   component  ^
 *   repetition ~
 *   escape     \
 *   sub-comp   &
 */

export interface HL7Delimiters {
  field: string;
  component: string;
  repetition: string;
  escape: string;
  subcomponent: string;
}

export interface HL7Segment {
  name: string;            // e.g., "MSH", "PID"
  fields: string[][];      // fields[i] = components, including repetition flattened
  raw: string;
}

export interface HL7Message {
  delimiters: HL7Delimiters;
  segments: HL7Segment[];
  messageType: string;     // e.g., "ADT^A01"
  controlId: string;       // MSH-10
  sendingApp?: string;
  sendingFacility?: string;
  timestamp?: string;
  /** Quick segment lookup — first occurrence per name. */
  bySegment(name: string): HL7Segment | undefined;
  allSegments(name: string): HL7Segment[];
}

const DEFAULT_DELIMS: HL7Delimiters = {
  field: '|', component: '^', repetition: '~', escape: '\\', subcomponent: '&',
};

export function parseHL7(raw: string): HL7Message {
  if (!raw.startsWith('MSH')) {
    throw new Error('HL7 message must start with MSH segment');
  }

  const fieldSep = raw[3] ?? '|';
  const encodingChars = raw.slice(4, 8);
  const delimiters: HL7Delimiters = {
    field: fieldSep,
    component: encodingChars[0] ?? DEFAULT_DELIMS.component,
    repetition: encodingChars[1] ?? DEFAULT_DELIMS.repetition,
    escape: encodingChars[2] ?? DEFAULT_DELIMS.escape,
    subcomponent: encodingChars[3] ?? DEFAULT_DELIMS.subcomponent,
  };

  // HL7 segments separated by \r (some systems use \n or \r\n).
  const segmentLines = raw
    .split(/\r\n|\r|\n/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const segments: HL7Segment[] = segmentLines.map((line) => {
    const parts = line.split(delimiters.field);
    const name = parts[0] ?? '';
    // For MSH the field separator itself is "field 1"; normalize so PID-1 == fields[1].
    const fields = parts.slice(1).map((field) =>
      field.split(delimiters.component),
    );
    if (name === 'MSH') {
      // Insert the field separator as MSH-1 to match HL7 numbering.
      fields.unshift([delimiters.field]);
    }
    return { name, fields, raw: line };
  });

  const msh = segments.find((s) => s.name === 'MSH');
  if (!msh) throw new Error('Missing MSH segment');

  const messageType = (msh.fields[9]?.join(delimiters.component)) ?? '';
  const controlId = msh.fields[10]?.[0] ?? '';
  const sendingApp = msh.fields[3]?.[0];
  const sendingFacility = msh.fields[4]?.[0];
  const timestamp = msh.fields[7]?.[0];

  return {
    delimiters,
    segments,
    messageType,
    controlId,
    sendingApp,
    sendingFacility,
    timestamp,
    bySegment(name) { return segments.find((s) => s.name === name); },
    allSegments(name) { return segments.filter((s) => s.name === name); },
  };
}

/** Read a field/component safely. fieldIdx is 1-based per HL7 numbering. */
export function getField(seg: HL7Segment | undefined, fieldIdx: number, componentIdx = 0): string {
  if (!seg) return '';
  const f = seg.fields[fieldIdx];
  if (!f) return '';
  return f[componentIdx] ?? '';
}
