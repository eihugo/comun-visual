import { Router } from 'express';
import { z } from 'zod';
import { autenticar } from '../../middlewares/auth.js';
import { permissao } from '../../middlewares/permissao.js';
import { validar } from '../../middlewares/validar.js';
import { idParam } from '../../shared/http.js';
import * as service from './clientes.service.js';

const texto = (max) => z.string().trim().max(max).nullish();
const base = z.object({
  tipo: z.enum(['PF', 'PJ']),
  nome: z.string().trim().min(2).max(150),
  documento: texto(18),
  telefone: texto(20),
  email: z.string().trim().email().nullish(),
  endereco: texto(500),
  observacoes: texto(2000),
});
const criarSchema = base;
const atualizarSchema = base.partial().extend({ ativo: z.boolean().optional() })
  .refine((d) => Object.keys(d).length > 0, 'Informe ao menos um campo');
const historicoSchema = z.object({ descricao: z.string().trim().min(2).max(2000) });

const router = Router();
router.use(autenticar);
const escrita = permissao('admin', 'gerente', 'vendedor');

router.get('/', async (req, res) => res.json(await service.listar(req.user.empresaId, req.query)));
router.post('/', escrita, validar(criarSchema), async (req, res) => res.status(201).json(await service.criar(req.user, req.body)));
router.get('/:id', async (req, res) => res.json(await service.obter(req.user.empresaId, idParam(req))));
router.patch('/:id', escrita, validar(atualizarSchema), async (req, res) => res.json(await service.atualizar(req.user, idParam(req), req.body)));
router.delete('/:id', permissao('admin', 'gerente'), async (req, res) => { await service.excluir(req.user, idParam(req)); res.status(204).end(); });
router.get('/:id/historico', async (req, res) => res.json(await service.listarHistorico(req.user.empresaId, idParam(req))));
router.post('/:id/historico', escrita, validar(historicoSchema), async (req, res) =>
  res.status(201).json(await service.addHistorico(req.user, idParam(req), req.body.descricao)));

export default router;
