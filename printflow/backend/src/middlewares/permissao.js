import { AppError } from './erro.js';

// Uso: router.post('/', permissao('admin', 'gerente'), ...)
export const permissao = (...perfis) => (req, res, next) => {
  if (!perfis.includes(req.user.perfil)) throw new AppError(403, 'Sem permissão para esta ação');
  next();
};
