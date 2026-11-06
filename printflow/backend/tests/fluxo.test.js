import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';

const s = Date.now();

describe('Fluxo completo do MVP', () => {
  afterAll(() => pool.end());

  it('cliente → orçamento → link público → aprovação → O.S. → estoque → dashboard', async () => {
    const a = request.agent(app);
    const reg = await a.post('/api/v1/auth/registrar-empresa').send({
      empresa: { nome: `Fluxo ${s}` }, admin: { nome: 'Dono', email: `dono-${s}@teste.com`, senha: 'senha12345' },
    });
    expect(reg.status).toBe(201);
    await a.patch('/api/v1/empresa').send({ imposto_percentual: 6 });

    const cli = (await a.post('/api/v1/clientes').send({ tipo: 'PJ', nome: 'Padaria Central', documento: String(s).slice(-14) })).body;
    const mat = (await a.post('/api/v1/materiais').send({ nome: 'Lona 440g', unidade: 'm2', custo_unitario: 12, estoque_minimo: 20 })).body;
    const prod = (await a.post('/api/v1/produtos').send({
      nome: 'Banner em lona', unidade_medida: 'm2', material_id: Number(mat.id), perda_percentual: 10,
      custo_mao_obra: 8, custo_maquina: 4, custo_adicional: 20, margem_percentual: 60,
    })).body;
    expect(prod.id).toBeTruthy();

    const orc = await a.post('/api/v1/orcamentos').send({
      cliente_id: Number(cli.id), prazo_dias: 5, desconto_percentual: 0,
      itens: [{ produto_id: Number(prod.id), largura: 3, altura: 1.5, quantidade: 2 }],
    });
    expect(orc.status).toBe(201);
    expect(Number(orc.body.total)).toBe(418.57);

    // enviar e aprovar pelo link público (sem login)
    await a.post(`/api/v1/orcamentos/${orc.body.id}/enviar`).expect(200);
    const token = orc.body.token_publico;
    const pub = await request(app).get(`/api/v1/public/propostas/${token}`);
    expect(pub.status).toBe(200);
    expect(JSON.stringify(pub.body)).not.toContain('custo'); // nunca vaza custo
    const dec = await request(app).post(`/api/v1/public/propostas/${token}/decisao`).send({ decisao: 'aprovado' });
    expect(dec.status).toBe(200);
    expect(dec.body.os_id).toBeTruthy();
    await request(app).post(`/api/v1/public/propostas/${token}/decisao`).send({ decisao: 'recusado' }).expect(409);

    // O.S. nasce na primeira etapa; avança
    const os = (await a.get(`/api/v1/os/${dec.body.os_id}`)).body;
    expect(os.etapa_nome).toBe('Aguardando Arte');
    const etapas = (await a.get('/api/v1/etapas')).body;
    await a.patch(`/api/v1/os/${os.id}/etapa`).send({ etapa_id: Number(etapas[1].id) }).expect(200);

    // estoque: entrada, saída vinculada à O.S., bloqueio de saldo negativo e alerta
    await a.post('/api/v1/estoque/movimentacoes').send({ material_id: Number(mat.id), tipo: 'entrada', quantidade: 30 }).expect(201);
    await a.post('/api/v1/estoque/movimentacoes').send({ material_id: Number(mat.id), tipo: 'saida', quantidade: 15, os_id: Number(os.id) }).expect(201);
    await a.post('/api/v1/estoque/movimentacoes').send({ material_id: Number(mat.id), tipo: 'saida', quantidade: 100 }).expect(409);

    const dash = (await a.get('/api/v1/dashboard/resumo')).body;
    expect(dash.faturamento_mes).toBe(418.57);
    expect(dash.os_em_producao).toBe(1);
    expect(dash.estoque_baixo).toHaveLength(1);
    const notif = (await a.get('/api/v1/notificacoes')).body;
    expect(notif.notificacoes.some((n) => n.tipo === 'estoque_baixo')).toBe(true);

    const pdf = await a.get(`/api/v1/orcamentos/${orc.body.id}/pdf`);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });

  it('isolamento: empresa B não vê cliente/orçamento da empresa A', async () => {
    const A = request.agent(app);
    const B = request.agent(app);
    await A.post('/api/v1/auth/registrar-empresa').send({ empresa: { nome: `IsoA ${s}` }, admin: { nome: 'Admin A', email: `isoa-${s}@t.com`, senha: 'senha12345' } });
    await B.post('/api/v1/auth/registrar-empresa').send({ empresa: { nome: `IsoB ${s}` }, admin: { nome: 'Admin B', email: `isob-${s}@t.com`, senha: 'senha12345' } });
    const cli = (await A.post('/api/v1/clientes').send({ tipo: 'PF', nome: 'Cliente da A' })).body;
    await B.get(`/api/v1/clientes/${cli.id}`).expect(404);
    await B.patch(`/api/v1/clientes/${cli.id}`).send({ nome: 'Invadido' }).expect(404);
    const orc = await B.post('/api/v1/orcamentos').send({ cliente_id: Number(cli.id), itens: [{ produto_id: 1, quantidade: 1 }] });
    expect(orc.status).toBe(400); // cliente de outra empresa é rejeitado
    expect((await B.get('/api/v1/clientes')).body).toHaveLength(0);
  });
});
