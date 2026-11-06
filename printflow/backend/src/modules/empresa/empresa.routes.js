import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { AppError } from '../../middlewares/erro.js';
import { autenticar } from '../../middlewares/auth.js';
import { permissao } from '../../middlewares/permissao.js';
import { validar } from '../../middlewares/validar.js';
import { idParam, setClause } from '../../shared/http.js';
import { registrarAuditoria } from '../../shared/auditoria.js';

const COLS = 'id, nome, cnpj, email, telefone, endereco, imposto_percentual, validade_proposta_dias';
const empresaSchema = z.object({
  nome: z.string().trim().min(2).max(150),
  cnpj: z.string().trim().max(18).nullish(),
  email: z.string().trim().email().nullish(),
  telefone: z.string().trim().max(20).nullish(),
  endereco: z.string().trim().max(500).nullish(),
  imposto_percentual: z.number().min(0).max(100),
  validade_proposta_dias: z.number().int().min(1).max(365),
}).partial().refine((d) => Object.keys(d).length > 0, 'Informe ao menos um campo');
const etapaSchema = z.object({ nome: z.string().trim().min(2).max(80), ativo: z.boolean() })
  .partial().refine((d) => Object.keys(d).length > 0, 'Informe ao menos um campo');

const router = Router();
router.use(['/empresa', '/etapas'], autenticar); // só estas rotas exigem login

router.get('/empresa', async (req, res) => {
  const { rows } = await query(`SELECT ${COLS} FROM empresas WHERE id = $1`, [req.user.empresaId]);
  res.json(rows[0]);
});

router.patch('/empresa', permissao('admin'), validar(empresaSchema), async (req, res) => {
  const s = setClause(req.body, ['nome', 'cnpj', 'email', 'telefone', 'endereco', 'imposto_percentual', 'validade_proposta_dias'], 2);
  const { rows } = await query(`UPDATE empresas SET ${s.sql} WHERE id = $1 RETURNING ${COLS}`, [req.user.empresaId, ...s.valores]);
  await registrarAuditoria({ empresaId: req.user.empresaId, usuarioId: req.user.id, entidade: 'empresas', entidadeId: req.user.empresaId, acao: 'editou', depois: { campos: s.chaves } });
  res.json(rows[0]);
});

router.get('/etapas', async (req, res) => {
  const { rows } = await query(
    'SELECT id, nome, ordem, final, ativo FROM etapas_producao WHERE empresa_id = $1 ORDER BY ordem',
    [req.user.empresaId],
  );
  res.json(rows);
});

router.patch('/etapas/:id', permissao('admin'), validar(etapaSchema), async (req, res) => {
  const s = setClause(req.body, ['nome', 'ativo']);
  const { rows } = await query(
    `UPDATE etapas_producao SET ${s.sql} WHERE id = $1 AND empresa_id = $2 RETURNING id, nome, ordem, final, ativo`,
    [idParam(req), req.user.empresaId, ...s.valores],
  );
  if (!rows[0]) throw new AppError(404, 'Etapa não encontrada');
  res.json(rows[0]);
});

export default router;
