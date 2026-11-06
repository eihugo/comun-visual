import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BASE, api, useGet } from '../lib/api.js';
import { PODE, useAuth } from '../lib/auth.jsx';
import { brl, dataBR, dataHoraBR, num, pad } from '../lib/format.js';
import { Btn, Card, ErrorBox, PageHeader, StatusOrc, Tabela } from '../components/ui.jsx';

const DECISAO = { aprovado: 'Aprovado', recusado: 'Recusado', alteracao_solicitada: 'Alteração solicitada' };

export default function OrcamentoDetalhe() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: o } = useGet(['orcamento', id], `/orcamentos/${id}`);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);
  if (!o) return <p className="text-muted">Carregando…</p>;

  const vende = PODE.vender.includes(user.perfil);
  const vendoCusto = ['admin', 'gerente', 'financeiro'].includes(user.perfil);
  const custo = o.itens.reduce((s, i) => s + Number(i.custo_total), 0);
  const lucro = Number(o.total) - custo;
  const refresh = () => ['orcamento', 'orcamentos', 'os', 'dashboard', 'notificacoes'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const acao = async (fn) => { setErro(''); try { await fn(); refresh(); } catch (e) { setErro(e.message); } };

  const enviar = () => acao(() => api(`/orcamentos/${id}/enviar`, { method: 'POST' }));
  const novaVersao = () => acao(async () => { const r = await api(`/orcamentos/${id}/nova-versao`, { method: 'POST' }); nav(`/orcamentos/${r.id}/editar`); });
  const decidir = (decisao) => {
    if (!confirm(decisao === 'aprovado' ? 'Registrar que o cliente APROVOU esta proposta? Uma O.S. será criada.' : 'Registrar que o cliente RECUSOU esta proposta?')) return;
    return acao(() => api(`/orcamentos/${id}/decisao-interna`, { method: 'POST', body: { decisao } }));
  };
  const copiar = async () => { await navigator.clipboard.writeText(o.link_proposta); setCopiado(true); setTimeout(() => setCopiado(false), 2000); };

  return (
    <>
      <PageHeader title={`Orçamento ${pad(o.numero)} · v${o.versao}`}>
        <StatusOrc status={o.status} />
        <a className="min-h-11 px-4 inline-flex items-center rounded-lg border border-slate-300 bg-white text-sm font-semibold" href={`${BASE}/api/v1/orcamentos/${id}/pdf`} target="_blank" rel="noreferrer">Baixar PDF</a>
        {vende && o.status === 'rascunho' && <Link to={`/orcamentos/${id}/editar`} className="min-h-11 px-4 inline-flex items-center rounded-lg border border-slate-300 bg-white text-sm font-semibold">Editar</Link>}
        {vende && o.status === 'rascunho' && <Btn onClick={enviar}>Enviar ao cliente</Btn>}
        {vende && ['enviado', 'recusado', 'alteracao_solicitada', 'expirado'].includes(o.status) && <Btn variant="ghost" onClick={novaVersao}>Criar nova versão</Btn>}
        {o.os && <Link to="/os" className="min-h-11 px-4 inline-flex items-center rounded-lg bg-brand text-white text-sm font-semibold">Ver O.S. {pad(o.os.numero)}</Link>}
      </PageHeader>
      <ErrorBox msg={erro} />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] items-start mt-4">
        <Card className="flex flex-col gap-4">
          <div className="text-sm"><b>{o.cliente_nome}</b> <span className="text-muted">· vendedor {o.vendedor_nome} · criado em {dataBR(o.criado_em)}{o.valido_ate ? ` · válido até ${dataBR(o.valido_ate)}` : ''}{o.prazo_dias ? ` · prazo ${o.prazo_dias} dias` : ''}</span></div>
          <Tabela cols={['Item', 'Medidas', 'Qtd', 'Valor']}>
            {o.itens.map((i) => (
              <tr key={i.id}>
                <td className="font-semibold">{i.descricao || i.produto_nome}{i.acabamento && <div className="text-xs text-muted font-normal">{i.acabamento}</div>}</td>
                <td>{i.largura && i.altura ? `${num(i.largura)} × ${num(i.altura)} m` : i.largura ? `${num(i.largura)} m` : '—'}</td>
                <td>{num(i.quantidade)}</td><td>{brl(i.preco_total)}</td>
              </tr>
            ))}
          </Tabela>
          <div className="flex flex-col items-end gap-1 border-t-2 border-ink pt-3 text-sm">
            {Number(o.desconto_percentual) > 0 && <span className="text-muted">Subtotal {brl(o.subtotal)} · desconto {num(o.desconto_percentual)}%</span>}
            <span className="text-3xl font-extrabold text-brand">{brl(o.total)}</span>
          </div>
          {o.observacoes && <p className="text-sm text-muted m-0">Observações: {o.observacoes}</p>}
        </Card>

        <div className="flex flex-col gap-4">
          {o.status === 'enviado' && (
            <Card className="flex flex-col gap-3">
              <h2 className="text-base font-extrabold m-0">Link para o cliente</h2>
              <input readOnly aria-label="Link da proposta" value={o.link_proposta} onFocus={(e) => e.target.select()} className="w-full min-h-11 px-3 rounded-lg border border-slate-300 text-sm" />
              <div className="flex gap-2"><Btn onClick={copiar}>{copiado ? 'Copiado!' : 'Copiar link'}</Btn><a href={o.link_proposta} target="_blank" rel="noreferrer" className="min-h-11 px-4 inline-flex items-center rounded-lg border border-slate-300 text-sm font-semibold">Abrir</a></div>
              {vende && (
                <div className="border-t border-line pt-3 flex flex-col gap-2">
                  <p className="text-xs text-muted m-0">Cliente respondeu por telefone ou WhatsApp? Registre aqui:</p>
                  <div className="flex gap-2"><Btn variant="ghost" onClick={() => decidir('aprovado')}>Registrar aprovação</Btn><Btn variant="danger" onClick={() => decidir('recusado')}>Registrar recusa</Btn></div>
                </div>
              )}
            </Card>
          )}
          {vendoCusto && (
            <Card className="text-sm flex flex-col gap-1">
              <h2 className="text-base font-extrabold m-0 mb-1">Resultado estimado</h2>
              <div className="flex justify-between"><span className="text-muted">Custo</span><b>{brl(custo)}</b></div>
              <div className="flex justify-between"><span className="text-muted">Lucro bruto</span><b className={lucro < 0 ? 'text-red-700' : 'text-green-700'}>{brl(lucro)}</b></div>
              <span className="text-xs text-muted">Visível apenas para a gestão. O cliente nunca vê estes valores.</span>
            </Card>
          )}
          <Card className="flex flex-col gap-2">
            <h2 className="text-base font-extrabold m-0">Respostas do cliente</h2>
            {o.aprovacoes.length === 0 && <p className="text-sm text-muted m-0">Sem respostas ainda.</p>}
            {o.aprovacoes.map((a, i) => (
              <div key={i} className="text-sm border-t border-line pt-2"><b>{DECISAO[a.decisao]}</b> <span className="text-muted">· {dataHoraBR(a.criado_em)}</span>{a.comentario && <div className="text-muted">{a.comentario}</div>}</div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
