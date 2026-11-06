import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(dir, '../../.env') });

const obrigatoria = (nome) => {
  if (!process.env[nome]) throw new Error(`Variável ${nome} não definida no .env`);
  return process.env[nome];
};

const jwtSecret = obrigatoria('JWT_SECRET');
if (process.env.NODE_ENV === 'production') {
  if (jwtSecret.length < 32 || jwtSecret === 'troque-por-um-texto-longo-e-aleatorio') {
    throw new Error('JWT_SECRET inseguro: em produção, use uma chave aleatória com pelo menos 32 caracteres');
  }
}

export const env = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: obrigatoria('DATABASE_URL'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  isProd: process.env.NODE_ENV === 'production',
};
