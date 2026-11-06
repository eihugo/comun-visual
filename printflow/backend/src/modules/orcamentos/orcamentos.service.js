import crypto from 'node:crypto';
import { query, transaction } from '../../config/db.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middlewares/erro.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { arredondar, calcularItem } from '../../shared/calculo.js';
import { somaDias } from '../../shared/http.js';
import { proximoNumero } from '../../shared/sequencia.js';

const novoToken = () => crypto.randomBytes(32).toString('hex');

// Calcula todos os itens NO SERVIDOR (o front nunca manda preço). Valida produto e material da empresa.
export async function calcular(db, empresaId, itens) {
  const emp = (await db.query('SELECT imposto_percentual FROM empresas WHERE id = $1', [empresaId])).rows[0];
  const produtoIds = [...new Set(itens.map((i) => i.produto_id))];
  const produtos = (await db.query(
    'SELECT * FROM produtos WHERE empresa_id = $1 AND id = ANY($2::bigint[]) AND ativo = TRUE', [empresaId, produtoIds],
  )).rows;
  const pMap = new Map(produtos.map((p) => [Number(p.id), p]));

  const matIds = [...new Set(itens.map((i) => i.material_id ?? pMap.get(i.produto_id)?.material_id).filter(Boolean).map(Number))];
  const mats = matIds.length
    ? (await db.query('SELECT * FROM materiais WHERE empresa_id = $1 AND id = ANY($2::bigint[])', [empresaId, matIds])).rows
    : [];
  const mMap = new Map(mats.map((m) => [Number(m.id), m]));

  const calculados = itens.map((i) => {
    const produto = pMap.get(i.produto_id);
    if (!produto) throw new AppError(400, 'Produto inválido ou inativo');
    if (i.material_id && !mMap.has(Number(i.material_id))) throw new AppError(400, 'Material inválido');
    if (produto.unidade_medida === 'm2' && !(i.largura && i.altura)) throw new AppError(400, `Informe largura e altura para "${produto.nome}"`);
    if (produto.unidade_medida === 'metro_linear' && !i.largura) throw new AppError(400, `Informe o comprimento para "${produto.nome}"`);
    const material = mMap.get(Number(i.material_id ?? produto.material_id));
    const calc = calcularItem({
      produto, material, largura: i.largura, altura: i.altura,
      quantidade: i.quantidade, impostoPercentual: emp.imposto_percentual,
    });
    return {
      produto_id: i.produto_id, produto_nome: produto.nome, material_id: material ? Number(material.id) : null,
      descricao: i.descricao ?? null, largura: i.largura ?? null, altura: i.altura ?? null,
      quantidade: i.quantidade, acabamento: i.acabamento ?? null, ...calc,
    };
  });
  const subtotal = arredondar(calculados.reduce((s, i) => s + i.preco_total, 0));
  return { itens: calculados, subtotal };
}

export const totalComDesconto = (subtotal, desc) => arredondar(subtotal * (1 - desc / 100));

function checarDesconto(ator, desc) {
  if (desc > ator.limiteDesconto) {
    throw new AppError(403, `Desconto acima do seu limite (${ator.limiteDesconto}%). Peça a um administrador.`);
  }
}

async function validarCliente(db, empresaId, clienteId) {
  const { rowCount } = await db.query(
    'SELECT 1 FROM clientes WHERE id = $1 AND empresa_id = $2 AND deletado_em IS NULL', [clienteId, empresaId],
  );
  if (!rowCount) throw new AppError(400, 'Cliente inválido');
}

