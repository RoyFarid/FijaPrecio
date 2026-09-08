import { z } from 'zod';

const password = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .max(200);

export const registerSchema = z.object({
  email: z.string().email().max(200),
  password,
  name: z.string().trim().min(1).max(120),
  organizationName: z.string().trim().min(1).max(120),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;
