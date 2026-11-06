import { query } from '../../config/db.js';
import { AppError } from '../../middlewares/erro.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { setClause } from '../../shared/http.js';

const COLS = 'id, tipo, nome, documento, telefone, email, endereco, observacoes, ativo, criado_em';
const EDITAVEIS = ['tipo', 'nome', 'documento', 'telefone', 'email', 'endereco', 'observacoes', 'ativo'];

export async function listar(empresaId, { q, ativo }) {
  const params = [empresaId];
  let where = 'empresa_id = $1 AND deletado_em IS NULL';
  if (q) {
    params.push(`%${q}%`);
    where += ` AND (nome ILIKE $${params.length} OR documento ILIKE $${params.length} OR telefone ILIKE $${params.length})`;
  }
  if (ativo === 'true' || ativo === 'false') {
    params.push(ativo === 'true');
    where += ` AND ativo = $${params.length}`;
  }
  const { rows } = await query(`SELECT ${COLS} FROM clientes WHERE ${where} ORDER BY nome LIMIT 200`, params);
  return rows;
}

export async function obter(empresaId, id) {
  const { rows } = await query(
    `SELECT ${COLS} FROM clientes WHERE id = $1 AND empresa_id = $2 AND deletado_em IS NULL`,
    [id, empresaId],
  );
  if (!rows[0]) throw new AppError(404, 'Cliente não encontrado');
  const orcamentos = (await query(
    `SELECT id, numero, versao, status, total, criado_em FROM orcamentos
      WHERE cliente_id = $1 AND empresa_id = $2 ORDER BY criado_em DESC`,
    [id, empresaId],
  )).rows;
  return { ...rows[0], orcamentos };
}

export async function criar(ator, d) {
  const { rows } = await query(
    `INSERT INTO clientes (empresa_id, tipo, nome, documento, telefone, email, endereco, observacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${COLS}`,
    [ator.empresaId, d.tipo, d.nome, d.documento ?? null, d.telefone ?? null, d.email ?? null, d.endereco ?? null, d.observacoes ?? null],
  );
  await registrarAuditoria({ empresaId: ator.empresaId, usuarioId: ator.id, entidade: 'clientes', entidadeId: rows[0].id, acao: 'criou' });
  return rows[0];
}

export async function atualizar(ator, id, d) {
  const s = setClause(d, EDITAVEIS);
  const { rows } = await query(
    `UPDATE clientes SET ${s.sql} WHERE id = $1 AND empresa_id = $2 AND deletado_em IS NULL RETURNING ${COLS}`,
    [id, ator.empresaId, ...s.valores],
  );
  if (!rows[0]) throw new AppError(404, 'Cliente não encontrado');
  await registrarAuditoria({ empresaId: ator.empresaId, usuarioId: ator.id, entidade: 'clientes', entidadeId: id, acao: 'editou', depois: { campos: s.chaves } });
  return rows[0];
}

export async function excluir(ator, id) {
  const { rowCount } = await query(
    `UPDATE clientes SET deletado_em = NOW(), ativo = FALSE
      WHERE id = $1 AND empresa_id = $2 AND deletado_em IS NULL`,
    [id, ator.empresaId],
  );
  if (!rowCount) throw new AppError(404, 'Cliente não encontrado');
  await registrarAuditoria({ empresaId: ator.empresaId, usuarioId: ator.id, entidade: 'clientes', entidadeId: id, acao: 'excluiu' });
}

export async function listarHistorico(empresaId, clienteId) {
  await obter(empresaId, clienteId);
  const { rows } = await query(
    `SELECT h.id, h.descricao, h.criado_em, u.nome AS usuario
       FROM cliente_historico h LEFT JOIN usuarios u ON u.id = h.usuario_id
      WHERE h.cliente_id = $1 AND h.empresa_id = $2 ORDER BY h.criado_em DESC`,
    [clienteId, empresaId],
  );
  return rows;
}

export async function addHistorico(ator, clienteId, descricao) {
  await obter(ator.empresaId, clienteId);
  const { rows } = await query(
    `INSERT INTO cliente_historico (empresa_id, cliente_id, usuario_id, descricao)
     VALUES ($1,$2,$3,$4) RETURNING id, descricao, criado_em`,
    [ator.empresaId, clienteId, ator.id, descricao],
  );
  return rows[0];
}
