import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';

const sufixo = Date.now();

async function novaEmpresa(nome) {
  const agent = request.agent(app); // guarda o cookie da sessão
  const r = await agent.post('/api/v1/auth/registrar-empresa').send({
    empresa: { nome: `Empresa ${nome} ${sufixo}` },
    admin: { nome: `Admin ${nome}`, email: `admin-${nome}-${sufixo}@teste.com`, senha: 'senha12345' },
  });
  expect(r.status).toBe(201);
  return { agent, usuarioId: r.body.usuario.id };
}

describe('Multiempresa e autenticação', () => {
  afterAll(() => pool.end());

  it('bloqueia acesso sem login', async () => {
    const r = await request(app).get('/api/v1/usuarios');
    expect(r.status).toBe(401);
  });

  it('empresa A só enxerga os próprios usuários', async () => {
    const A = await novaEmpresa('A');
    await novaEmpresa('B');
    const r = await A.agent.get('/api/v1/usuarios');
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0].id).toBe(A.usuarioId);
  });

  it('empresa A não consegue editar usuário da empresa B (404)', async () => {
    const A = await novaEmpresa('C');
    const B = await novaEmpresa('D');
    const r = await A.agent.patch(`/api/v1/usuarios/${B.usuarioId}`).send({ nome: 'Invasor' });
    expect(r.status).toBe(404);
  });

  it('vendedor não pode criar usuários (403)', async () => {
    const A = await novaEmpresa('E');
    await A.agent.post('/api/v1/usuarios').send({
      nome: 'Vendedor', email: `vend-${sufixo}@teste.com`, senha: 'senha12345', perfil: 'vendedor',
    });
    const vend = request.agent(app);
    await vend.post('/api/v1/auth/login').send({ email: `vend-${sufixo}@teste.com`, senha: 'senha12345' });
    const r = await vend.post('/api/v1/usuarios').send({
      nome: 'Outro', email: `outro-${sufixo}@teste.com`, senha: 'senha12345', perfil: 'vendedor',
    });
    expect(r.status).toBe(403);
  });

  it('designer não tem acesso a faturamento e dados de orçamento no dashboard', async () => {
    const A = await novaEmpresa('F');
    await A.agent.post('/api/v1/usuarios').send({
      nome: 'Designer', email: `designer-${sufixo}@teste.com`, senha: 'senha12345', perfil: 'designer',
    });
    const des = request.agent(app);
    await des.post('/api/v1/auth/login').send({ email: `designer-${sufixo}@teste.com`, senha: 'senha12345' });
    const r = await des.get('/api/v1/dashboard/resumo');
    expect(r.status).toBe(200);
    expect(r.body.faturamento_mes).toBe(0);
    expect(r.body.orcamentos_aprovados).toBe(0);
    expect(r.body.faturamento_mensal).toHaveLength(0);
  });

  it('troca de senha revoga tokens emitidos anteriormente (401)', async () => {
    const A = await novaEmpresa('G');
    const u = (await A.agent.post('/api/v1/usuarios').send({
      nome: 'Operador', email: `op-${sufixo}@teste.com`, senha: 'senha12345', perfil: 'producao',
    })).body;

    const op = request.agent(app);
    await op.post('/api/v1/auth/login').send({ email: `op-${sufixo}@teste.com`, senha: 'senha12345' });
    await op.get('/api/v1/auth/me').expect(200);

    // Admin troca a senha do operador
    await A.agent.patch(`/api/v1/usuarios/${u.id}`).send({ senha: 'novaSenha123' }).expect(200);

    // Token antigo do operador agora é rejeitado
    const r = await op.get('/api/v1/auth/me');
    expect(r.status).toBe(401);
    expect(r.body.erro).toContain('revogada');
  });
});
