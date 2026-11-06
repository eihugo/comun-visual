import { useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth.jsx';
import { api, useGet } from '../lib/api.js';
import { dataHoraBR } from '../lib/format.js';
import { Btn, PERFIS } from './ui.jsx';

const NAV = [
  ['/', 'Dashboard', null],
  ['/clientes', 'Clientes', ['admin', 'gerente', 'vendedor', 'financeiro']],
  ['/orcamentos', 'Orçamentos', ['admin', 'gerente', 'vendedor', 'financeiro']],
  ['/os', 'Ordens de serviço', null],
  ['/produtos', 'Produtos e materiais', null],
  ['/estoque', 'Estoque', null],
  ['/usuarios', 'Usuários', ['admin', 'gerente']],
  ['/configuracoes', 'Configurações', ['admin']],
];

function Sino() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [aberto, setAberto] = useState(false);
  const { data } = useGet('notificacoes', '/notificacoes', { refetchInterval: 30000 });
  const lista = data?.notificacoes || [];
  const abrir = async (n) => {
    if (!n.lida) await api(`/notificacoes/${n.id}/lida`, { method: 'POST' });
    qc.invalidateQueries({ queryKey: ['notificacoes'] });
    setAberto(false);
    if (n.link) nav(n.link);
  };
  const marcarTodas = async () => { await api('/notificacoes/lidas', { method: 'POST' }); qc.invalidateQueries({ queryKey: ['notificacoes'] }); };
  return (
    <div className="relative">
      <Btn variant="ghost" aria-label="Notificações" onClick={() => setAberto(!aberto)}>
        Notificações{data?.nao_lidas ? <span className="ml-2 bg-brand text-white rounded-full px-2 text-xs">{data.nao_lidas}</span> : null}
      </Btn>
      {aberto && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-line rounded-xl shadow-lg z-40 p-2">
          <div className="flex justify-between items-center px-2 py-1">
            <b className="text-sm">Notificações</b>
            <button className="text-xs text-brand font-semibold" onClick={marcarTodas}>Marcar todas como lidas</button>
          </div>
          {lista.length === 0 && <p className="text-sm text-muted p-3 m-0">Nada por aqui.</p>}
          {lista.map((n) => (
            <button key={n.id} onClick={() => abrir(n)} className={`block w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 ${n.lida ? 'text-muted' : 'font-semibold'}`}>
              <span className="block text-sm">{n.mensagem}</span>
              <span className="text-xs text-muted">{dataHoraBR(n.criado_em)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, loading, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  if (loading) return <p className="p-8 text-muted">Carregando…</p>;
  if (!user) return <Navigate to="/login" replace />;

  const itens = NAV.filter(([, , perfis]) => !perfis || perfis.includes(user.perfil));
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className={`bg-brand-dark md:w-56 md:flex-none md:block p-4 ${menu ? 'block' : 'hidden'}`}>
        <div className="hidden md:block text-white font-extrabold text-[22px] mb-6 pl-3">PrintFlow</div>
        <nav className="flex flex-col gap-1">
          {itens.map(([to, nome]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenu(false)}
              className={({ isActive }) => `px-3 py-2.5 rounded-lg text-sm font-semibold ${isActive ? 'bg-brand text-white' : 'text-[#D9B8BB] hover:bg-white/10'}`}>
              {nome}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center justify-between gap-3 px-4 md:px-8 py-3 bg-white border-b border-line">
          <div className="flex items-center gap-3">
            <button className="md:hidden min-h-11 min-w-11 font-extrabold text-brand" aria-label="Abrir menu" onClick={() => setMenu(!menu)}>☰ PrintFlow</button>
          </div>
          <div className="flex items-center gap-3">
            <Sino />
            <span className="hidden sm:block text-sm text-right leading-tight"><b>{user.nome}</b><br /><span className="text-muted text-xs">{PERFIS[user.perfil]}</span></span>
            <Btn variant="ghost" onClick={logout}>Sair</Btn>
          </div>
        </header>
        <main className="p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
