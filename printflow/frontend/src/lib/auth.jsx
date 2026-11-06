import { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['me'],
    queryFn: () => api('/auth/me').then((r) => r.usuario).catch((e) => { if (e.status === 401) return null; throw e; }),
    staleTime: Infinity,
  });
  const value = {
    user: q.data ?? null,
    loading: q.isLoading,
    async login(email, senha) {
      const r = await api('/auth/login', { method: 'POST', body: { email, senha } });
      qc.setQueryData(['me'], r.usuario);
    },
    async registrar(body) {
      const r = await api('/auth/registrar-empresa', { method: 'POST', body });
      qc.setQueryData(['me'], r.usuario);
    },
    async logout() {
      await api('/auth/logout', { method: 'POST' });
      qc.clear();
      qc.setQueryData(['me'], null);
    },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const PODE = {
  escreverCadastros: ['admin', 'gerente'],
  vender: ['admin', 'gerente', 'vendedor'],
  verOrcamentos: ['admin', 'gerente', 'vendedor', 'financeiro'],
  operarOS: ['admin', 'gerente', 'designer', 'producao'],
  gerirOS: ['admin', 'gerente'],
  estoque: ['admin', 'gerente', 'producao'],
};
