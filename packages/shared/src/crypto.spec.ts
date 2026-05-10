import { randomBytes } from 'node:crypto';
import {
  hashPassword, verifyPassword,
  encryptField, decryptField, rotateField, createKeyRegistry,
  generatePickupCode, generateToken, sha256Hex,
} from './crypto';

const k1 = randomBytes(32).toString('base64');
const k2 = randomBytes(32).toString('base64');

describe('password hashing', () => {
  it('round-trips a password', () => {
    const h = hashPassword('correct horse battery staple', 'pepper');
    expect(verifyPassword('correct horse battery staple', h, 'pepper')).toBe(true);
    expect(verifyPassword('wrong', h, 'pepper')).toBe(false);
  });

  it('rejects bad pepper', () => {
    const h = hashPassword('hunter2', 'pepperA');
    expect(verifyPassword('hunter2', h, 'pepperB')).toBe(false);
  });

  it('rejects malformed stored hash', () => {
    expect(verifyPassword('x', 'not-a-hash', '')).toBe(false);
  });
});

describe('encryptField / decryptField (single-key legacy mode)', () => {
  it('round-trips PHI', () => {
    const ct = encryptField('John Doe — MRN 12345', k1);
    expect(ct).not.toContain('John');
    expect(decryptField(ct, k1)).toBe('John Doe — MRN 12345');
  });

  it('detects ciphertext tampering', () => {
    const ct = encryptField('secret', k1);
    const colon = ct.indexOf(':');
    const head = ct.slice(0, colon + 1);
    const body = Buffer.from(ct.slice(colon + 1), 'base64');
    body[body.length - 1] = (body[body.length - 1] ?? 0) ^ 0x01;
    expect(() => decryptField(head + body.toString('base64'), k1)).toThrow();
  });
});

describe('key registry & rotation', () => {
  it('encrypts with active version, decrypts with older versions', () => {
    const reg = createKeyRegistry(`v1:${k1};v2:${k2}`);
    expect(reg.activeVersion).toBe('v2');
    const ct = encryptField('demographics', reg);
    expect(ct.startsWith('v2:')).toBe(true);
    expect(decryptField(ct, reg)).toBe('demographics');
  });

  it('rotates payload from v1 → v2', () => {
    const single = createKeyRegistry(`v1:${k1}`);
    const ct = encryptField('blood_type:O+', single);
    expect(ct.startsWith('v1:')).toBe(true);

    const dual = createKeyRegistry(`v1:${k1};v2:${k2}`);
    const rotated = rotateField(ct, dual);
    expect(rotated.startsWith('v2:')).toBe(true);
    expect(decryptField(rotated, dual)).toBe('blood_type:O+');
  });

  it('reads legacy unversioned ciphertext', () => {
    // Build a payload manually using legacy format: pure base64 with no version prefix.
    const ct = encryptField('legacy', k1);
    const legacyOnly = ct.slice(ct.indexOf(':') + 1);
    const reg = createKeyRegistry(undefined, k1);
    expect(decryptField(legacyOnly, reg)).toBe('legacy');
  });
});

describe('utility helpers', () => {
  it('generates an 8-digit pickup code', () => {
    const c = generatePickupCode();
    expect(c).toMatch(/^\d{8}$/);
  });

  it('hashes a token deterministically', () => {
    const { token, hash } = generateToken();
    expect(hash).toEqual(sha256Hex(token));
  });
});
