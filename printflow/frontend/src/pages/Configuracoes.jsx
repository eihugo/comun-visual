import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, useGet } from '../lib/api.js';
import { toNum } from '../lib/format.js';
import { Badge, Btn, Card, ErrorBox, Field, Input, PageHeader } from '../components/ui.jsx';

function Etapa({ e }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(e.nome);
  const [erro, setErro] = useState('');
  const salvar = async (patch) => {
    setErro('');
    try { await api(`/etapas/${e.id}`, { method: 'PATCH', body: patch }); qc.invalidateQueries({ queryKey: ['etapas'] }); } catch (err) { setErro(err.message); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
      <span className="w-6 text-muted text-sm">{e.ordem}</span>
      <Input className="!w-64" aria-label={`Nome da etapa ${e.ordem}`} value={nome} onChange={(ev) => setNome(ev.target.value)} />
      <Btn variant="ghost" disabled={nome === e.nome || nome.length < 2} onClick={() => salvar({ nome })}>Renomear</Btn>
      {e.final ? <Badge tone="green">Etapa final</Badge> : (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={e.ativo} onChange={(ev) => salvar({ ativo: ev.target.checked })} /> Usada no fluxo</label>
      )}
      <ErrorBox msg={erro} />
    </div>
  );
}

export default function Configuracoes() {
  const qc = useQueryClient();
  const { data: emp } = useGet('empresa', '/empresa');
  const { data: etapas } = useGet('etapas', '/etapas');
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  useEffect(() => { if (emp) setF({ nome: emp.nome, cnpj: emp.cnpj ?? '', email: emp.email ?? '', telefone: emp.telefone ?? '', endereco: emp.endereco ?? '', imposto: String(emp.imposto_percentual), validade: String(emp.validade_proposta_dias) }); }, [emp]);
  if (!f) return <p className="text-muted">Carregando…</p>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const salvar = async (e) => {
    e.preventDefault(); setErro(''); setMsg('');
    try {
      await api('/empresa', { method: 'PATCH', body: {
        nome: f.nome, cnpj: f.cnpj || null, email: f.email || null, telefone: f.telefone || null, endereco: f.endereco || null,
        imposto_percentual: toNum(f.imposto) ?? 0, validade_proposta_dias: toNum(f.validade) ?? 15 } });
      qc.invalidateQueries({ queryKey: ['empresa'] }); setMsg('Configurações salvas.');
    } catch (err) { setErro(err.message); }
  };
  return (
    <>
      <PageHeader title="Configurações" />
      <Card className="mb-4">
        <h2 className="text-base font-extrabold mt-0 mb-4">Dados da empresa e cálculo</h2>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome"><Input required value={f.nome} onChange={set('nome')} /></Field>
          <Field label="CNPJ"><Input maxLength={18} value={f.cnpj} onChange={set('cnpj')} /></Field>
          <Field label="E-mail"><Input type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="Telefone"><Input value={f.telefone} onChange={set('telefone')} /></Field>
          <Field label="Endereço" className="sm:col-span-2"><Input value={f.endereco} onChange={set('endereco')} /></Field>
          <Field label="Impostos e taxas aplicados nos orçamentos (%)"><Input inputMode="decimal" value={f.imposto} onChange={set('imposto')} /></Field>
          <Field label="Validade das propostas (dias)"><Input inputMode="numeric" value={f.validade} onChange={set('validade')} /></Field>
          <div className="sm:col-span-2 flex flex-col gap-3">
            <ErrorBox msg={erro} />{msg && <p className="text-sm text-green-700 m-0">{msg}</p>}
            <div className="flex justify-end"><Btn type="submit">Salvar</Btn></div>
          </div>
        </form>
      </Card>
      <Card className="flex flex-col gap-2">
        <h2 className="text-base font-extrabold m-0">Etapas de produção</h2>
        <p className="text-sm text-muted m-0 mb-2">Renomeie as etapas ou desative as que sua empresa não usa. A ordem e a etapa final são fixas no MVP.</p>
        {(etapas || []).map((e) => <Etapa key={`${e.id}-${e.nome}-${e.ativo}`} e={e} />)}
      </Card>
    </>
  );
}
