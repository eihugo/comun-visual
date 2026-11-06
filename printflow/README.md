# PrintFlow — MVP

Micro SaaS de gestão para comunicação visual e gráficas rápidas.
React + Vite + Tailwind (frontend) · Node + Express 5 (backend) · PostgreSQL.

## Rodar localmente (passo a passo)

Pré-requisitos: Node 20+ e Docker (ou qualquer PostgreSQL 14+).

1. Banco de dados:
   docker run -d --name printflow-db -p 5432:5432 -e POSTGRES_USER=printflow -e POSTGRES_PASSWORD=printflow -e POSTGRES_DB=printflow postgres:16

2. Backend (terminal 1):
   cd backend
   npm install
   cp .env.example .env        # troque o JWT_SECRET
   npm run migrate
   npm test                    # 8 testes, incluindo isolamento entre empresas
   npm run dev                 # http://localhost:3000

3. Frontend (terminal 2):
   cd frontend
   npm install
   npm run dev                 # http://localhost:5173

4. Abra http://localhost:5173/cadastro e crie sua empresa.

## Primeiro uso (ordem sugerida)

1. Configurações: informe o imposto (%) e a validade das propostas.
2. Produtos e materiais: cadastre os materiais (custo por unidade) e os produtos (perda, mão de obra, máquina, margem).
3. Estoque: registre a entrada inicial dos materiais.
4. Clientes: cadastre um cliente.
5. Orçamentos: crie um orçamento, envie e copie o link para o cliente aprovar.
6. Ao aprovar, a O.S. nasce na primeira etapa e aparece no Kanban.

## Fórmula de cálculo (por item)

base   = largura × altura × quantidade (m²) | largura × quantidade (metro linear) | quantidade (demais)
custo  = base × (1 + perda%) × custo do material + (mão de obra + máquina + acabamento) × base + adicional
preço  = custo × (1 + margem%) × (1 + imposto%)    — ou preço fixo × base, se o produto tiver preço fixo

O cálculo oficial é sempre feito no servidor.

## Produção (deploy)

Backend: defina DATABASE_URL, JWT_SECRET, FRONTEND_URL (URL do site), NODE_ENV=production; rode `npm run migrate` e `npm start`.
Frontend: defina VITE_API_URL (URL do backend) e rode `npm run build`; publique a pasta dist (com redirecionamento de todas as rotas para index.html).
Cookies entre domínios diferentes exigem HTTPS (SameSite=None; Secure).

## Fora do MVP (versões futuras)

Compras e fornecedores, financeiro (contas a pagar/receber), entregas/instalações, upload e aprovação de artes,
relatórios exportáveis, e-mail/WhatsApp, cobrança por assinatura, etapas por tipo de serviço.
