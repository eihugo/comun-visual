import { Router } from 'express';
import { autenticar } from '../../middlewares/auth.js';
import { permissao } from '../../middlewares/permissao.js';
import { validar } from '../../middlewares/validar.js';
import { AppError } from '../../middlewares/erro.js';
import { atualizarUsuarioSchema, criarUsuarioSchema } from './usuarios.schema.js';
import * as service from './usuarios.service.js';

const router = Router();
router.use(autenticar);

router.get('/', permissao('admin', 'gerente'), async (req, res) => {
  res.json(await service.listar(req.user.empresaId));
});

router.post('/', permissao('admin'), validar(criarUsuarioSchema), async (req, res) => {
  res.status(201).json(await service.criar(req.user, req.body));
});

router.patch('/:id', permissao('admin'), validar(atualizarUsuarioSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError(400, 'ID inválido');
  res.json(await service.atualizar(req.user, id, req.body));
});

export default router;
