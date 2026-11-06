import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { autenticar } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import { loginSchema, registrarSchema } from './auth.schema.js';
import * as service from './auth.service.js';

const router = Router();

// Em produção front e back ficam em domínios diferentes: cookie precisa de SameSite=None + Secure
const opcoesCookie = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'none' : 'lax',
  maxAge: 8 * 60 * 60 * 1000,
};

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.VITEST ? 1000 : 10,
  message: { erro: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

router.post('/registrar-empresa', limiteLogin, validar(registrarSchema), async (req, res) => {
  const usuario = await service.registrarEmpresa(req.body);
  res.cookie('token', service.gerarToken(usuario.id, usuario.token_versao), opcoesCookie);
  res.status(201).json({ usuario });
});

router.post('/login', limiteLogin, validar(loginSchema), async (req, res) => {
  const usuario = await service.login(req.body);
  res.cookie('token', service.gerarToken(usuario.id, usuario.token_versao), opcoesCookie);
  res.json({ usuario });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { ...opcoesCookie, maxAge: undefined });
  res.status(204).end();
});

router.get('/me', autenticar, (req, res) => {
  res.json({ usuario: req.user });
});

export default router;
