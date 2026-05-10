import { z } from 'zod';

export const fhirPatientSchema = z.object({
  resourceType: z.literal('Patient'),
  id: z.string().optional(),
  identifier: z.array(z.object({ system: z.string().optional(), value: z.string() })).optional(),
  active: z.boolean().optional(),
  name: z.array(z.object({
    use: z.enum(['usual', 'official']).optional(),
    family: z.string().optional(),
    given: z.array(z.string()).optional(),
  })).optional(),
  telecom: z.array(z.object({
    system: z.enum(['phone', 'email']),
    value: z.string(),
    use: z.string().optional(),
  })).optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type FHIRPatientInput = z.infer<typeof fhirPatientSchema>;

export const fhirSchemas = {
  Patient: fhirPatientSchema,
} as const;
