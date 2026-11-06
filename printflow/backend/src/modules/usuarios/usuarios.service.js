import bcrypt from 'bcryptjs';
import { query } from '../../config/db.js';
import { AppError } from '../../middlewares/erro.js';
import { registrarAuditoria } from '../../shared/auditoria.js';

const COLUNAS = 'id, nome, email, perfil, limite_desconto_percentual, ativo, ultimo_login, criado_em';

export async function listar(empresaId) {
  const { rows } = await query(
    `SELECT ${COLUNAS} FROM usuarios WHERE empresa_id = $1 ORDER BY nome`,
    [empresaId],
  );
  return rows;
}

export async function criar(ator, dados) {
  const senhaHash = await bcrypt.hash(dados.senha, 10);
  const { rows } = await query(
    `INSERT INTO usuarios (empresa_id, nome, email, senha_hash, perfil, limite_desconto_percentual)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${COLUNAS}`,
    [ator.empresaId, dados.nome, dados.email, senhaHash, dados.perfil, dados.limite_desconto_percentual ?? 0],
  );
  await registrarAuditoria({
    empresaId: ator.empresaId, usuarioId: ator.id,
    entidade: 'usuarios', entidadeId: rows[0].id, acao: 'criou',
  });
  return rows[0];
}

export async function atualizar(ator, id, dados) {
  if (id === ator.id && (dados.ativo === false || (dados.perfil && dados.perfil !== 'admin'))) {
    throw new AppError(400, 'Você não pode bloquear a si mesmo nem remover seu próprio acesso de administrador');
  }

  const campos = { ...dados };
  let trocarSenhaSql = '';
  if (campos.senha) {
    campos.senha_hash = await bcrypt.hash(campos.senha, 10);
    delete campos.senha;
    trocarSenhaSql = ', token_versao = token_versao + 1';
  }

  // lista fixa de colunas permitidas (nunca monta SQL com chaves vindas do cliente)
  const permitidas = ['nome', 'perfil', 'limite_desconto_percentual', 'ativo', 'senha_hash'];
  const chaves = Object.keys(campos).filter((k) => permitidas.includes(k));
  const sets = chaves.map((k, i) => `${k} = $${i + 3}`).join(', ');

  const { rows } = await query(
    `UPDATE usuarios SET ${sets}${trocarSenhaSql} WHERE id = $1 AND empresa_id = $2 RETURNING ${COLUNAS}`,
    [id, ator.empresaId, ...chaves.map((k) => campos[k])],
  );
  if (!rows[0]) throw new AppError(404, 'Usuário não encontrado');

  await registrarAuditoria({
    empresaId: ator.empresaId, usuarioId: ator.id,
    entidade: 'usuarios', entidadeId: id, acao: 'editou',
    depois: { campos: chaves.filter((k) => k !== 'senha_hash') },
  });
  return rows[0];
}
