import { randomUUID } from 'node:crypto';

export const newId = (): string => randomUUID();

/** Produces a hospital MRN like "MRN-2026-000123". */
export function generateMRN(seq: number, year = new Date().getUTCFullYear()): string {
  return `MRN-${year}-${seq.toString().padStart(6, '0')}`;
}
