/**
 * Decodes a JWT WITHOUT verifying the signature. Used only to peek at the
 * `tid` claim during middleware that runs before the auth guard. Never trust
 * the result for authorisation — guards re-verify and re-issue claims.
 */
export function decodeJwtUnsafe(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
