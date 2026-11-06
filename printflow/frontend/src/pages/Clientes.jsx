import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, useGet } from '../lib/api.js';
import { PODE, useAuth } from '../lib/auth.jsx';
import { brl, dataBR, dataHoraBR, pad } from '../lib/format.js';
import { Badge, Btn, Card, ErrorBox, Field, Input, Modal, PageHeader, Select, StatusOrc, Tabela, Textarea, Vazio } from '../components/ui.jsx';

const VAZIO = { tipo: 'PJ', nome: '', documento: '', telefone: '', email: '', endereco: '', observacoes: '' };
const OPCIONAIS = ['documento', 'telefone', 'email', 'endereco', 'observacoes'];

function ClienteModal({ id, onClose }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const edita = PODE.vender.includes(user.perfil);
  const { data: c } = useGet(['cliente', id], `/clientes/${id}`, { enabled: !!id });
  const { data: hist } = useGet(['cliente-hist', id], `/clientes/${id}/historico`, { enabled: !!id });
  const [f, setF] = useState(id ? null : VAZIO);
  const [nota, setNota] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (c) setF(Object.fromEntries(Object.keys(VAZIO).map((k) => [k, c[k] ?? ''])));
  }, [c]);
  if (!f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const refresh = () => ['clientes', 'clientes-ativos', 'cliente', 'cliente-hist'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const salvar = async (e) => {
    e.preventDefault(); setErro('');
    const body = { ...f };
    OPCIONAIS.forEach((k) => { if (body[k] === '') body[k] = null; });
    try {
      await api(id ? `/clientes/${id}` : '/clientes', { method: id ? 'PATCH' : 'POST', body });
      refresh(); onClose();
    } catch (err) { setErro(err.message); }
  };
  const excluir = async () => {
    if (!confirm('Excluir este cliente? O histórico de orçamentos é preservado.')) return;
    try { await api(`/clientes/${id}`, { method: 'DELETE' }); refresh(); onClose(); } catch (err) { setErro(err.message); }
  };
  const addNota = async () => {
    if (nota.trim().length < 2) return;
    try { await api(`/clientes/${id}/historico`, { method: 'POST', body: { descricao: nota } }); setNota(''); refresh(); } catch (err) { setErro(err.message); }
  };

  return (
    <Modal open onClose={onClose} title={id ? 'Cliente' : 'Novo cliente'} wide>
      <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo"><Select value={f.tipo} onChange={set('tipo')} disabled={!edita}><option value="PJ">Pessoa jurídica</option><option value="PF">Pessoa física</option></Select></Field>
        <Field label="Nome"><Input required minLength={2} value={f.nome} onChange={set('nome')} disabled={!edita} /></Field>
        <Field label={f.tipo === 'PJ' ? 'CNPJ' : 'CPF'}><Input maxLength={18} value={f.documento} onChange={set('documento')} disabled={!edita} /></Field>
        <Field label="Telefone"><Input value={f.telefone} onChange={set('telefone')} disabled={!edita} /></Field>
        <Field label="E-mail"><Input type="email" value={f.email} onChange={set('email')} disabled={!edita} /></Field>
        <Field label="Endereço"><Input value={f.endereco} onChange={set('endereco')} disabled={!edita} /></Field>
        <Field label="Observações internas" className="sm:col-span-2"><Textarea value={f.observacoes} onChange={set('observacoes')} disabled={!edita} /></Field>
        <div className="sm:col-span-2 flex flex-col gap-3">
          <ErrorBox msg={erro} />
          {edita && (
            <div className="flex gap-3 justify-between">
              {id && PODE.escreverCadastros.includes(user.perfil) ? <Btn variant="danger" onClick={excluir}>Excluir</Btn> : <span />}
              <div className="flex gap-3"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn type="submit">Salvar</Btn></div>
            </div>
          )}
        </div>
      </form>

      {id && c && (
        <>
          <h3 className="text-sm font-extrabold m-0">Orçamentos</h3>
          {c.orcamentos.length === 0 ? <Vazio>Nenhum orçamento ainda.</Vazio> : (
            <Tabela cols={['Nº', 'Status', 'Total', 'Data']}>
              {c.orcamentos.map((o) => (
                <tr key={o.id}>
                  <td><Link className="text-brand font-semibold" to={`/orcamentos/${o.id}`}>{pad(o.numero)} v{o.versao}</Link></td>
                  <td><StatusOrc status={o.status} /></td><td>{brl(o.total)}</td><td>{dataBR(o.criado_em)}</td>
                </tr>
              ))}
            </Tabela>
          )}
          <h3 className="text-sm font-extrabold m-0">Histórico de contatos</h3>
          {edita && (
            <div className="flex gap-2">
              <Input placeholder="Registrar contato ou negociação…" value={nota} onChange={(e) => setNota(e.target.value)} />
              <Btn onClick={addNota}>Adicionar</Btn>
            </div>
          )}
          {(hist || []).map((h) => (
            <div key={h.id} className="text-sm border-t border-line pt-2"><span className="text-muted text-xs">{dataHoraBR(h.criado_em)} · {h.usuario || '—'}</span><br />{h.descricao}</div>
          ))}
        </>
      )}
    </Modal>
  );
}

export default function Clientes() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(undefined); // undefined = fechado, null = novo, número = editar
  const { data } = useGet(['clientes', q], `/clientes?q=${encodeURIComponent(q)}`);
  return (
    <>
      <PageHeader title="Clientes">
        {PODE.vender.includes(user.perfil) && <Btn onClick={() => setSel(null)}>Novo cliente</Btn>}
      </PageHeader>
      <Card className="flex flex-col gap-4">
        <Input placeholder="Buscar por nome, documento ou telefone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar clientes" />
        {!data ? <Vazio>Carregando…</Vazio> : data.length === 0 ? <Vazio>Nenhum cliente encontrado.</Vazio> : (
          <Tabela cols={['Nome', 'Documento', 'Telefone', 'E-mail', 'Situação']}>
            {data.map((c) => (
              <tr key={c.id} onClick={() => setSel(c.id)} className="cursor-pointer hover:bg-slate-50">
                <td className="font-semibold">{c.nome}</td><td>{c.documento || '—'}</td><td>{c.telefone || '—'}</td><td>{c.email || '—'}</td>
                <td><Badge tone={c.ativo ? 'green' : 'gray'}>{c.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>
      {sel !== undefined && <ClienteModal id={sel} onClose={() => setSel(undefined)} />}
    </>
  );
}
