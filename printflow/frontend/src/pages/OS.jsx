import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, useGet } from '../lib/api.js';
import { PODE, useAuth } from '../lib/auth.jsx';
import { dataBR, dataHoraBR, num, pad, toNum } from '../lib/format.js';
import { Badge, Btn, Card, ErrorBox, Field, Input, Modal, PageHeader, PRIORIDADE, Select, Textarea, Vazio } from '../components/ui.jsx';

const SITUACOES = { ativa: 'Ativa', pausada: 'Pausada', retrabalho: 'Retrabalho', concluida: 'Concluída', cancelada: 'Cancelada' };

function OSModal({ id, etapas, onClose }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const opera = PODE.operarOS.includes(user.perfil);
  const gere = PODE.gerirOS.includes(user.perfil);
  const usaEstoque = PODE.estoque.includes(user.perfil);
  const { data: os } = useGet(['os', id], `/os/${id}`);
  const { data: usuarios } = useGet('usuarios', '/usuarios', { enabled: gere });
  const { data: materiais } = useGet('materiais', '/materiais', { enabled: usaEstoque });
  const [f, setF] = useState(null);
  const [etapaNova, setEtapaNova] = useState('');
  const [obs, setObs] = useState('');
  const [ocorr, setOcorr] = useState('');
  const [mat, setMat] = useState({ material_id: '', quantidade: '' });
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (os) setF({ responsavel_id: os.responsavel_id ? String(os.responsavel_id) : '', prazo_entrega: os.prazo_entrega ?? '', prioridade: os.prioridade, situacao: ['ativa', 'pausada', 'retrabalho'].includes(os.situacao) ? os.situacao : 'ativa', observacoes: os.observacoes ?? '' });
  }, [os]);
  if (!os || !f) return null;
  const aberta = !['cancelada', 'concluida'].includes(os.situacao);
  const refresh = () => ['os', 'dashboard', 'notificacoes', 'estoque', 'movimentacoes'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const run = async (fn) => { setErro(''); try { await fn(); refresh(); } catch (e) { setErro(e.message); } };

  const salvar = () => run(() => api(`/os/${id}`, { method: 'PATCH', body: { responsavel_id: f.responsavel_id ? Number(f.responsavel_id) : null, prazo_entrega: f.prazo_entrega || null, prioridade: f.prioridade, situacao: f.situacao, observacoes: f.observacoes || null } }));
  const mover = () => run(async () => { await api(`/os/${id}/etapa`, { method: 'PATCH', body: { etapa_id: Number(etapaNova), observacao: obs || null } }); setEtapaNova(''); setObs(''); });
  const addOcorr = () => run(async () => { await api(`/os/${id}/ocorrencias`, { method: 'POST', body: { observacao: ocorr } }); setOcorr(''); });
  const consumir = () => run(async () => { await api('/estoque/movimentacoes', { method: 'POST', body: { material_id: Number(mat.material_id), tipo: 'saida', quantidade: toNum(mat.quantidade), os_id: id, observacao: `Consumo O.S. ${pad(os.numero)}` } }); setMat({ material_id: '', quantidade: '' }); });
  const cancelar = () => { if (confirm('Cancelar esta O.S.? Esta ação não pode ser desfeita.')) run(() => api(`/os/${id}/cancelar`, { method: 'POST', body: { motivo } })); };

  return (
    <Modal open onClose={onClose} title={`O.S. ${pad(os.numero)} · ${os.cliente_nome}`} wide>
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <Badge tone={os.situacao === 'cancelada' ? 'red' : os.situacao === 'concluida' ? 'green' : 'blue'}>{SITUACOES[os.situacao]}</Badge>
        <span className="text-muted">Etapa: <b className="text-ink">{os.etapa_nome}</b></span>
        <Link className="text-brand font-semibold" to={`/orcamentos/${os.orcamento_id}`}>Orçamento {pad(os.orcamento_numero)}</Link>
      </div>
      <ErrorBox msg={erro} />
      <div>
        <h3 className="text-sm font-extrabold mt-0 mb-2">Itens do pedido</h3>
        {os.itens.map((i, k) => <div key={k} className="text-sm border-t border-line py-1.5">{i.descricao} <span className="text-muted">· {i.largura && i.altura ? `${num(i.largura)}×${num(i.altura)} m · ` : ''}qtd {num(i.quantidade)}{i.material ? ` · ${i.material}` : ''}{i.acabamento ? ` · ${i.acabamento}` : ''}</span></div>)}
      </div>

      {aberta && opera && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <h3 className="text-sm font-extrabold m-0">Mover de etapa</h3>
          <div className="flex flex-wrap gap-2">
            <Select className="!w-auto flex-1 min-w-48" aria-label="Nova etapa" value={etapaNova} onChange={(e) => setEtapaNova(e.target.value)}>
              <option value="">Escolha a etapa…</option>{etapas.filter((e) => e.ativo && e.id !== os.etapa_id).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Select>
            <Input className="flex-1 min-w-48" placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
            <Btn disabled={!etapaNova} onClick={mover}>Mover</Btn>
          </div>
        </div>
      )}

      {aberta && gere && (
        <div className="grid gap-3 sm:grid-cols-2 border-t border-line pt-3">
          <h3 className="text-sm font-extrabold m-0 sm:col-span-2">Responsável e prazo</h3>
          <Field label="Responsável"><Select value={f.responsavel_id} onChange={(e) => setF({ ...f, responsavel_id: e.target.value })}><option value="">Sem responsável</option>{(usuarios || []).filter((u) => u.ativo).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</Select></Field>
          <Field label="Prazo de entrega"><Input type="date" value={f.prazo_entrega} onChange={(e) => setF({ ...f, prazo_entrega: e.target.value })} /></Field>
          <Field label="Prioridade"><Select value={f.prioridade} onChange={(e) => setF({ ...f, prioridade: e.target.value })}>{Object.entries(PRIORIDADE).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}</Select></Field>
          <Field label="Situação"><Select value={f.situacao} onChange={(e) => setF({ ...f, situacao: e.target.value })}><option value="ativa">Ativa</option><option value="pausada">Pausada</option><option value="retrabalho">Retrabalho</option></Select></Field>
          <Field label="Observações" className="sm:col-span-2"><Textarea value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Field>
          <div className="sm:col-span-2 flex justify-end"><Btn onClick={salvar}>Salvar alterações</Btn></div>
        </div>
      )}
      {!gere && <p className="text-sm text-muted m-0">Responsável: <b className="text-ink">{os.responsavel_nome || '—'}</b> · Prazo: <b className="text-ink">{dataBR(os.prazo_entrega)}</b></p>}

      {aberta && usaEstoque && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <h3 className="text-sm font-extrabold m-0">Registrar material consumido</h3>
          <div className="flex flex-wrap gap-2">
            <Select className="!w-auto flex-1 min-w-48" aria-label="Material" value={mat.material_id} onChange={(e) => setMat({ ...mat, material_id: e.target.value })}>
              <option value="">Material…</option>{(materiais || []).filter((m) => m.ativo).map((m) => <option key={m.id} value={m.id}>{m.nome} ({num(m.estoque_atual)} {m.unidade})</option>)}
            </Select>
            <Input className="!w-32" inputMode="decimal" placeholder="Qtd" aria-label="Quantidade" value={mat.quantidade} onChange={(e) => setMat({ ...mat, quantidade: e.target.value })} />
            <Btn variant="ghost" disabled={!mat.material_id || !mat.quantidade} onClick={consumir}>Registrar saída</Btn>
          </div>
        </div>
      )}
      {os.materiais.length > 0 && <div className="text-sm"><b>Consumo registrado:</b> {os.materiais.map((m) => `${num(m.quantidade)} ${m.unidade} de ${m.nome}`).join(' · ')}</div>}

      {opera && (
        <div className="flex gap-2 border-t border-line pt-3">
          <Input placeholder="Registrar ocorrência ou retrabalho…" aria-label="Ocorrência" value={ocorr} onChange={(e) => setOcorr(e.target.value)} />
          <Btn variant="ghost" disabled={ocorr.trim().length < 2} onClick={addOcorr}>Registrar</Btn>
        </div>
      )}
      <div>
        <h3 className="text-sm font-extrabold mt-0 mb-2">Histórico</h3>
        {os.historico.map((h) => (
          <div key={h.id} className="text-sm border-t border-line py-2">
            <span className="text-muted text-xs">{dataHoraBR(h.criado_em)} · {h.usuario || 'Sistema'}</span><br />
            {h.etapa_anterior && h.etapa_nova && h.etapa_anterior !== h.etapa_nova ? <b>{h.etapa_anterior} → {h.etapa_nova}</b> : null} {h.observacao}
          </div>
        ))}
      </div>

      {aberta && gere && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <Input className="flex-1 min-w-48" placeholder="Motivo do cancelamento (obrigatório)" aria-label="Motivo do cancelamento" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Btn variant="danger" disabled={motivo.trim().length < 3} onClick={cancelar}>Cancelar O.S.</Btn>
        </div>
      )}
    </Modal>
  );
}

