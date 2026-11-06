import { useQuery } from '@tanstack/react-query';

export const BASE = import.meta.env.VITE_API_URL || '';

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    credentials: 'include',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.detalhes?.length ? `${data.erro}: ${data.detalhes.map((d) => d.mensagem).join('; ')}` : data.erro || 'Erro inesperado');
    e.status = res.status;
    throw e;
  }
  return data;
}

export const useGet = (key, path, opts = {}) =>
  useQuery({ queryKey: Array.isArray(key) ? key : [key], queryFn: () => api(path), ...opts });