async function inserirItens(db, empresaId, orcId, itens) {
  for (const i of itens) {
    await db.query(
      `INSERT INTO orcamento_itens (empresa_id, orcamento_id, produto_id, material_id, descricao, largura, altura,
         quantidade, area_total, acabamento, custo_material, custo_producao, custo_total, preco_unitario, preco_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [empresaId, orcId, i.produto_id, i.material_id, i.descricao, i.largura, i.altura, i.quantidade, i.area_total,
        i.acabamento, i.custo_material, i.custo_producao, i.custo_total, i.preco_unitario, i.preco_total],
    );
  }
}

export async function obterCompleto(db, empresaId, id) {
  const o = (await db.query(
    `SELECT o.*, c.nome AS cliente_nome, u.nome AS vendedor_nome
       FROM orcamentos o JOIN clientes c ON c.id = o.cliente_id JOIN usuarios u ON u.id = o.vendedor_id
      WHERE o.id = $1 AND o.empresa_id = $2`, [id, empresaId],
  )).rows[0];
  if (!o) throw new AppError(404, 'Orçamento não encontrado');
  const itens = (await db.query(
    `SELECT i.*, p.nome AS produto_nome FROM orcamento_itens i JOIN produtos p ON p.id = i.produto_id
      WHERE i.orcamento_id = $1 AND i.empresa_id = $2 ORDER BY i.id`, [id, empresaId],
  )).rows;
  const aprovacoes = (await db.query(
    'SELECT decisao, comentario, criado_em FROM orcamento_aprovacoes WHERE orcamento_id = $1 AND empresa_id = $2 ORDER BY criado_em',
    [id, empresaId],
  )).rows;
  const os = (await db.query('SELECT id, numero FROM ordens_servico WHERE orcamento_id = $1 AND empresa_id = $2', [id, empresaId])).rows[0] || null;
  return { ...o, itens, aprovacoes, os, link_proposta: `${env.frontendUrl}/proposta/${o.token_publico}` };
}

export async function listar(empresaId, { status, cliente_id, q }) {
  const params = [empresaId];
  let where = 'o.empresa_id = $1';
  if (status) { params.push(status); where += ` AND o.status = $${params.length}`; }
  if (cliente_id) { params.push(Number(cliente_id) || 0); where += ` AND o.cliente_id = $${params.length}`; }
  if (q) { params.push(`%${q}%`); where += ` AND (c.nome ILIKE $${params.length} OR o.numero::text = btrim($${params.length}, '%'))`; }
  const { rows } = await query(
    `SELECT o.id, o.numero, o.versao, o.status, o.total, o.criado_em, o.valido_ate, c.nome AS cliente_nome, u.nome AS vendedor_nome
       FROM orcamentos o JOIN clientes c ON c.id = o.cliente_id JOIN usuarios u ON u.id = o.vendedor_id
      WHERE ${where} ORDER BY o.criado_em DESC LIMIT 200`, params,
  );
  return rows;
}

export async function criar(ator, d) {
  return transaction(async (db) => {
    await validarCliente(db, ator.empresaId, d.cliente_id);
    checarDesconto(ator, d.desconto_percentual);
    const { itens, subtotal } = await calcular(db, ator.empresaId, d.itens);
    const numero = await proximoNumero(db, ator.empresaId, 'orcamento');
    const dias = (await db.query('SELECT validade_proposta_dias FROM empresas WHERE id = $1', [ator.empresaId])).rows[0].validade_proposta_dias;
    const { rows } = await db.query(
      `INSERT INTO orcamentos (empresa_id, numero, cliente_id, vendedor_id, prazo_dias, desconto_percentual,
         desconto_autorizado_por, subtotal, total, observacoes, token_publico, valido_ate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [ator.empresaId, numero, d.cliente_id, ator.id, d.prazo_dias ?? null, d.desconto_percentual,
        d.desconto_percentual > 0 ? ator.id : null, subtotal, totalComDesconto(subtotal, d.desconto_percentual),
        d.observacoes ?? null, novoToken(), somaDias(dias)],
    );
    await inserirItens(db, ator.empresaId, rows[0].id, itens);
    await registrarAuditoria({ empresaId: ator.empresaId, usuarioId: ator.id, entidade: 'orcamentos', entidadeId: rows[0].id, acao: 'criou' }, db);
    return obterCompleto(db, ator.empresaId, rows[0].id);
  });
}

