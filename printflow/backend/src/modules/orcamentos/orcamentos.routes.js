import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { autenticar } from '../../middlewares/auth.js';
import { permissao } from '../../middlewares/permissao.js';
import { validar } from '../../middlewares/validar.js';
import { idParam } from '../../shared/http.js';
import { gerarPropostaPdf } from '../../shared/pdf.js';
import { db } from './db.js';
import * as service from './orcamentos.service.js';
import { decidirInterno } from './aprovacao.service.js';

const itemSchema = z.object({
  produto_id: z.number().int().positive(),
  material_id: z.number().int().positive().nullish(),
  descricao: z.string().trim().max(500).nullish(),
  largura: z.number().positive().nullish(),
  altura: z.number().positive().nullish(),
  quantidade: z.number().positive(),
  acabamento: z.string().trim().max(100).nullish(),
});
const orcSchema = z.object({
  cliente_id: z.number().int().positive(),
  prazo_dias: z.number().int().min(0).max(365).nullish(),
  desconto_percentual: z.number().min(0).max(100).default(0),
  observacoes: z.string().trim().max(2000).nullish(),
  itens: z.array(itemSchema).min(1).max(50),
});
const calcSchema = z.object({ itens: z.array(itemSchema).min(1).max(50), desconto_percentual: z.number().min(0).max(100).default(0) });
const decisaoSchema = z.object({ decisao: z.enum(['aprovado', 'recusado']), comentario: z.string().trim().max(1000).nullish() });

const router = Router();
router.use(autenticar);
const leitura = permissao('admin', 'gerente', 'vendedor', 'financeiro');
const escrita = permissao('admin', 'gerente', 'vendedor');

router.get('/', leitura, async (req, res) => res.json(await service.listar(req.user.empresaId, req.query)));

// Prévia do cálculo (não grava nada) — usada pela tela para mostrar o total em tempo real
router.post('/calcular', escrita, validar(calcSchema), async (req, res) => {
  const { itens, subtotal } = await service.calcular(db, req.user.empresaId, req.body.itens);
  res.json({ itens, subtotal, total: service.totalComDesconto(subtotal, req.body.desconto_percentual) });
});

router.post('/', escrita, validar(orcSchema), async (req, res) => res.status(201).json(await service.criar(req.user, req.body)));
router.get('/:id', leitura, async (req, res) => res.json(await service.obterCompleto(db, req.user.empresaId, idParam(req))));
router.patch('/:id', escrita, validar(orcSchema), async (req, res) => res.json(await service.atualizar(req.user, idParam(req), req.body)));
router.post('/:id/enviar', escrita, async (req, res) => res.json(await service.enviar(req.user, idParam(req))));
router.post('/:id/nova-versao', escrita, async (req, res) => res.status(201).json(await service.novaVersao(req.user, idParam(req))));
router.post('/:id/decisao-interna', escrita, validar(decisaoSchema), async (req, res) =>
  res.json(await decidirInterno(req.user, idParam(req), req.body)));

router.get('/:id/pdf', leitura, async (req, res) => {
  const o = await service.obterCompleto(db, req.user.empresaId, idParam(req));
  const empresa = (await query('SELECT nome, telefone, email, endereco FROM empresas WHERE id = $1', [req.user.empresaId])).rows[0];
  gerarPropostaPdf(res, { empresa, orcamento: o, itens: o.itens });
});

export default router;
