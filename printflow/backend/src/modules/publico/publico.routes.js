import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { AppError } from '../../middlewares/erro.js';
import { validar } from '../../middlewares/validar.js';
import { gerarPropostaPdf } from '../../shared/pdf.js';
import { decidirPorToken } from '../orcamentos/aprovacao.service.js';

const router = Router();
router.use(rateLimit({ windowMs: 60 * 1000, limit: process.env.VITEST ? 10000 : 60, message: { erro: 'Muitas requisições' } }));

const decisaoSchema = z.object({
  decisao: z.enum(['aprovado', 'recusado', 'alteracao_solicitada']),
  comentario: z.string().trim().max(1000).nullish(),
});

// Só devolve dados de PREÇO. Custos e margem nunca saem daqui.
async function carregar(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new AppError(404, 'Proposta não encontrada');
  const o = (await query(
    `SELECT o.id, o.numero, o.versao, o.status, o.subtotal, o.total, o.desconto_percentual, o.prazo_dias, o.valido_ate,
            o.observacoes, o.criado_em, (o.valido_ate IS NOT NULL AND o.valido_ate < CURRENT_DATE) AS expirada,
            c.nome AS cliente_nome, e.id AS empresa_id, e.nome AS empresa_nome, e.telefone, e.email, e.endereco
       FROM orcamentos o JOIN clientes c ON c.id = o.cliente_id JOIN empresas e ON e.id = o.empresa_id
      WHERE o.token_publico = $1`, [token],
  )).rows[0];
  if (!o || o.status === 'rascunho') throw new AppError(404, 'Proposta não encontrada');
  const itens = (await query(
    `SELECT COALESCE(i.descricao, p.nome) AS descricao, p.nome AS produto_nome, i.largura, i.altura, i.quantidade,
            i.acabamento, i.preco_total
       FROM orcamento_itens i JOIN produtos p ON p.id = i.produto_id WHERE i.orcamento_id = $1 ORDER BY i.id`, [o.id],
  )).rows;
  return { o, itens };
}

router.get('/:token', async (req, res) => {
  const { o, itens } = await carregar(req.params.token);
  const { id, empresa_id, empresa_nome, telefone, email, endereco, ...orcamento } = o;
  res.json({ empresa: { nome: empresa_nome, telefone, email, endereco }, orcamento, itens });
});

router.get('/:token/pdf', async (req, res) => {
  const { o, itens } = await carregar(req.params.token);
  gerarPropostaPdf(res, {
    empresa: { nome: o.empresa_nome, telefone: o.telefone, email: o.email, endereco: o.endereco },
    orcamento: o, itens,
  });
});

router.post('/:token/decisao', validar(decisaoSchema), async (req, res) => {
  await carregar(req.params.token);
  res.json(await decidirPorToken(req.params.token, req.body, req.ip));
});

export default router;
