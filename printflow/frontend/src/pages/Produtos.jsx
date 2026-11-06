import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, useGet } from '../lib/api.js';
import { PODE, useAuth } from '../lib/auth.jsx';
import { brl, num, toNum } from '../lib/format.js';
import { Badge, Btn, Card, ErrorBox, Field, Input, Modal, PageHeader, Select, Tabela, Vazio } from '../components/ui.jsx';

const UNIDADES = { m2: 'm²', metro_linear: 'Metro linear', unidade: 'Unidade', hora_maquina: 'Hora de máquina', personalizado: 'Personalizado' };
const P0 = { nome: '', categoria: '', unidade_medida: 'm2', material_id: '', perda_percentual: '0', custo_mao_obra: '0', custo_maquina: '0', custo_acabamento: '0', custo_adicional: '0', margem_percentual: '0', preco_venda_fixo: '', tempo_producao_min: '', ativo: true };
const M0 = { nome: '', unidade: 'm2', custo_unitario: '0', estoque_minimo: '0', ativo: true };

function ProdutoModal({ item, materiais, onClose }) {
  const qc = useQueryClient();
  const [f, setF] = useState(item ? Object.fromEntries(Object.keys(P0).map((k) => [k, item[k] ?? (typeof P0[k] === 'boolean' ? true : '')])) : P0);
  const [erro, setErro] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const salvar = async (e) => {
    e.preventDefault(); setErro('');
    const body = {
      nome: f.nome, categoria: f.categoria || null, unidade_medida: f.unidade_medida,
      material_id: f.material_id ? Number(f.material_id) : null,
      perda_percentual: toNum(f.perda_percentual) ?? 0, custo_mao_obra: toNum(f.custo_mao_obra) ?? 0, custo_maquina: toNum(f.custo_maquina) ?? 0,
      custo_acabamento: toNum(f.custo_acabamento) ?? 0, custo_adicional: toNum(f.custo_adicional) ?? 0, margem_percentual: toNum(f.margem_percentual) ?? 0,
      preco_venda_fixo: toNum(f.preco_venda_fixo), tempo_producao_min: toNum(f.tempo_producao_min), ...(item ? { ativo: f.ativo } : {}),
    };
    try { await api(item ? `/produtos/${item.id}` : '/produtos', { method: item ? 'PATCH' : 'POST', body }); qc.invalidateQueries({ queryKey: ['produtos'] }); onClose(); } catch (err) { setErro(err.message); }
  };
  const un = f.unidade_medida === 'm2' ? 'm²' : f.unidade_medida === 'metro_linear' ? 'metro' : 'unidade';
  return (
    <Modal open onClose={onClose} title={item ? 'Editar produto' : 'Novo produto'} wide>
      <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome"><Input required minLength={2} value={f.nome} onChange={set('nome')} /></Field>
        <Field label="Categoria"><Input value={f.categoria} onChange={set('categoria')} placeholder="Ex.: Lonas, Fachadas" /></Field>
        <Field label="Vendido por"><Select value={f.unidade_medida} onChange={set('unidade_medida')}>{Object.entries(UNIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Material principal">
          <Select value={f.material_id} onChange={set('material_id')}><option value="">Nenhum</option>{materiais.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</Select>
        </Field>
        <Field label="Perda de material (%)"><Input inputMode="decimal" value={f.perda_percentual} onChange={set('perda_percentual')} /></Field>
        <Field label={`Mão de obra (R$ por ${un})`}><Input inputMode="decimal" value={f.custo_mao_obra} onChange={set('custo_mao_obra')} /></Field>
        <Field label={`Máquina (R$ por ${un})`}><Input inputMode="decimal" value={f.custo_maquina} onChange={set('custo_maquina')} /></Field>
        <Field label={`Acabamento (R$ por ${un})`}><Input inputMode="decimal" value={f.custo_acabamento} onChange={set('custo_acabamento')} /></Field>
        <Field label="Custo adicional fixo (R$)"><Input inputMode="decimal" value={f.custo_adicional} onChange={set('custo_adicional')} /></Field>
        <Field label="Margem de lucro (%)"><Input inputMode="decimal" value={f.margem_percentual} onChange={set('margem_percentual')} /></Field>
        <Field label={`Preço fixo (R$ por ${un}) — opcional`}><Input inputMode="decimal" value={f.preco_venda_fixo} onChange={set('preco_venda_fixo')} placeholder="Deixe vazio para calcular" /></Field>
        <Field label="Tempo de produção (min)"><Input inputMode="numeric" value={f.tempo_producao_min} onChange={set('tempo_producao_min')} /></Field>
        {item && <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Produto ativo</label>}
        <div className="sm:col-span-2 flex flex-col gap-3"><ErrorBox msg={erro} /><div className="flex gap-3 justify-end"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn type="submit">Salvar</Btn></div></div>
      </form>
    </Modal>
  );
}

function MaterialModal({ item, onClose }) {
  const qc = useQueryClient();
  const [f, setF] = useState(item ? { nome: item.nome, unidade: item.unidade, custo_unitario: String(item.custo_unitario), estoque_minimo: String(item.estoque_minimo), ativo: item.ativo } : M0);
  const [erro, setErro] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const salvar = async (e) => {
    e.preventDefault(); setErro('');
    const body = { nome: f.nome, unidade: f.unidade, custo_unitario: toNum(f.custo_unitario) ?? 0, estoque_minimo: toNum(f.estoque_minimo) ?? 0, ...(item ? { ativo: f.ativo } : {}) };
    try { await api(item ? `/materiais/${item.id}` : '/materiais', { method: item ? 'PATCH' : 'POST', body }); ['materiais', 'estoque'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); onClose(); } catch (err) { setErro(err.message); }
  };
  return (
    <Modal open onClose={onClose} title={item ? 'Editar material' : 'Novo material'}>
      <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" className="sm:col-span-2"><Input required minLength={2} value={f.nome} onChange={set('nome')} /></Field>
        <Field label="Unidade"><Input required maxLength={10} value={f.unidade} onChange={set('unidade')} placeholder="m2, m, un, kg, l" /></Field>
        <Field label="Custo por unidade (R$)"><Input inputMode="decimal" value={f.custo_unitario} onChange={set('custo_unitario')} /></Field>
        <Field label="Estoque mínimo"><Input inputMode="decimal" value={f.estoque_minimo} onChange={set('estoque_minimo')} /></Field>
        {item && <label className="flex items-center gap-2 text-sm font-semibold self-end min-h-11"><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Material ativo</label>}
        <div className="sm:col-span-2 flex flex-col gap-3"><ErrorBox msg={erro} /><div className="flex gap-3 justify-end"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn type="submit">Salvar</Btn></div></div>
      </form>
    </Modal>
  );
}

export default function Produtos() {
  const { user } = useAuth();
  const edita = PODE.escreverCadastros.includes(user.perfil);
  const [aba, setAba] = useState('produtos');
  const [sel, setSel] = useState(undefined);
  const { data: produtos } = useGet('produtos', '/produtos');
  const { data: materiais } = useGet('materiais', '/materiais');
  const matNome = (id) => materiais?.find((m) => m.id === id)?.nome || '—';

  return (
    <>
      <PageHeader title="Produtos e materiais">
        {edita && <Btn onClick={() => setSel(null)}>{aba === 'produtos' ? 'Novo produto' : 'Novo material'}</Btn>}
      </PageHeader>
      <div className="flex gap-2 mb-4" role="tablist">
        {[['produtos', 'Produtos e serviços'], ['materiais', 'Materiais']].map(([k, nome]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => { setAba(k); setSel(undefined); }}
            className={`min-h-11 px-4 rounded-lg text-sm font-semibold ${aba === k ? 'bg-brand text-white' : 'bg-white border border-line'}`}>{nome}</button>
        ))}
      </div>
      <Card>
        {aba === 'produtos' ? (
          !produtos ? <Vazio>Carregando…</Vazio> : produtos.length === 0 ? <Vazio>Cadastre seu primeiro produto para começar a fazer orçamentos.</Vazio> : (
            <Tabela cols={['Produto', 'Vendido por', 'Material', 'Margem', 'Situação']}>
              {produtos.map((p) => (
                <tr key={p.id} onClick={() => edita && setSel(p)} className={edita ? 'cursor-pointer hover:bg-slate-50' : ''}>
                  <td className="font-semibold">{p.nome}<div className="text-xs text-muted font-normal">{p.categoria}</div></td>
                  <td>{UNIDADES[p.unidade_medida]}</td><td>{matNome(p.material_id)}</td>
                  <td>{p.preco_venda_fixo ? `Fixo ${brl(p.preco_venda_fixo)}` : `${num(p.margem_percentual)}%`}</td>
                  <td><Badge tone={p.ativo ? 'green' : 'gray'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                </tr>
              ))}
            </Tabela>
          )
        ) : (
          !materiais ? <Vazio>Carregando…</Vazio> : materiais.length === 0 ? <Vazio>Nenhum material cadastrado.</Vazio> : (
            <Tabela cols={['Material', 'Unidade', 'Custo', 'Mínimo', 'Situação']}>
              {materiais.map((m) => (
                <tr key={m.id} onClick={() => edita && setSel(m)} className={edita ? 'cursor-pointer hover:bg-slate-50' : ''}>
                  <td className="font-semibold">{m.nome}</td><td>{m.unidade}</td><td>{brl(m.custo_unitario)}</td><td>{num(m.estoque_minimo)}</td>
                  <td><Badge tone={m.ativo ? 'green' : 'gray'}>{m.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                </tr>
              ))}
            </Tabela>
          )
        )}
      </Card>
      {sel !== undefined && aba === 'produtos' && <ProdutoModal item={sel} materiais={materiais || []} onClose={() => setSel(undefined)} />}
      {sel !== undefined && aba === 'materiais' && <MaterialModal item={sel} onClose={() => setSel(undefined)} />}
    </>
  );
}
