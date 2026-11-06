import { query, transaction } from '../../config/db.js';
import { AppError } from '../../middlewares/erro.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { notificar } from '../../shared/notificar.js';

const ABERTAS = "('ativa','pausada','retrabalho')";

const SELECT_LISTA = `
  SELECT os.id, os.numero, os.situacao, os.prioridade, os.prazo_entrega, os.etapa_id, os.responsavel_id, os.orcamento_id,
         c.nome AS cliente_nome, o.numero AS orcamento_numero, e.nome AS etapa_nome, u.nome AS responsavel_nome,
         (os.prazo_entrega IS NOT NULL AND os.prazo_entrega < CURRENT_DATE AND os.situacao IN ${ABERTAS}) AS atrasada,
         (SELECT string_agg(COALESCE(i.descricao, p.nome), ', ') FROM orcamento_itens i
            JOIN produtos p ON p.id = i.produto_id WHERE i.orcamento_id = os.orcamento_id) AS resumo
    FROM ordens_servico os
    JOIN clientes c ON c.id = os.cliente_id
    JOIN orcamentos o ON o.id = os.orcamento_id
    LEFT JOIN etapas_producao e ON e.id = os.etapa_id
    LEFT JOIN usuarios u ON u.id = os.responsavel_id`;

export async function listar(empresaId, { situacao, responsavel_id, atrasadas }) {
  const params = [empresaId];
  let where = 'os.empresa_id = $1';
  if (situacao) { params.push(situacao); where += ` AND os.situacao = $${params.length}`; }
  if (responsavel_id) { params.push(Number(responsavel_id) || 0); where += ` AND os.responsavel_id = $${params.length}`; }
  if (atrasadas === 'true') where += ` AND os.prazo_entrega < CURRENT_DATE AND os.situacao IN ${ABERTAS}`;
  const { rows } = await query(`${SELECT_LISTA} WHERE ${where} ORDER BY os.prazo_entrega NULLS LAST, os.id DESC LIMIT 500`, params);
  return rows;
}

export async function obter(empresaId, id) {
  const os = (await query(`${SELECT_LISTA} WHERE os.empresa_id = $1 AND os.id = $2`, [empresaId, id])).rows[0];
  if (!os) throw new AppError(404, 'Ordem de serviço não encontrada');
  const extra = (await query('SELECT observacoes, motivo_cancelamento, criado_em, concluido_em FROM ordens_servico WHERE id = $1', [id])).rows[0];
  const itens = (await query(
    `SELECT COALESCE(i.descricao, p.nome) AS descricao, i.largura, i.altura, i.quantidade, i.acabamento, m.nome AS material
       FROM orcamento_itens i JOIN produtos p ON p.id = i.produto_id LEFT JOIN materiais m ON m.id = i.material_id
      WHERE i.orcamento_id = $1 AND i.empresa_id = $2 ORDER BY i.id`, [os.orcamento_id, empresaId],
  )).rows;
  const historico = (await query(
    `SELECT h.id, h.observacao, h.criado_em, u.nome AS usuario, ea.nome AS etapa_anterior, en.nome AS etapa_nova
       FROM os_historico h LEFT JOIN usuarios u ON u.id = h.usuario_id
       LEFT JOIN etapas_producao ea ON ea.id = h.etapa_anterior_id LEFT JOIN etapas_producao en ON en.id = h.etapa_nova_id
      WHERE h.os_id = $1 AND h.empresa_id = $2 ORDER BY h.criado_em DESC, h.id DESC`, [id, empresaId],
  )).rows;
  const materiais = (await query(
    `SELECT mv.id, mv.quantidade, mv.criado_em, m.nome, m.unidade FROM movimentacoes_estoque mv
       JOIN materiais m ON m.id = mv.material_id WHERE mv.os_id = $1 AND mv.empresa_id = $2 AND mv.tipo = 'saida' ORDER BY mv.criado_em DESC`,
    [id, empresaId],
  )).rows;
  return { ...os, ...extra, itens, historico, materiais };
}

async function travar(db, empresaId, id) {
  const os = (await db.query('SELECT * FROM ordens_servico WHERE id = $1 AND empresa_id = $2 FOR UPDATE', [id, empresaId])).rows[0];
  if (!os) throw new AppError(404, 'Ordem de serviço não encontrada');
  return os;
}
const fechada = (os) => ['cancelada', 'concluida'].includes(os.situacao);

