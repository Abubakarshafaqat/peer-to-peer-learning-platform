import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const materialTypeEnum = z.enum([
  'notes',
  'past_paper',
  'mcq',
  'short_questions',
  'long_questions',
  'other',
]);

export const createMaterialMetaSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional().default(''),
  type: materialTypeEnum,
  university: objectId.optional(),
  campus: objectId.optional(),
  department: objectId.optional(),
  course: objectId,
  subject: objectId,
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return [];
      const arr = Array.isArray(val) ? val : val.split(',');
      return arr.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 20);
    }),
});

export const updateMaterialSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  type: materialTypeEnum.optional(),
  course: objectId.optional(),
  subject: objectId.optional(),
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      const arr = Array.isArray(val) ? val : String(val).split(',');
      return arr.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 20);
    }),
});
