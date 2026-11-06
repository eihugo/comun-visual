import { transaction } from '../../config/db.js';
import { AppError } from '../../middlewares/erro.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { somaDias } from '../../shared/http.js';
import { notificar } from '../../shared/notificar.js';
import { proximoNumero } from '../../shared/sequencia.js';

const fmt = (n) => `#${String(n).padStart(4, '0')}`;

// Registra a decisão. Se aprovado, cria a O.S. na primeira etapa (RF05.9) — tudo na mesma transação.
async function aplicar(db, orc, decisao, comentario, ip, usuarioId) {
  await db.query(
    'INSERT INTO orcamento_aprovacoes (empresa_id, orcamento_id, decisao, comentario, ip) VALUES ($1,$2,$3,$4,$5)',
    [orc.empresa_id, orc.id, decisao, comentario ?? null, ip ?? null],
  );
  await db.query('UPDATE orcamentos SET status = $1 WHERE id = $2', [decisao, orc.id]);

  let osId = null;
  if (decisao === 'aprovado') {
    const etapa = (await db.query(
      'SELECT id FROM etapas_producao WHERE empresa_id = $1 AND ativo = TRUE ORDER BY ordem LIMIT 1', [orc.empresa_id],
    )).rows[0];
    const numero = await proximoNumero(db, orc.empresa_id, 'os');
    const os = (await db.query(
      `INSERT INTO ordens_servico (empresa_id, numero, orcamento_id, cliente_id, etapa_id, prazo_entrega)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [orc.empresa_id, numero, orc.id, orc.cliente_id, etapa?.id ?? null, orc.prazo_dias ? somaDias(orc.prazo_dias) : null],
    )).rows[0];
    osId = os.id;
    await db.query(
      `INSERT INTO os_historico (empresa_id, os_id, usuario_id, etapa_nova_id, observacao)
       VALUES ($1,$2,$3,$4,'O.S. criada a partir do orçamento aprovado')`,
      [orc.empresa_id, osId, usuarioId, etapa?.id ?? null],
    );
  }

  const msg = {
    aprovado: `Orçamento ${fmt(orc.numero)} aprovado. Ordem de serviço criada.`,
    recusado: `Proposta ${fmt(orc.numero)} recusada.`,
    alteracao_solicitada: `O cliente pediu alteração na proposta ${fmt(orc.numero)}.`,
  }[decisao];
  await notificar(db, { empresaId: orc.empresa_id, usuarioId: orc.vendedor_id, tipo: `orcamento_${decisao}`, mensagem: msg, link: `/orcamentos/${orc.id}` });
  await registrarAuditoria({ empresaId: orc.empresa_id, usuarioId, entidade: 'orcamentos', entidadeId: orc.id, acao: decisao }, db);
  return { status: decisao, os_id: osId };
}

export const decidirPorToken = (token, { decisao, comentario }, ip) =>
  transaction(async (db) => {
    const orc = (await db.query(
      `SELECT *, (valido_ate IS NOT NULL AND valido_ate < CURRENT_DATE) AS expirada
         FROM orcamentos WHERE token_publico = $1 FOR UPDATE`, [token],
    )).rows[0];
    if (!orc || orc.status === 'rascunho') throw new AppError(404, 'Proposta não encontrada');
    if (orc.status === 'substituido') throw new AppError(409, 'Existe uma versão mais nova desta proposta. Peça o novo link à empresa.');
    if (orc.status !== 'enviado') throw new AppError(409, 'Esta proposta já foi respondida');
    if (orc.expirada) throw new AppError(409, 'Esta proposta expirou. Peça uma nova à empresa.');
    return aplicar(db, orc, decisao, comentario, ip, null);
  });

export const decidirInterno = (ator, id, { decisao, comentario }) =>
  transaction(async (db) => {
    const orc = (await db.query('SELECT * FROM orcamentos WHERE id = $1 AND empresa_id = $2 FOR UPDATE', [id, ator.empresaId])).rows[0];
    if (!orc) throw new AppError(404, 'Orçamento não encontrado');
    if (!['rascunho', 'enviado'].includes(orc.status)) throw new AppError(409, 'Este orçamento já foi respondido ou substituído');
    return aplicar(db, orc, decisao, comentario ? `(registrado pela equipe) ${comentario}` : '(registrado pela equipe)', null, ator.id);
  });
