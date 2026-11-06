import { useEffect } from 'react';

export const cx = (...a) => a.filter(Boolean).join(' ');

export function Btn({ variant = 'primary', className, ...p }) {
  const v = {
    primary: 'bg-brand text-white hover:bg-red-800',
    ghost: 'bg-white border border-slate-300 text-ink hover:bg-slate-50',
    danger: 'bg-white border border-red-300 text-red-700 hover:bg-red-50',
  }[variant];
  return <button type="button" {...p} className={cx('min-h-11 px-4 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed', v, className)} />;
}

const campo = 'w-full min-h-11 px-3 rounded-lg border border-slate-300 bg-white text-[15px] focus:outline-2 focus:outline-brand';
export const Input = ({ className, ...p }) => <input {...p} className={cx(campo, className)} />;
export const Select = ({ className, ...p }) => <select {...p} className={cx(campo, className)} />;
export const Textarea = ({ className, ...p }) => <textarea {...p} className={cx(campo, 'py-2', className)} rows={p.rows || 3} />;

export const Field = ({ label, children, className }) => (
  <label className={cx('flex flex-col gap-1.5 text-[13px] font-semibold text-muted', className)}>{label}{children}</label>
);

export const Card = ({ className, ...p }) => <section {...p} className={cx('bg-white border border-line rounded-xl p-5', className)} />;

export const PageHeader = ({ title, children }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
    <h1 className="text-[28px] font-extrabold m-0">{title}</h1>
    <div className="flex flex-wrap gap-3">{children}</div>
  </div>
);

export const ErrorBox = ({ msg }) => (msg ? <p role="alert" className="text-sm text-red-700 bg-brand-soft rounded-lg px-3 py-2 m-0">{msg}</p> : null);
export const Vazio = ({ children }) => <p className="text-muted text-sm py-6 text-center m-0">{children}</p>;

const TONES = {
  gray: 'bg-slate-100 text-slate-700', red: 'bg-brand-soft text-red-700', amber: 'bg-amber-100 text-amber-800',
  green: 'bg-green-100 text-green-800', blue: 'bg-sky-100 text-sky-800',
};
export const Badge = ({ tone = 'gray', children }) => (
  <span className={cx('inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold', TONES[tone])}>{children}</span>
);

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('bg-white rounded-xl w-full my-8 p-6 flex flex-col gap-4', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold m-0">{title}</h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="min-h-11 min-w-11 text-2xl text-muted">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const STATUS_ORC = {
  rascunho: ['Rascunho', 'gray'], enviado: ['Enviado', 'blue'], aprovado: ['Aprovado', 'green'], recusado: ['Recusado', 'red'],
  alteracao_solicitada: ['Alteração pedida', 'amber'], substituido: ['Substituído', 'gray'], expirado: ['Expirado', 'gray'],
};
export const StatusOrc = ({ status }) => <Badge tone={STATUS_ORC[status]?.[1]}>{STATUS_ORC[status]?.[0] || status}</Badge>;

export const PRIORIDADE = { baixa: ['Baixa', 'gray'], normal: ['Normal', 'gray'], alta: ['Alta', 'amber'], urgente: ['Urgente', 'red'] };
export const PERFIS = { admin: 'Administrador', gerente: 'Gerente', vendedor: 'Vendedor', designer: 'Designer', producao: 'Produção', financeiro: 'Financeiro' };

export function Tabela({ cols, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted text-[13px]">{cols.map((c) => <th key={c} className="py-2 pr-4 font-semibold">{c}</th>)}</tr></thead>
        <tbody className="[&>tr]:border-t [&>tr]:border-line [&_td]:py-2.5 [&_td]:pr-4">{children}</tbody>
      </table>
    </div>
  );
}
