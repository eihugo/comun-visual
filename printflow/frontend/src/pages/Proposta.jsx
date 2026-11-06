import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BASE, api, useGet } from '../lib/api.js';
import { brl, dataBR, dataHoraBR, num, pad } from '../lib/format.js';
import { Btn, Card, ErrorBox, Textarea } from '../components/ui.jsx';

const AVISO = {
  aprovado: ['Proposta aprovada', 'Obrigado! A empresa já foi avisada e vai iniciar o seu pedido.', 'bg-green-100 text-green-800'],
  recusado: ['Proposta recusada', 'A empresa foi avisada da sua decisão.', 'bg-brand-soft text-red-700'],
  alteracao_solicitada: ['Alteração solicitada', 'A empresa vai analisar o seu pedido e enviar uma nova versão.', 'bg-amber-100 text-amber-800'],
  substituido: ['Existe uma versão mais nova', 'Esta versão foi substituída. Peça o novo link à empresa.', 'bg-amber-100 text-amber-800'],
  expirado: ['Proposta expirada', 'Peça uma nova proposta à empresa.', 'bg-slate-100 text-slate-700'],
};

export default function Proposta() {
  const { token } = useParams();
  const qc = useQueryClient();
  const { data, error } = useGet(['proposta', token], `/public/propostas/${token}`);
  const [pedindo, setPedindo] = useState(false);
  const [comentario, setComentario] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  if (error) return <div className="min-h-screen flex items-center justify-center p-6 text-center"><div><h1 className="text-xl font-extrabold">Proposta não encontrada</h1><p className="text-muted">Confira o link recebido ou peça um novo à empresa.</p></div></div>;
  if (!data) return <p className="p-6 text-muted">Carregando…</p>;
  const { empresa, orcamento: o, itens } = data;
  const aviso = o.status !== 'enviado' ? AVISO[o.status] : o.expirada ? AVISO.expirado : null;

  const decidir = async (decisao) => {
    if (decisao === 'alteracao_solicitada' && comentario.trim().length < 3) { setErro('Conte o que você gostaria de alterar.'); return; }
    if (decisao === 'recusado' && !confirm('Tem certeza que deseja recusar esta proposta?')) return;
    setBusy(true); setErro('');
    try {
      await api(`/public/propostas/${token}/decisao`, { method: 'POST', body: { decisao, comentario: comentario || null } });
      qc.invalidateQueries({ queryKey: ['proposta', token] });
    } catch (e) { setErro(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen px-4 py-6 flex justify-center">
      <div className="w-full max-w-xl flex flex-col gap-4">
        <div className="text-brand text-2xl font-extrabold">{empresa.nome}</div>
        {aviso && <div role="status" className={`rounded-xl p-4 ${aviso[2]}`}><b>{aviso[0]}</b><div className="text-sm">{aviso[1]}</div></div>}
        <Card className="flex flex-col gap-3">
          <div className="text-[13px] text-muted">Proposta {pad(o.numero)} · v{o.versao} · {dataBR(o.criado_em)}</div>
          <h1 className="text-2xl font-extrabold m-0">{o.cliente_nome}</h1>
          {itens.map((i, k) => (
            <div key={k} className="flex justify-between gap-3 border-t border-line pt-3 text-sm">
              <div><b>{i.descricao}</b><div className="text-muted">{i.largura && i.altura ? `${num(i.largura)} × ${num(i.altura)} m · ` : ''}qtd {num(i.quantidade)}{i.acabamento ? ` · ${i.acabamento}` : ''}</div></div>
              <b className="whitespace-nowrap">{brl(i.preco_total)}</b>
            </div>
          ))}
          <div className="flex flex-col items-end gap-1 border-t-2 border-ink pt-3">
            {Number(o.desconto_percentual) > 0 && <span className="text-sm text-muted">Subtotal {brl(o.subtotal)} · desconto {num(o.desconto_percentual)}%</span>}
            <div className="flex justify-between w-full items-baseline"><span className="font-semibold">Total</span><span className="text-3xl font-extrabold text-brand">{brl(o.total)}</span></div>
          </div>
        </Card>
        <Card className="text-sm text-muted flex flex-col gap-1">
          <b className="text-ink">Condições</b>
          {o.prazo_dias ? <span>Prazo estimado: {o.prazo_dias} dias</span> : null}
          {o.valido_ate ? <span>Proposta válida até {dataBR(o.valido_ate)}</span> : null}
          {o.observacoes && <span>{o.observacoes}</span>}
          {(empresa.telefone || empresa.email) && <span>Contato: {[empresa.telefone, empresa.email].filter(Boolean).join(' · ')}</span>}
        </Card>

        {!aviso && (
          <div className="flex flex-col gap-3">
            <ErrorBox msg={erro} />
            {pedindo && <Textarea aria-label="O que deseja alterar?" placeholder="O que você gostaria de alterar?" value={comentario} onChange={(e) => setComentario(e.target.value)} />}
            <Btn className="text-base" disabled={busy} onClick={() => decidir('aprovado')}>Aprovar proposta</Btn>
            {pedindo
              ? <Btn variant="ghost" disabled={busy} onClick={() => decidir('alteracao_solicitada')}>Enviar pedido de alteração</Btn>
              : <Btn variant="ghost" onClick={() => setPedindo(true)}>Solicitar alteração</Btn>}
            <Btn variant="danger" disabled={busy} onClick={() => decidir('recusado')}>Recusar</Btn>
          </div>
        )}
        <a className="text-sm text-brand font-semibold text-center" href={`${BASE}/api/v1/public/propostas/${token}/pdf`} target="_blank" rel="noreferrer">Baixar proposta em PDF</a>
      </div>
    </div>
  );
}
