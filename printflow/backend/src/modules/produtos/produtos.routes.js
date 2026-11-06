import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { AppError } from '../../middlewares/erro.js';
import { autenticar } from '../../middlewares/auth.js';
import { permissao } from '../../middlewares/permissao.js';
import { validar } from '../../middlewares/validar.js';
import { idParam, setClause } from '../../shared/http.js';
import { registrarAuditoria } from '../../shared/auditoria.js';

const COLS = `id, nome, categoria, descricao, unidade_medida, material_id, perda_percentual, custo_mao_obra,
  custo_maquina, custo_acabamento, custo_adicional, margem_percentual, preco_venda_fixo, tempo_producao_min, ativo`;
const num = z.number().min(0).default(0);
const base = z.object({
  nome: z.string().trim().min(2).max(150),
  categoria: z.string().trim().max(80).nullish(),
  descricao: z.string().trim().max(2000).nullish(),
  unidade_medida: z.enum(['m2', 'metro_linear', 'unidade', 'hora_maquina', 'personalizado']),
  material_id: z.number().int().positive().nullish(),
  perda_percentual: num,
  custo_mao_obra: num,
  custo_maquina: num,
  custo_acabamento: num,
  custo_adicional: num,
  margem_percentual: num,
  preco_venda_fixo: z.number().positive().nullish(),
  tempo_producao_min: z.number().int().min(0).nullish(),
});
const atualizarSchema = base.partial().extend({ ativo: z.boolean().optional() })
  .refine((d) => Object.keys(d).length > 0, 'Informe ao menos um campo');

async function validarMaterial(empresaId, materialId) {
  if (!materialId) return;
  const { rowCount } = await query('SELECT 1 FROM materiais WHERE id = $1 AND empresa_id = $2', [materialId, empresaId]);
  if (!rowCount) throw new AppError(400, 'Material inválido');
}

const router = Router();
router.use(autenticar);
const escrita = permissao('admin', 'gerente');

router.get('/', async (req, res) => {
  const { rows } = await query(`SELECT ${COLS} FROM produtos WHERE empresa_id = $1 ORDER BY nome`, [req.user.empresaId]);
  res.json(rows);
});

router.post('/', escrita, validar(base), async (req, res) => {
  const d = req.body;
  await validarMaterial(req.user.empresaId, d.material_id);
  const { rows } = await query(
    `INSERT INTO produtos (empresa_id, nome, categoria, descricao, unidade_medida, material_id, perda_percentual,
       custo_mao_obra, custo_maquina, custo_acabamento, custo_adicional, margem_percentual, preco_venda_fixo, tempo_producao_min)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING ${COLS}`,
    [req.user.empresaId, d.nome, d.categoria ?? null, d.descricao ?? null, d.unidade_medida, d.material_id ?? null,
      d.perda_percentual, d.custo_mao_obra, d.custo_maquina, d.custo_acabamento, d.custo_adicional,
      d.margem_percentual, d.preco_venda_fixo ?? null, d.tempo_producao_min ?? null],
  );
  await registrarAuditoria({ empresaId: req.user.empresaId, usuarioId: req.user.id, entidade: 'produtos', entidadeId: rows[0].id, acao: 'criou' });
  res.status(201).json(rows[0]);
});

router.patch('/:id', escrita, validar(atualizarSchema), async (req, res) => {
  const id = idParam(req);
  await validarMaterial(req.user.empresaId, req.body.material_id);
  const s = setClause(req.body, ['nome', 'categoria', 'descricao', 'unidade_medida', 'material_id', 'perda_percentual',
    'custo_mao_obra', 'custo_maquina', 'custo_acabamento', 'custo_adicional', 'margem_percentual',
    'preco_venda_fixo', 'tempo_producao_min', 'ativo']);
  const { rows } = await query(
    `UPDATE produtos SET ${s.sql} WHERE id = $1 AND empresa_id = $2 RETURNING ${COLS}`,
    [id, req.user.empresaId, ...s.valores],
  );
  if (!rows[0]) throw new AppError(404, 'Produto não encontrado');
  await registrarAuditoria({ empresaId: req.user.empresaId, usuarioId: req.user.id, entidade: 'produtos', entidadeId: id, acao: 'editou', depois: { campos: s.chaves } });
  res.json(rows[0]);
});

export default router;
