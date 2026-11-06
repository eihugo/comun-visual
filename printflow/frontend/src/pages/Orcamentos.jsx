import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGet } from '../lib/api.js';
import { PODE, useAuth } from '../lib/auth.jsx';
import { brl, dataBR, pad } from '../lib/format.js';
import { Btn, Card, Input, PageHeader, Select, STATUS_ORC, StatusOrc, Tabela, Vazio } from '../components/ui.jsx';

export default function Orcamentos() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { data } = useGet(['orcamentos', status, q], `/orcamentos?status=${status}&q=${encodeURIComponent(q)}`);
  return (
    <>
      <PageHeader title="Orçamentos">
        {PODE.vender.includes(user.perfil) && <Link to="/orcamentos/novo" className="min-h-11 px-4 inline-flex items-center rounded-lg bg-brand text-white text-sm font-semibold">Novo orçamento</Link>}
      </PageHeader>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <Input className="flex-1 min-w-48" placeholder="Buscar por cliente ou número" aria-label="Buscar orçamentos" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select className="!w-auto" aria-label="Filtrar por status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_ORC).map(([k, [nome]]) => <option key={k} value={k}>{nome}</option>)}
          </Select>
        </div>
        {!data ? <Vazio>Carregando…</Vazio> : data.length === 0 ? <Vazio>Nenhum orçamento encontrado.</Vazio> : (
          <Tabela cols={['Nº', 'Cliente', 'Status', 'Total', 'Vendedor', 'Data']}>
            {data.map((o) => (
              <tr key={o.id} onClick={() => nav(`/orcamentos/${o.id}`)} className="cursor-pointer hover:bg-slate-50">
                <td className="font-semibold">{pad(o.numero)} <span className="text-muted font-normal">v{o.versao}</span></td>
                <td>{o.cliente_nome}</td><td><StatusOrc status={o.status} /></td><td>{brl(o.total)}</td><td>{o.vendedor_nome}</td><td>{dataBR(o.criado_em)}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>
    </>
  );
}
