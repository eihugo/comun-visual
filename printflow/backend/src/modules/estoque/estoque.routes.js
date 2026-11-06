import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../../config/db.js';
import { AppError } from '../../middlewares/erro.js';
import { autenticar } from '../../middlewares/auth.js';
import { permissao } from '../../middlewares/permissao.js';
import { validar } from '../../middlewares/validar.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { notificar } from '../../shared/notificar.js';

const movSchema = z.object({
  material_id: z.number().int().positive(),
  tipo: z.enum(['entrada', 'saida']),
  quantidade: z.number().positive(),
  custo_unitario: z.number().min(0).nullish(),
  os_id: z.number().int().positive().nullish(),
  observacao: z.string().trim().max(500).nullish(),
});
const arred3 = (n) => Math.round(n * 1000) / 1000;

const router = Router();
router.use(autenticar);

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT id, nome, unidade, estoque_atual, estoque_minimo, custo_unitario, (estoque_atual < estoque_minimo) AS abaixo_minimo
       FROM materiais WHERE empresa_id = $1 AND ativo = TRUE ORDER BY nome`, [req.user.empresaId],
  );
  res.json(rows);
});

router.get('/movimentacoes', async (req, res) => {
  const params = [req.user.empresaId];
  let where = 'mv.empresa_id = $1';
  if (req.query.material_id) { params.push(Number(req.query.material_id) || 0); where += ` AND mv.material_id = $${params.length}`; }
  if (req.query.os_id) { params.push(Number(req.query.os_id) || 0); where += ` AND mv.os_id = $${params.length}`; }
  const { rows } = await query(
    `SELECT mv.id, mv.tipo, mv.quantidade, mv.custo_unitario, mv.observacao, mv.criado_em, mv.os_id,
            m.nome AS material, m.unidade, u.nome AS usuario
       FROM movimentacoes_estoque mv JOIN materiais m ON m.id = mv.material_id LEFT JOIN usuarios u ON u.id = mv.usuario_id
      WHERE ${where} ORDER BY mv.criado_em DESC, mv.id DESC LIMIT 200`, params,
  );
  res.json(rows);
});

// RN07: o saldo só muda junto com uma movimentação registrada (mesma transação, linha travada)
router.post('/movimentacoes', permissao('admin', 'gerente', 'producao'), validar(movSchema), async (req, res) => {
  const d = req.body;
  const ator = req.user;
  const resultado = await transaction(async (db) => {
    const m = (await db.query(
      'SELECT id, nome, unidade, estoque_atual, estoque_minimo FROM materiais WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
      [d.material_id, ator.empresaId],
    )).rows[0];
    if (!m) throw new AppError(404, 'Material não encontrado');
    if (d.os_id) {
      const { rowCount } = await db.query('SELECT 1 FROM ordens_servico WHERE id = $1 AND empresa_id = $2', [d.os_id, ator.empresaId]);
      if (!rowCount) throw new AppError(400, 'O.S. inválida');
    }
    const atual = Number(m.estoque_atual);
    const novo = arred3(d.tipo === 'entrada' ? atual + d.quantidade : atual - d.quantidade);
    if (novo < 0) throw new AppError(409, `Estoque insuficiente: saldo atual de ${atual} ${m.unidade}`); // RN08 (bloqueio)

    const mov = (await db.query(
      `INSERT INTO movimentacoes_estoque (empresa_id, material_id, tipo, quantidade, custo_unitario, os_id, usuario_id, observacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [ator.empresaId, d.material_id, d.tipo, d.quantidade, d.custo_unitario ?? null, d.os_id ?? null, ator.id, d.observacao ?? null],
    )).rows[0];
    await db.query('UPDATE materiais SET estoque_atual = $3 WHERE id = $1 AND empresa_id = $2', [d.material_id, ator.empresaId, novo]);

    if (d.tipo === 'saida' && novo < Number(m.estoque_minimo)) {
      await notificar(db, { empresaId: ator.empresaId, tipo: 'estoque_baixo', mensagem: `Estoque baixo: ${m.nome} (${novo} ${m.unidade}).`, link: '/estoque' });
    }
    await registrarAuditoria({ empresaId: ator.empresaId, usuarioId: ator.id, entidade: 'materiais', entidadeId: d.material_id, acao: `estoque_${d.tipo}`, depois: { quantidade: d.quantidade, saldo: novo } }, db);
    return { id: mov.id, saldo: novo };
  });
  res.status(201).json(resultado);
});

export default router;
