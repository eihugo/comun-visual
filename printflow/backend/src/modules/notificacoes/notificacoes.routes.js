import { Router } from 'express';
import { query } from '../../config/db.js';
import { autenticar } from '../../middlewares/auth.js';
import { idParam } from '../../shared/http.js';

const router = Router();
router.use(autenticar);
const VISIVEL = '(usuario_id IS NULL OR usuario_id = $2)';

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT id, tipo, mensagem, link, lida, criado_em FROM notificacoes
      WHERE empresa_id = $1 AND ${VISIVEL} ORDER BY criado_em DESC LIMIT 50`, [req.user.empresaId, req.user.id],
  );
  res.json({ notificacoes: rows, nao_lidas: rows.filter((n) => !n.lida).length });
});

router.post('/:id/lida', async (req, res) => {
  await query(`UPDATE notificacoes SET lida = TRUE WHERE id = $3 AND empresa_id = $1 AND ${VISIVEL}`, [req.user.empresaId, req.user.id, idParam(req)]);
  res.status(204).end();
});

router.post('/lidas', async (req, res) => {
  await query(`UPDATE notificacoes SET lida = TRUE WHERE empresa_id = $1 AND ${VISIVEL}`, [req.user.empresaId, req.user.id]);
  res.status(204).end();
});

export default router;