export async function mudarEtapa(ator, id, { etapa_id, observacao }) {
  return transaction(async (db) => {
    const os = await travar(db, ator.empresaId, id);
    if (fechada(os)) throw new AppError(409, 'Esta O.S. já foi encerrada');
    const etapa = (await db.query('SELECT id, nome, final FROM etapas_producao WHERE id = $1 AND empresa_id = $2 AND ativo = TRUE', [etapa_id, ator.empresaId])).rows[0];
    if (!etapa) throw new AppError(400, 'Etapa inválida');

    await db.query(
      `UPDATE ordens_servico SET etapa_id = $3, situacao = CASE WHEN $4 THEN 'concluida' ELSE situacao END,
         concluido_em = CASE WHEN $4 THEN NOW() ELSE concluido_em END WHERE id = $1 AND empresa_id = $2`,
      [id, ator.empresaId, etapa.id, etapa.final],
    );
    await db.query(
      `INSERT INTO os_historico (empresa_id, os_id, usuario_id, etapa_anterior_id, etapa_nova_id, observacao) VALUES ($1,$2,$3,$4,$5,$6)`,
      [ator.empresaId, id, ator.id, os.etapa_id, etapa.id, observacao ?? null],
    );
    if (etapa.final) {
      await notificar(db, { empresaId: ator.empresaId, tipo: 'os_concluida', mensagem: `O.S. #${String(os.numero).padStart(4, '0')} concluída.`, link: `/os/${id}` });
    }
    await registrarAuditoria({ empresaId: ator.empresaId, usuarioId: ator.id, entidade: 'ordens_servico', entidadeId: id, acao: 'mudou_etapa', depois: { etapa: etapa.nome } }, db);
    return { ok: true };
  });
}

export async function atualizar(ator, id, d) {
  return transaction(async (db) => {
    const os = await travar(db, ator.empresaId, id);
    if (fechada(os)) throw new AppError(409, 'Esta O.S. já foi encerrada');
    if (d.responsavel_id) {
      const { rowCount } = await db.query('SELECT 1 FROM usuarios WHERE id = $1 AND empresa_id = $2 AND ativo = TRUE', [d.responsavel_id, ator.empresaId]);
      if (!rowCount) throw new AppError(400, 'Responsável inválido');
    }
    const novo = {
      responsavel_id: d.responsavel_id === undefined ? os.responsavel_id : d.responsavel_id,
      prazo_entrega: d.prazo_entrega === undefined ? os.prazo_entrega : d.prazo_entrega,
      prioridade: d.prioridade ?? os.prioridade,
      observacoes: d.observacoes === undefined ? os.observacoes : d.observacoes,
      situacao: d.situacao ?? os.situacao,
    };
    await db.query(
      `UPDATE ordens_servico SET responsavel_id=$3, prazo_entrega=$4, prioridade=$5, observacoes=$6, situacao=$7 WHERE id=$1 AND empresa_id=$2`,
      [id, ator.empresaId, novo.responsavel_id, novo.prazo_entrega, novo.prioridade, novo.observacoes, novo.situacao],
    );
    if (d.situacao && d.situacao !== os.situacao) {
      await db.query(
        'INSERT INTO os_historico (empresa_id, os_id, usuario_id, etapa_anterior_id, etapa_nova_id, observacao) VALUES ($1,$2,$3,$4,$4,$5)',
        [ator.empresaId, id, ator.id, os.etapa_id, `Situação alterada para: ${d.situacao}`],
      );
    }
    await registrarAuditoria({ empresaId: ator.empresaId, usuarioId: ator.id, entidade: 'ordens_servico', entidadeId: id, acao: 'editou', depois: { campos: Object.keys(d) } }, db);
    return { ok: true };
  });
}

export async function ocorrencia(ator, id, observacao) {
  return transaction(async (db) => {
    const os = await travar(db, ator.empresaId, id);
    await db.query(
      'INSERT INTO os_historico (empresa_id, os_id, usuario_id, etapa_anterior_id, etapa_nova_id, observacao) VALUES ($1,$2,$3,$4,$4,$5)',
      [ator.empresaId, id, ator.id, os.etapa_id, observacao],
    );
    return { ok: true };
  });
}

export async function cancelar(ator, id, motivo) {
  return transaction(async (db) => {
    const os = await travar(db, ator.empresaId, id);
    if (fechada(os)) throw new AppError(409, 'Esta O.S. já foi encerrada');
    await db.query("UPDATE ordens_servico SET situacao = 'cancelada', motivo_cancelamento = $3 WHERE id = $1 AND empresa_id = $2", [id, ator.empresaId, motivo]);
    await db.query(
      'INSERT INTO os_historico (empresa_id, os_id, usuario_id, etapa_anterior_id, etapa_nova_id, observacao) VALUES ($1,$2,$3,$4,$4,$5)',
      [ator.empresaId, id, ator.id, os.etapa_id, `O.S. cancelada: ${motivo}`],
    );
    await registrarAuditoria({ empresaId: ator.empresaId, usuarioId: ator.id, entidade: 'ordens_servico', entidadeId: id, acao: 'cancelou', depois: { motivo } }, db);
    return { ok: true };
  });
}
