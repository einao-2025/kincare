import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

// ─── Password hashing (scrypt with per-password salt) ───────────

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export function hashPassword(password: string, pepper = ''): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password + pepper, salt, KEY_LEN, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P,
  }).toString('hex');
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string, pepper = ''): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nStr, rStr, pStr, salt, hash] = parts;
  const derived = scryptSync(password + pepper, salt!, KEY_LEN, {
    N: Number(nStr), r: Number(rStr), p: Number(pStr),
  });
  const expected = Buffer.from(hash!, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// ─── Field-level encryption (AES-256-GCM, key-versioned) ───────

const ALGO = 'aes-256-gcm';

function loadKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new Error('PHI encryption key must be 32 bytes (base64-encoded).');
  }
  return key;
}

/**
 * Key registry — supports rotating the active encryption key without
 * invalidating ciphertext that was written with an older key.
 *
 * Construct from a `PHI_KEYS` env in the form `v1:<base64>;v2:<base64>...`.
 * The newest version is used for new writes; any version can be used to
 * decrypt. Legacy unversioned ciphertext is decrypted using the legacy
 * `PHI_ENCRYPTION_KEY` env.
 */
export interface KeyRegistry {
  readonly activeVersion: string;
  getKey(version: string): Buffer;
  hasVersion(version: string): boolean;
}

export function createKeyRegistry(versionedKeysEnv: string | undefined,
                                  legacyKeyEnv?: string): KeyRegistry {
  const map = new Map<string, Buffer>();
  if (versionedKeysEnv) {
    for (const part of versionedKeysEnv.split(';').map((s) => s.trim()).filter(Boolean)) {
      const idx = part.indexOf(':');
      if (idx <= 0) throw new Error(`Invalid PHI_KEYS entry: ${part}`);
      map.set(part.slice(0, idx), loadKey(part.slice(idx + 1)));
    }
  }
  if (legacyKeyEnv) map.set('legacy', loadKey(legacyKeyEnv));

  if (map.size === 0) throw new Error('No PHI encryption keys configured');
  // Pick the highest version label (lexicographic on v\d+) as active.
  const versions = [...map.keys()].filter((v) => v !== 'legacy').sort();
  const active = versions[versions.length - 1] ?? 'legacy';
  return {
    activeVersion: active,
    getKey: (v) => {
      const k = map.get(v);
      if (!k) throw new Error(`Unknown encryption key version: ${v}`);
      return k;
    },
    hasVersion: (v) => map.has(v),
  };
}

/**
 * Encrypts plaintext PHI string. Output: `<version>:base64(iv|tag|ciphertext)`.
 * Old call sites that pass a raw base64 key string remain supported.
 */
export function encryptField(plaintext: string, keyOrRegistry: string | KeyRegistry): string {
  const registry = typeof keyOrRegistry === 'string'
    ? singleKeyRegistry(keyOrRegistry)
    : keyOrRegistry;
  const version = registry.activeVersion;
  const key = registry.getKey(version);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${version}:${Buffer.concat([iv, tag, ct]).toString('base64')}`;
}

export function decryptField(payload: string, keyOrRegistry: string | KeyRegistry): string {
  const registry = typeof keyOrRegistry === 'string'
    ? singleKeyRegistry(keyOrRegistry)
    : keyOrRegistry;
  // Legacy format: pure base64, no version prefix.
  let version = 'legacy';
  let body = payload;
  const colon = payload.indexOf(':');
  if (colon > 0 && colon < 16) { // version labels are short (e.g., v1)
    version = payload.slice(0, colon);
    body = payload.slice(colon + 1);
  }
  const key = registry.getKey(version);
  const buf = Buffer.from(body, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/**
 * Re-encrypt a payload under the registry's active key. Use this to rotate
 * data column-by-column to a new key version.
 */
export function rotateField(payload: string, registry: KeyRegistry): string {
  return encryptField(decryptField(payload, registry), registry);
}

function singleKeyRegistry(base64Key: string): KeyRegistry {
  const key = loadKey(base64Key);
  return {
    activeVersion: 'v1',
    getKey: (v) => {
      if (v === 'v1' || v === 'legacy') return key;
      throw new Error(`Unknown encryption key version: ${v}`);
    },
    hasVersion: (v) => v === 'v1' || v === 'legacy',
  };
}

// ─── Hashing utilities ──────────────────────────────────────────

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function generateToken(byteLength = 32): { token: string; hash: string } {
  const token = randomBytes(byteLength).toString('base64url');
  return { token, hash: sha256Hex(token) };
}

export function generatePickupCode(): string {
  // 8-digit numeric, easy to read aloud at a pharmacy.
  const n = Number(randomBytes(4).readUInt32BE(0)) % 100_000_000;
  return n.toString().padStart(8, '0');
}
