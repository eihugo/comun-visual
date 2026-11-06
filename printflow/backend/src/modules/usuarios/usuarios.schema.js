import { z } from 'zod';

const perfil = z.enum(['admin', 'gerente', 'vendedor', 'designer', 'producao', 'financeiro']);

const senhaForte = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres')
  .max(100)
  .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra')
  .regex(/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, 'A senha deve conter ao menos um número ou símbolo');

export const criarUsuarioSchema = z.object({
  nome: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email(),
  senha: senhaForte,
  perfil,
  limite_desconto_percentual: z.number().min(0).max(100).optional(),
});

export const atualizarUsuarioSchema = z
  .object({
    nome: z.string().trim().min(2).max(150),
    perfil,
    limite_desconto_percentual: z.number().min(0).max(100),
    ativo: z.boolean(),
    senha: senhaForte,
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Informe ao menos um campo');
