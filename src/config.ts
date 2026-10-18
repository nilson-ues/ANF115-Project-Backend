import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const esquema = z.object({
  PORT: z.coerce.number().int().default(3000),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:4200')
});

export const config = esquema.parse(process.env);
