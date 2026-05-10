import { parseHL7 } from '@kincare/hl7';
import { transformAdt } from '@kincare/hl7';

const ADT_A01 =
  'MSH|^~\\&|HIS|HOSP|KINCARE|KINCARE|20260301120000||ADT^A01|MSG00001|P|2.5\r' +
  'EVN|A01|20260301120000\r' +
  'PID|1||MRN12345^^^HOSP^MR||DOE^JOHN||19700101|M\r' +
  'PV1|1|I|WARD-3^301^A||||DOC123^SMITH^JANE\r';

describe('HL7 v2 parser + ADT transformer', () => {
  it('parses MSH metadata', () => {
    const msg = parseHL7(ADT_A01);
    expect(msg.messageType).toBe('ADT^A01');
    expect(msg.controlId).toBe('MSG00001');
    expect(msg.sendingApp).toBe('HIS');
  });

  it('extracts patient and encounter from ADT^A01', () => {
    const t = transformAdt(parseHL7(ADT_A01));
    expect(t.trigger).toBe('A01');
    expect(t.patient.mrn).toBe('MRN12345');
    expect(t.patient.firstName).toBe('JOHN');
    expect(t.patient.lastName).toBe('DOE');
    expect(t.patient.gender).toBe('MALE');
    expect(t.encounter?.status).toBe('ARRIVED');
  });

  it('rejects messages with a missing MSH segment', () => {
    expect(() => parseHL7('PID|1||MRN1\r')).toThrow();
  });
});
