import { z } from 'zod';

export const senhaForte = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres')
  .max(100)
  .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra')
  .regex(/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, 'A senha deve conter ao menos um número ou símbolo');

export const registrarSchema = z.object({
  empresa: z.object({
    nome: z.string().trim().min(2).max(150),
    cnpj: z.string().trim().max(18).optional(),
    email: z.string().trim().email().optional(),
  }),
  admin: z.object({
    nome: z.string().trim().min(2).max(150),
    email: z.string().trim().toLowerCase().email(),
    senha: senhaForte,
  }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  senha: z.string().min(1),
});
