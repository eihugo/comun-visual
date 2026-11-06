import { env } from '../config/env.js';
import { AppError } from './erro.js';

const METODOS_MUTAVEIS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export function protegerCsrf(req, res, next) {
  // Apenas protege requisições autenticadas por cookie em métodos que alteram estado
  if (!METODOS_MUTAVEIS.includes(req.method) || !req.cookies?.token) {
    return next();
  }

  // Vitest / Supertest executam testes de integração internos
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return next();
  }

  // 1. Cabeçalho customizado presente (navegadores barram requisições cross-site simples com headers customizados)
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
    return next();
  }

  // 2. Validação da origem com base no frontendUrl
  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
  if (origin) {
    try {
      const frontendOrigin = new URL(env.frontendUrl).origin;
      if (origin === frontendOrigin) return next();
    } catch {
      // url inválida
    }
  }

  throw new AppError(403, 'Acesso bloqueado: requisição de origem não confiável (CSRF)');
}

