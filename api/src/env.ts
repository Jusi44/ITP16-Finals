import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  APP_TIMEZONE: z.string().min(1).default('Asia/Manila'),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((value) => {
      if (value === 'true') {
        return true;
      }
      if (value === 'false' || value.trim() === '') {
        return false;
      }
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }),
});

export const env = envSchema.parse(process.env);
