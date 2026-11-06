import { describe, expect, it } from 'vitest';
import { senhaForte } from '../src/modules/auth/auth.schema.js';
import { protegerCsrf } from '../src/middlewares/csrf.js';

describe('Validações de Segurança', () => {
  describe('Política de Senha Forte', () => {
    it('rejeita senhas com menos de 8 caracteres', () => {
      expect(senhaForte.safeParse('1234567').success).toBe(false);
      expect(senhaForte.safeParse('abc').success).toBe(false);
    });

    it('rejeita senhas sem letras', () => {
      expect(senhaForte.safeParse('1234567890').success).toBe(false);
      expect(senhaForte.safeParse('!@#$%^&*()').success).toBe(false);
    });

    it('rejeita senhas sem números ou símbolos', () => {
      expect(senhaForte.safeParse('abcdefghij').success).toBe(false);
      expect(senhaForte.safeParse('senhasenha').success).toBe(false);
    });

    it('aceita senhas com letras e números/símbolos de pelo menos 8 dígitos', () => {
      expect(senhaForte.safeParse('senha12345').success).toBe(true);
      expect(senhaForte.safeParse('Admin@2026!').success).toBe(true);
      expect(senhaForte.safeParse('Chave-Forte-99').success).toBe(true);
    });
  });

  describe('Proteção Anti-CSRF (Middleware)', () => {
    it('permite requisições de leitura GET mesmo com cookie', () => {
      let chamouNext = false;
      const req = { method: 'GET', cookies: { token: 'jwt.token.val' }, headers: {} };
      protegerCsrf(req, {}, () => { chamouNext = true; });
      expect(chamouNext).toBe(true);
    });

    it('permite requisições sem cookie de autenticação (como endpoints públicos)', () => {
      let chamouNext = false;
      const req = { method: 'POST', cookies: {}, headers: {} };
      protegerCsrf(req, {}, () => { chamouNext = true; });
      expect(chamouNext).toBe(true);
    });

    it('permite requisições mutáveis com cabeçalho X-Requested-With', () => {
      let chamouNext = false;
      const req = {
        method: 'POST',
        cookies: { token: 'jwt.token.val' },
        headers: { 'x-requested-with': 'XMLHttpRequest' },
      };
      protegerCsrf(req, {}, () => { chamouNext = true; });
      expect(chamouNext).toBe(true);
    });

    it('permite requisições mutáveis com Origin correspondente ao frontendUrl', () => {
      let chamouNext = false;
      const req = {
        method: 'PATCH',
        cookies: { token: 'jwt.token.val' },
        headers: { origin: 'http://localhost:5173' },
      };
      protegerCsrf(req, {}, () => { chamouNext = true; });
      expect(chamouNext).toBe(true);
    });

    it('bloqueia requisição mutável com cookie de origem cruzada desconhecida (CSRF)', () => {
      // Simula fora de ambiente de teste
      const vitestOriginal = process.env.VITEST;
      const nodeEnvOriginal = process.env.NODE_ENV;
      delete process.env.VITEST;
      process.env.NODE_ENV = 'production';
      try {
        const req = {
          method: 'POST',
          cookies: { token: 'jwt.token.val' },
          headers: { origin: 'https://site-atacante.com' },
        };
        expect(() => protegerCsrf(req, {}, () => {})).toThrow(/CSRF/);
      } finally {
        process.env.VITEST = vitestOriginal;
        process.env.NODE_ENV = nodeEnvOriginal;
      }
    });
  });
});

