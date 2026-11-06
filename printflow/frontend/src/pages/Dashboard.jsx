import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGet } from '../lib/api.js';
import { brl, dataBR, num, pad } from '../lib/format.js';
import { Card, Input, PageHeader, Vazio } from '../components/ui.jsx';

const Kpi = ({ label, value, sub, ruim }) => (
  <Card>
    <div className="text-[13px] text-muted">{label}</div>
    <div className={`text-3xl font-extrabold mt-1 ${ruim ? 'text-red-700' : ''}`}>{value}</div>
    {sub && <div className="text-[13px] text-muted mt-1">{sub}</div>}
  </Card>
);

export default function Dashboard() {
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const { data: d } = useGet(['dashboard', periodo], `/dashboard/resumo?periodo=${periodo}`);
  if (!d) return <p className="text-muted">Carregando…</p>;
  const max = Math.max(1, ...d.faturamento_mensal.map((m) => m.valor));

  return (
    <>
      <PageHeader title="Dashboard">
        <Input type="month" aria-label="Período" value={periodo} onChange={(e) => e.target.value && setPeriodo(e.target.value)} className="!w-auto" />
        <Link to="/orcamentos/novo" className="min-h-11 px-4 inline-flex items-center rounded-lg bg-brand text-white text-sm font-semibold">Novo orçamento</Link>
      </PageHeader>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
        <Kpi label="Faturamento do mês" value={brl(d.faturamento_mes)} sub={`${d.orcamentos_aprovados} aprovados · ${d.orcamentos_recusados} recusados`} />
        <Kpi label="Orçamentos em aberto" value={d.orcamentos_em_aberto} sub="Aguardando resposta" />
        <Kpi label="Pedidos em produção" value={d.os_em_producao} sub={`${d.os_concluidas_mes} concluídos no mês`} />
        <Kpi label="Serviços atrasados" value={d.os_atrasadas} ruim={d.os_atrasadas > 0} sub={d.os_atrasadas ? 'Ação necessária' : 'Tudo em dia'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card className="lg:col-span-2">
          <h2 className="text-base font-extrabold mt-0 mb-4">Faturamento mensal</h2>
          <div className="flex items-end gap-4 h-48">
            {d.faturamento_mensal.map((m, i) => (
              <div key={m.mes} className="flex-1 h-full flex flex-col justify-end items-center gap-2" title={brl(m.valor)}>
                <div className={`w-full rounded-t-md ${i === d.faturamento_mensal.length - 1 ? 'bg-brand' : 'bg-red-200'}`} style={{ height: `${Math.max(2, (m.valor / max) * 150)}px` }} />
                <span className="text-xs text-muted">{m.mes.slice(5)}/{m.mes.slice(2, 4)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-base font-extrabold mt-0 mb-3">O.S. por etapa</h2>
          {d.os_por_etapa.filter((e) => e.qtd > 0).map((e) => (
            <div key={e.id} className="flex justify-between py-2 border-t border-line text-sm"><span>{e.nome}</span><b>{e.qtd}</b></div>
          ))}
          {d.os_por_etapa.every((e) => e.qtd === 0) && <Vazio>Nenhuma O.S. em andamento.</Vazio>}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-base font-extrabold mt-0 mb-3">Próximas entregas</h2>
          {d.proximas_entregas.length === 0 && <Vazio>Sem entregas com prazo definido.</Vazio>}
          {d.proximas_entregas.map((o) => (
            <Link key={o.id} to="/os" className="grid grid-cols-[60px_1fr_auto] gap-3 py-2.5 border-t border-line text-sm items-center">
              <b>{pad(o.numero)}</b>
              <span>{o.cliente_nome} <span className="text-muted">· {o.etapa_nome}</span></span>
              <span className={o.atrasada ? 'text-red-700 font-semibold' : ''}>{dataBR(o.prazo_entrega)}</span>
            </Link>
          ))}
        </Card>
        <Card>
          <h2 className="text-base font-extrabold mt-0 mb-3">Estoque baixo</h2>
          {d.estoque_baixo.length === 0 && <Vazio>Estoque dentro do mínimo.</Vazio>}
          {d.estoque_baixo.map((m) => (
            <Link key={m.id} to="/estoque" className="flex justify-between py-2 border-t border-line text-sm">
              <span>{m.nome}</span><b className="text-red-700">{num(m.estoque_atual)} {m.unidade}</b>
            </Link>
          ))}
        </Card>
      </div>
    </>
  );
}
