import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { AppError } from './erro.js';

// O empresa_id SEMPRE vem daqui (banco, via token), nunca do body ou da URL.
export async function autenticar(req, res, next) {
  const token = req.cookies?.token;
  if (!token) throw new AppError(401, 'Não autenticado');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError(401, 'Sessão inválida ou expirada');
  }

  // Relê o usuário a cada requisição: bloqueio e troca de perfil valem na hora.
  const { rows } = await query(
    `SELECT u.id, u.empresa_id, u.nome, u.email, u.perfil, u.limite_desconto_percentual, u.token_versao
       FROM usuarios u JOIN empresas e ON e.id = u.empresa_id
      WHERE u.id = $1 AND u.ativo = TRUE AND e.ativo = TRUE`,
    [payload.sub],
  );
  if (!rows[0]) throw new AppError(401, 'Usuário inativo ou inexistente');

  const u = rows[0];
  if (payload.ver !== undefined && Number(payload.ver) !== Number(u.token_versao)) {
    throw new AppError(401, 'Sessão revogada após alteração de credenciais');
  }
  req.user = {
    id: u.id,
    empresaId: u.empresa_id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    limiteDesconto: Number(u.limite_desconto_percentual),
  };
  next();
}
