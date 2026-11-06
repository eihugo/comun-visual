import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { protegerCsrf } from './middlewares/csrf.js';
import { naoEncontrado, tratarErros } from './middlewares/erro.js';
import authRoutes from './modules/auth/auth.routes.js';
import usuariosRoutes from './modules/usuarios/usuarios.routes.js';
import clientesRoutes from './modules/clientes/clientes.routes.js';
import materiaisRoutes from './modules/materiais/materiais.routes.js';
import produtosRoutes from './modules/produtos/produtos.routes.js';
import empresaRoutes from './modules/empresa/empresa.routes.js';
import orcamentosRoutes from './modules/orcamentos/orcamentos.routes.js';
import publicoRoutes from './modules/publico/publico.routes.js';
import osRoutes from './modules/os/os.routes.js';
import estoqueRoutes from './modules/estoque/estoque.routes.js';
import notificacoesRoutes from './modules/notificacoes/notificacoes.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';

const app = express();
app.set('trust proxy', 1); // atrás do proxy da hospedagem, para o IP real e rate limit corretos

app.use(helmet());
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(protegerCsrf);

const api = express.Router();
api.get('/saude', (req, res) => res.json({ ok: true }));
api.use('/auth', authRoutes);
api.use('/usuarios', usuariosRoutes);
api.use('/clientes', clientesRoutes);
api.use('/materiais', materiaisRoutes);
api.use('/produtos', produtosRoutes);
api.use('/', empresaRoutes); // /empresa e /etapas
api.use('/orcamentos', orcamentosRoutes);
api.use('/public/propostas', publicoRoutes);
api.use('/os', osRoutes);
api.use('/estoque', estoqueRoutes);
api.use('/notificacoes', notificacoesRoutes);
api.use('/dashboard', dashboardRoutes);
app.use('/api/v1', api);

app.use(naoEncontrado);
app.use(tratarErros);

export default app;
