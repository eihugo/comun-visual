export const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const num = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
export const pad = (n) => `#${String(n).padStart(4, '0')}`;

export function dataBR(d) {
  if (!d) return '—';
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, dd] = s.split('-'); return `${dd}/${m}/${y}`; }
  return new Date(s).toLocaleDateString('pt-BR');
}
export const dataHoraBR = (d) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

// aceita "1,5" ou "1.5"; vazio vira null
export const toNum = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
