import { MllpFramer, MLLP_SB, MLLP_EB, MLLP_CR, buildAck } from '@kincare/hl7';

describe('MLLP framer', () => {
  const wrap = (msg: string) => Buffer.concat([
    Buffer.from([MLLP_SB]),
    Buffer.from(msg, 'utf8'),
    Buffer.from([MLLP_EB, MLLP_CR]),
  ]);

  it('emits a complete message in one chunk', () => {
    const got: string[] = [];
    const framer = new MllpFramer({ onMessage: (m) => got.push(m) });
    framer.push(wrap('MSH|x'));
    expect(got).toEqual(['MSH|x']);
  });

  it('reassembles partial chunks across multiple pushes', () => {
    const got: string[] = [];
    const framer = new MllpFramer({ onMessage: (m) => got.push(m) });
    const buf = wrap('MSH|complete-message');
    framer.push(buf.subarray(0, 5));
    framer.push(buf.subarray(5, 12));
    framer.push(buf.subarray(12));
    expect(got).toEqual(['MSH|complete-message']);
  });

  it('handles two messages in a single chunk', () => {
    const got: string[] = [];
    const framer = new MllpFramer({ onMessage: (m) => got.push(m) });
    framer.push(Buffer.concat([wrap('A'), wrap('B')]));
    expect(got).toEqual(['A', 'B']);
  });
});

describe('buildAck', () => {
  it('produces an MLLP-framed AA ACK referencing the source control id', () => {
    const ack = buildAck('CTRL123', 'KINCARE', 'KINCARE', 'AA', 'ok');
    expect(ack[0]).toBe(MLLP_SB);
    expect(ack[ack.length - 2]).toBe(MLLP_EB);
    expect(ack.toString('utf8')).toContain('MSA|AA|CTRL123');
  });
});
