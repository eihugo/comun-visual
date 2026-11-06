import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { AppError } from '../../middlewares/erro.js';
import { autenticar } from '../../middlewares/auth.js';
import { permissao } from '../../middlewares/permissao.js';
import { validar } from '../../middlewares/validar.js';
import { idParam, setClause } from '../../shared/http.js';
import { registrarAuditoria } from '../../shared/auditoria.js';

const COLS = 'id, nome, unidade, custo_unitario, estoque_minimo, estoque_atual, ativo';
const base = z.object({
  nome: z.string().trim().min(2).max(150),
  unidade: z.string().trim().min(1).max(10),
  custo_unitario: z.number().min(0),
  estoque_minimo: z.number().min(0).default(0),
});
const atualizarSchema = base.partial().extend({ ativo: z.boolean().optional() })
  .refine((d) => Object.keys(d).length > 0, 'Informe ao menos um campo');

const router = Router();
router.use(autenticar);
const escrita = permissao('admin', 'gerente');

router.get('/', async (req, res) => {
  const { rows } = await query(`SELECT ${COLS} FROM materiais WHERE empresa_id = $1 ORDER BY nome`, [req.user.empresaId]);
  res.json(rows);
});

router.post('/', escrita, validar(base), async (req, res) => {
  const d = req.body;
  const { rows } = await query(
    `INSERT INTO materiais (empresa_id, nome, unidade, custo_unitario, estoque_minimo)
     VALUES ($1,$2,$3,$4,$5) RETURNING ${COLS}`,
    [req.user.empresaId, d.nome, d.unidade, d.custo_unitario, d.estoque_minimo],
  );
  await registrarAuditoria({ empresaId: req.user.empresaId, usuarioId: req.user.id, entidade: 'materiais', entidadeId: rows[0].id, acao: 'criou' });
  res.status(201).json(rows[0]);
});

router.patch('/:id', escrita, validar(atualizarSchema), async (req, res) => {
  const id = idParam(req);
  const s = setClause(req.body, ['nome', 'unidade', 'custo_unitario', 'estoque_minimo', 'ativo']);
  const { rows } = await query(
    `UPDATE materiais SET ${s.sql} WHERE id = $1 AND empresa_id = $2 RETURNING ${COLS}`,
    [id, req.user.empresaId, ...s.valores],
  );
  if (!rows[0]) throw new AppError(404, 'Material não encontrado');
  await registrarAuditoria({ empresaId: req.user.empresaId, usuarioId: req.user.id, entidade: 'materiais', entidadeId: id, acao: 'editou', depois: { campos: s.chaves } });
  res.json(rows[0]);
});

export default router;
