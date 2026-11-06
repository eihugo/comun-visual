import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { query, transaction } from '../../config/db.js';
import { AppError } from '../../middlewares/erro.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { ETAPAS_PADRAO } from '../../shared/etapasPadrao.js';

// hash falso para gastar o mesmo tempo quando o e-mail não existe
const HASH_FALSO = bcrypt.hashSync('senha-falsa', 10);

export const gerarToken = (usuarioId, tokenVersao = 1) =>
  jwt.sign({ sub: usuarioId, ver: tokenVersao }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export async function registrarEmpresa({ empresa, admin }) {
  const senhaHash = await bcrypt.hash(admin.senha, 10);

  return transaction(async (db) => {
    const e = (await db.query(
      'INSERT INTO empresas (nome, cnpj, email) VALUES ($1,$2,$3) RETURNING id',
      [empresa.nome, empresa.cnpj || null, empresa.email || null],
    )).rows[0];

    const u = (await db.query(
      `INSERT INTO usuarios (empresa_id, nome, email, senha_hash, perfil, limite_desconto_percentual)
       VALUES ($1,$2,$3,$4,'admin',100)
       RETURNING id, empresa_id, nome, email, perfil, token_versao`,
      [e.id, admin.nome, admin.email, senhaHash],
    )).rows[0];

    for (let i = 0; i < ETAPAS_PADRAO.length; i++) {
      await db.query(
        'INSERT INTO etapas_producao (empresa_id, nome, ordem, final) VALUES ($1,$2,$3,$4)',
        [e.id, ETAPAS_PADRAO[i], i + 1, i === ETAPAS_PADRAO.length - 1],
      );
    }
    await db.query(
      "INSERT INTO sequencias (empresa_id, tipo) VALUES ($1,'orcamento'), ($1,'os')",
      [e.id],
    );

    await registrarAuditoria(
      { empresaId: e.id, usuarioId: u.id, entidade: 'empresas', entidadeId: e.id, acao: 'criou' },
      db,
    );
    return u;
  });
}

export async function login({ email, senha }) {
  const { rows } = await query(
    `SELECT u.id, u.empresa_id, u.nome, u.email, u.perfil, u.senha_hash, u.token_versao
       FROM usuarios u JOIN empresas e ON e.id = u.empresa_id
      WHERE u.email = $1 AND u.ativo = TRUE AND e.ativo = TRUE`,
    [email],
  );
  const u = rows[0];
  const ok = await bcrypt.compare(senha, u ? u.senha_hash : HASH_FALSO);
  if (!u || !ok) throw new AppError(401, 'E-mail ou senha inválidos');

  await query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1', [u.id]);
  await registrarAuditoria({
    empresaId: u.empresa_id, usuarioId: u.id, entidade: 'usuarios', entidadeId: u.id, acao: 'login',
  });
  const { senha_hash, ...usuario } = u;
  return usuario;
}
