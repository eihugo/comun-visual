import { Router } from 'express';
import { query } from '../../config/db.js';
import { autenticar } from '../../middlewares/auth.js';

const ABERTAS = "('ativa','pausada','retrabalho')";
const router = Router();
router.use(autenticar);

// Todos os números são da empresa autenticada (RN14)
router.get('/resumo', async (req, res) => {
  const e = req.user.empresaId;
  const hoje = new Date();
  const periodo = /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.periodo || '')
    ? req.query.periodo
    : `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const [ano, mes] = periodo.split('-').map(Number);
  const inicio = `${periodo}-01`;
  const fim = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);

  const podeVerFinanceiro = ['admin', 'gerente', 'vendedor', 'financeiro'].includes(req.user.perfil);

  const [aprov, abertos, porEtapa, prod, atras, concl, estoque, mensal, proximas] = await Promise.all([
    podeVerFinanceiro
      ? query(
          `SELECT a.decisao, COUNT(*)::int AS qtd, COALESCE(SUM(o.total),0) AS valor
             FROM orcamento_aprovacoes a JOIN orcamentos o ON o.id = a.orcamento_id
            WHERE a.empresa_id = $1 AND a.criado_em >= $2 AND a.criado_em < $3 GROUP BY a.decisao`, [e, inicio, fim])
      : Promise.resolve({ rows: [] }),
    podeVerFinanceiro
      ? query("SELECT COUNT(*)::int AS qtd FROM orcamentos WHERE empresa_id = $1 AND status IN ('enviado','alteracao_solicitada')", [e])
      : Promise.resolve({ rows: [{ qtd: 0 }] }),
    query(
      `SELECT et.id, et.nome, COUNT(os.id) FILTER (WHERE os.situacao IN ${ABERTAS})::int AS qtd
         FROM etapas_producao et LEFT JOIN ordens_servico os ON os.etapa_id = et.id AND os.empresa_id = et.empresa_id
        WHERE et.empresa_id = $1 AND et.ativo = TRUE GROUP BY et.id ORDER BY et.ordem`, [e]),
    query(`SELECT COUNT(*)::int AS qtd FROM ordens_servico WHERE empresa_id = $1 AND situacao IN ${ABERTAS}`, [e]),
    query(`SELECT COUNT(*)::int AS qtd FROM ordens_servico WHERE empresa_id = $1 AND situacao IN ${ABERTAS} AND prazo_entrega < CURRENT_DATE`, [e]),
    query("SELECT COUNT(*)::int AS qtd FROM ordens_servico WHERE empresa_id = $1 AND situacao = 'concluida' AND concluido_em >= $2 AND concluido_em < $3", [e, inicio, fim]),
    query('SELECT id, nome, unidade, estoque_atual, estoque_minimo FROM materiais WHERE empresa_id = $1 AND ativo = TRUE AND estoque_atual < estoque_minimo ORDER BY nome', [e]),
    podeVerFinanceiro
      ? query(
          `SELECT to_char(m, 'YYYY-MM') AS mes, COALESCE(SUM(o.total), 0) AS valor
             FROM generate_series($2::date - interval '5 months', $2::date, interval '1 month') m
             LEFT JOIN orcamento_aprovacoes a ON a.empresa_id = $1 AND a.decisao = 'aprovado' AND to_char(a.criado_em, 'YYYY-MM') = to_char(m, 'YYYY-MM')
             LEFT JOIN orcamentos o ON o.id = a.orcamento_id GROUP BY m ORDER BY m`, [e, inicio])
      : Promise.resolve({ rows: [] }),
    query(
      `SELECT os.id, os.numero, os.prazo_entrega, os.prioridade, c.nome AS cliente_nome, et.nome AS etapa_nome,
              (os.prazo_entrega < CURRENT_DATE) AS atrasada
         FROM ordens_servico os JOIN clientes c ON c.id = os.cliente_id LEFT JOIN etapas_producao et ON et.id = os.etapa_id
        WHERE os.empresa_id = $1 AND os.situacao IN ${ABERTAS} AND os.prazo_entrega IS NOT NULL
        ORDER BY os.prazo_entrega LIMIT 5`, [e]),
  ]);

  const pega = (d) => aprov.rows.find((r) => r.decisao === d) || { qtd: 0, valor: 0 };
  res.json({
    periodo,
    faturamento_mes: Number(pega('aprovado').valor),
    orcamentos_aprovados: pega('aprovado').qtd,
    orcamentos_recusados: pega('recusado').qtd,
    orcamentos_em_aberto: abertos.rows[0].qtd,
    os_em_producao: prod.rows[0].qtd,
    os_atrasadas: atras.rows[0].qtd,
    os_concluidas_mes: concl.rows[0].qtd,
    os_por_etapa: porEtapa.rows,
    estoque_baixo: estoque.rows,
    faturamento_mensal: mensal.rows.map((r) => ({ mes: r.mes, valor: Number(r.valor) })),
    proximas_entregas: proximas.rows,
  });
});

export default router;
