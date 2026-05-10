/**
 * MLLP — Minimal Lower Layer Protocol framing for HL7 v2 over TCP.
 * Spec: <SB=0x0B> message <EB=0x1C><CR=0x0D>
 * ACK: MSA|AA|<controlId>  (or AE/AR for failure).
 */

export const MLLP_SB = 0x0b;
export const MLLP_EB = 0x1c;
export const MLLP_CR = 0x0d;

export interface MllpFramerEvents {
  onMessage: (raw: string) => void;
  onError?: (err: Error) => void;
}

/**
 * Stateful framer — feed it socket chunks; it emits complete HL7 messages.
 */
export class MllpFramer {
  private buffer: Buffer = Buffer.alloc(0);

  constructor(private readonly events: MllpFramerEvents) {}

  push(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const sb = this.buffer.indexOf(MLLP_SB);
      if (sb < 0) { this.buffer = Buffer.alloc(0); return; }
      const eb = this.buffer.indexOf(MLLP_EB, sb + 1);
      if (eb < 0) {
        // wait for more data
        if (sb > 0) this.buffer = this.buffer.subarray(sb);
        return;
      }
      // optional CR after EB
      const end = this.buffer[eb + 1] === MLLP_CR ? eb + 2 : eb + 1;
      const payload = this.buffer.subarray(sb + 1, eb).toString('utf8');
      this.buffer = this.buffer.subarray(end);
      try {
        this.events.onMessage(payload);
      } catch (e) {
        this.events.onError?.(e as Error);
      }
    }
  }
}

/** Build an MLLP-framed ACK message. */
export function buildAck(controlId: string, sendingApp = 'KINCARE', sendingFacility = 'KINCARE', code: 'AA' | 'AE' | 'AR' = 'AA', text?: string): Buffer {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const segments = [
    `MSH|^~\\&|${sendingApp}|${sendingFacility}|||${ts}||ACK|${controlId}|P|2.5`,
    `MSA|${code}|${controlId}${text ? `|${text}` : ''}`,
  ].join('\r');
  return Buffer.concat([
    Buffer.from([MLLP_SB]),
    Buffer.from(segments, 'utf8'),
    Buffer.from([MLLP_EB, MLLP_CR]),
  ]);
}