export async function atualizar(ator, id, d) {
  return transaction(async (db) => {
    const o = (await db.query('SELECT status FROM orcamentos WHERE id = $1 AND empresa_id = $2 FOR UPDATE', [id, ator.empresaId])).rows[0];
    if (!o) throw new AppError(404, 'Orçamento não encontrado');
    if (o.status !== 'rascunho') throw new AppError(409, 'Só rascunhos podem ser editados. Crie uma nova versão.');
    await validarCliente(db, ator.empresaId, d.cliente_id);
    checarDesconto(ator, d.desconto_percentual);
    const { itens, subtotal } = await calcular(db, ator.empresaId, d.itens);
    await db.query(
      `UPDATE orcamentos SET cliente_id=$3, prazo_dias=$4, desconto_percentual=$5, desconto_autorizado_por=$6,
         subtotal=$7, total=$8, observacoes=$9 WHERE id=$1 AND empresa_id=$2`,
      [id, ator.empresaId, d.cliente_id, d.prazo_dias ?? null, d.desconto_percentual,
        d.desconto_percentual > 0 ? ator.id : null, subtotal, totalComDesconto(subtotal, d.desconto_percentual), d.observacoes ?? null],
    );
    await db.query('DELETE FROM orcamento_itens WHERE orcamento_id = $1 AND empresa_id = $2', [id, ator.empresaId]);
    await inserirItens(db, ator.empresaId, id, itens);
    await registrarAuditoria({ empresaId: ator.empresaId, usuarioId: ator.id, entidade: 'orcamentos', entidadeId: id, acao: 'editou' }, db);
    return obterCompleto(db, ator.empresaId, id);
  });
}

export async function enviar(ator, id) {
  return transaction(async (db) => {
    const dias = (await db.query('SELECT validade_proposta_dias FROM empresas WHERE id = $1', [ator.empresaId])).rows[0].validade_proposta_dias;
    const { rows } = await db.query(
      `UPDATE orcamentos SET status = 'enviado', valido_ate = $3
        WHERE id = $1 AND empresa_id = $2 AND status = 'rascunho' RETURNING id`,
      [id, ator.empresaId, somaDias(dias)],
    );
    if (!rows[0]) throw new AppError(409, 'Só é possível enviar orçamentos em rascunho');
    await registrarAuditoria({ empresaId: ator.empresaId, usuarioId: ator.id, entidade: 'orcamentos', entidadeId: id, acao: 'enviou' }, db);
    return obterCompleto(db, ator.empresaId, id);
  });
}

// RN04: alteração em proposta já enviada = nova versão (a antiga fica "substituido")
export async function novaVersao(ator, id) {
  return transaction(async (db) => {
    const o = (await db.query('SELECT * FROM orcamentos WHERE id = $1 AND empresa_id = $2 FOR UPDATE', [id, ator.empresaId])).rows[0];
    if (!o) throw new AppError(404, 'Orçamento não encontrado');
    if (!['enviado', 'recusado', 'alteracao_solicitada', 'expirado'].includes(o.status)) {
      throw new AppError(409, 'Esta proposta não pode gerar nova versão (aprovada, em rascunho ou já substituída)');
    }
    const novo = (await db.query(
      `INSERT INTO orcamentos (empresa_id, numero, versao, cliente_id, vendedor_id, prazo_dias, desconto_percentual,
         desconto_autorizado_por, subtotal, total, observacoes, token_publico)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [o.empresa_id, o.numero, o.versao + 1, o.cliente_id, ator.id, o.prazo_dias, o.desconto_percentual,
        o.desconto_autorizado_por, o.subtotal, o.total, o.observacoes, novoToken()],
    )).rows[0];
    await db.query(
      `INSERT INTO orcamento_itens (empresa_id, orcamento_id, produto_id, material_id, descricao, largura, altura,
         quantidade, area_total, acabamento, custo_material, custo_producao, custo_total, preco_unitario, preco_total)
       SELECT empresa_id, $2, produto_id, material_id, descricao, largura, altura, quantidade, area_total, acabamento,
              custo_material, custo_producao, custo_total, preco_unitario, preco_total
         FROM orcamento_itens WHERE orcamento_id = $1 AND empresa_id = $3`,
      [id, novo.id, ator.empresaId],
    );
    await db.query("UPDATE orcamentos SET status = 'substituido' WHERE id = $1", [id]);
    await registrarAuditoria({ empresaId: ator.empresaId, usuarioId: ator.id, entidade: 'orcamentos', entidadeId: novo.id, acao: 'nova_versao', antes: { de: id } }, db);
    return obterCompleto(db, ator.empresaId, novo.id);
  });
}
