import { z } from "zod";

export const registerSchema = z.object({
  organizationName: z.string().trim().min(2).max(200),
  municipality: z.string().trim().max(200).optional(),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(10).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(200),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10).max(500),
  password: z.string().min(10).max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
