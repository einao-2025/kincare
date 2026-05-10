import { createHmac, randomBytes } from 'node:crypto';

/**
 * RFC 6238 TOTP — minimal, no external deps.
 * Compatible with Google Authenticator / 1Password / Authy.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

export function generateOtpauthURL(opts: {
  issuer: string; account: string; secret: string;
  digits?: number; period?: number;
}): string {
  const digits = opts.digits ?? 6;
  const period = opts.period ?? 30;
  const label = encodeURIComponent(`${opts.issuer}:${opts.account}`);
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: 'SHA1',
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function generateTotp(secret: string, atSeconds = Math.floor(Date.now() / 1000), period = 30, digits = 6): string {
  const counter = Math.floor(atSeconds / period);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const slice = hmac.subarray(offset, offset + 4);
  const code = (slice.readUInt32BE(0) & 0x7fffffff) % 10 ** digits;
  return code.toString().padStart(digits, '0');
}

export function verifyTotp(token: string, secret: string, opts: { window?: number; period?: number; digits?: number } = {}): boolean {
  const window = opts.window ?? 1;
  const period = opts.period ?? 30;
  const digits = opts.digits ?? 6;
  const now = Math.floor(Date.now() / 1000);
  for (let i = -window; i <= window; i++) {
    if (generateTotp(secret, now + i * period, period, digits) === token) return true;
  }
  return false;
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(5).toString('hex').match(/.{1,5}/g)!.join('-'),
  );
}

// ── Base32 helpers (RFC 4648, no padding) ───────────────────────

function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/g, '').toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
