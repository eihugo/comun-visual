import { Router } from 'express';
import { z } from 'zod';
import { autenticar } from '../../middlewares/auth.js';
import { permissao } from '../../middlewares/permissao.js';
import { validar } from '../../middlewares/validar.js';
import { idParam } from '../../shared/http.js';
import * as service from './os.service.js';

const etapaSchema = z.object({ etapa_id: z.number().int().positive(), observacao: z.string().trim().max(1000).nullish() });
const atualizarSchema = z.object({
  responsavel_id: z.number().int().positive().nullable(),
  prazo_entrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  prioridade: z.enum(['baixa', 'normal', 'alta', 'urgente']),
  observacoes: z.string().trim().max(2000).nullable(),
  situacao: z.enum(['ativa', 'pausada', 'retrabalho']),
}).partial().refine((d) => Object.keys(d).length > 0, 'Informe ao menos um campo');
const ocorrenciaSchema = z.object({ observacao: z.string().trim().min(2).max(1000) });
const cancelarSchema = z.object({ motivo: z.string().trim().min(3).max(500) }); // RN11

const router = Router();
router.use(autenticar);
const operar = permissao('admin', 'gerente', 'designer', 'producao');

router.get('/', async (req, res) => res.json(await service.listar(req.user.empresaId, req.query)));
router.get('/:id', async (req, res) => res.json(await service.obter(req.user.empresaId, idParam(req))));
router.patch('/:id/etapa', operar, validar(etapaSchema), async (req, res) => res.json(await service.mudarEtapa(req.user, idParam(req), req.body)));
router.patch('/:id', permissao('admin', 'gerente'), validar(atualizarSchema), async (req, res) => res.json(await service.atualizar(req.user, idParam(req), req.body)));
router.post('/:id/ocorrencias', operar, validar(ocorrenciaSchema), async (req, res) => res.status(201).json(await service.ocorrencia(req.user, idParam(req), req.body.observacao)));
router.post('/:id/cancelar', permissao('admin', 'gerente'), validar(cancelarSchema), async (req, res) => res.json(await service.cancelar(req.user, idParam(req), req.body.motivo)));

export default router;