export default function OS() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const opera = PODE.operarOS.includes(user.perfil);
  const { data: etapas } = useGet('etapas', '/etapas');
  const { data: lista } = useGet('os', '/os');
  const [sel, setSel] = useState(null);
  const [conc, setConc] = useState(false);
  const [erro, setErro] = useState('');
  if (!etapas || !lista) return <p className="text-muted">Carregando…</p>;

  const ativas = etapas.filter((e) => e.ativo);
  const avancar = async (o, ev) => {
    ev.stopPropagation(); setErro('');
    const prox = ativas[ativas.findIndex((e) => e.id === o.etapa_id) + 1];
    if (!prox) return;
    try { await api(`/os/${o.id}/etapa`, { method: 'PATCH', body: { etapa_id: prox.id } }); ['os', 'dashboard', 'notificacoes'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); } catch (e) { setErro(e.message); }
  };
  const colunas = etapas.filter((e) => (e.ativo && (conc || !e.final)) || lista.some((o) => o.etapa_id === e.id && o.situacao !== 'cancelada' && (conc || !e.final)));

  return (
    <>
      <PageHeader title="Ordens de serviço">
        <label className="flex items-center gap-2 text-sm font-semibold min-h-11"><input type="checkbox" checked={conc} onChange={(e) => setConc(e.target.checked)} /> Mostrar concluídas</label>
      </PageHeader>
      <ErrorBox msg={erro} />
      {lista.filter((o) => o.situacao !== 'cancelada').length === 0 && <Card className="mt-2"><Vazio>Nenhuma O.S. ainda. Elas são criadas automaticamente quando um orçamento é aprovado.</Vazio></Card>}
      <div className="flex gap-4 overflow-x-auto pb-4 items-start mt-2">
        {colunas.map((e) => {
          const cards = lista.filter((o) => o.etapa_id === e.id && o.situacao !== 'cancelada');
          return (
            <div key={e.id} className="w-64 flex-none bg-slate-200/70 rounded-xl p-3 flex flex-col gap-2.5">
              <div className="flex justify-between text-sm font-extrabold px-1"><span>{e.nome}</span><span className="text-muted">{cards.length}</span></div>
              {cards.map((o) => (
                <div key={o.id} role="button" tabIndex={0} onClick={() => setSel(o.id)} onKeyDown={(ev) => ev.key === 'Enter' && setSel(o.id)} className="bg-white border border-line rounded-lg p-3 flex flex-col gap-1.5 cursor-pointer hover:shadow-md">
                  <div className="flex justify-between items-center text-[13px]"><b>{pad(o.numero)}</b><Badge tone={PRIORIDADE[o.prioridade][1]}>{PRIORIDADE[o.prioridade][0]}</Badge></div>
                  <div className="text-sm font-semibold">{o.cliente_nome}</div>
                  <div className="text-[13px] text-muted line-clamp-2">{o.resumo}</div>
                  <div className={`text-[13px] ${o.atrasada ? 'text-red-700 font-semibold' : 'text-muted'}`}>{o.atrasada ? 'Atrasada · ' : 'Prazo '}{dataBR(o.prazo_entrega)}</div>
                  {o.situacao !== 'ativa' && o.situacao !== 'concluida' && <Badge tone="amber">{SITUACOES[o.situacao]}</Badge>}
                  {opera && o.situacao !== 'concluida' && !e.final && <button onClick={(ev) => avancar(o, ev)} className="min-h-11 text-sm font-semibold text-brand border border-red-200 rounded-lg hover:bg-brand-soft">Avançar etapa →</button>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {sel && <OSModal id={sel} etapas={etapas} onClose={() => setSel(null)} />}
    </>
  );
}
