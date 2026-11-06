import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, useGet } from '../lib/api.js';
import { brl, num, toNum } from '../lib/format.js';
import { Btn, Card, ErrorBox, Field, Input, PageHeader, Select, Textarea } from '../components/ui.jsx';

const ITEM0 = { produto_id: '', material_id: '', descricao: '', largura: '', altura: '', quantidade: '1', acabamento: '' };

export default function OrcamentoForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: clientes } = useGet('clientes-ativos', '/clientes?ativo=true');
  const { data: produtos } = useGet('produtos', '/produtos');
  const { data: materiais } = useGet('materiais', '/materiais');
  const { data: existente } = useGet(['orcamento', id], `/orcamentos/${id}`, { enabled: !!id });
  const [f, setF] = useState({ cliente_id: '', prazo_dias: '', desconto: '0', observacoes: '', itens: [{ ...ITEM0 }] });
  const [calc, setCalc] = useState(null);
  const [calcErro, setCalcErro] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existente) return;
    if (existente.status !== 'rascunho') { nav(`/orcamentos/${id}`, { replace: true }); return; }
    setF({
      cliente_id: String(existente.cliente_id), prazo_dias: existente.prazo_dias ?? '', desconto: String(existente.desconto_percentual),
      observacoes: existente.observacoes ?? '',
      itens: existente.itens.map((i) => ({
        produto_id: String(i.produto_id), material_id: i.material_id ? String(i.material_id) : '', descricao: i.descricao ?? '',
        largura: i.largura ?? '', altura: i.altura ?? '', quantidade: String(Number(i.quantidade)), acabamento: i.acabamento ?? '',
      })),
    });
  }, [existente]); // eslint-disable-line

  const prod = (pid) => produtos?.find((p) => p.id === Number(pid));
  const itensPayload = useMemo(() => f.itens.map((i) => ({
    produto_id: Number(i.produto_id), material_id: i.material_id ? Number(i.material_id) : null, descricao: i.descricao || null,
    largura: toNum(i.largura), altura: toNum(i.altura), quantidade: toNum(i.quantidade), acabamento: i.acabamento || null,
  })), [f.itens]);

  const completo = produtos && itensPayload.every((i) => {
    const p = prod(i.produto_id);
    if (!p || !(i.quantidade > 0)) return false;
    if (p.unidade_medida === 'm2') return i.largura > 0 && i.altura > 0;
    if (p.unidade_medida === 'metro_linear') return i.largura > 0;
    return true;
  });
  const desconto = toNum(f.desconto) ?? 0;

  // Prévia em tempo real: o cálculo oficial é sempre feito no servidor
  useEffect(() => {
    if (!completo) { setCalc(null); return; }
    const t = setTimeout(async () => {
      try { setCalc(await api('/orcamentos/calcular', { method: 'POST', body: { itens: itensPayload, desconto_percentual: desconto } })); setCalcErro(''); }
      catch (e) { setCalc(null); setCalcErro(e.message); }
    }, 400);
    return () => clearTimeout(t);
  }, [JSON.stringify(itensPayload), desconto, completo]); // eslint-disable-line

  const setItem = (idx, k, v) => setF({ ...f, itens: f.itens.map((it, i) => (i === idx ? { ...it, [k]: v } : it)) });
  const salvar = async (e) => {
    e.preventDefault(); setErro('');
    if (!completo) { setErro('Complete os dados de todos os itens.'); return; }
    setBusy(true);
    try {
      const body = { cliente_id: Number(f.cliente_id), prazo_dias: toNum(f.prazo_dias), desconto_percentual: desconto, observacoes: f.observacoes || null, itens: itensPayload };
      const r = await api(id ? `/orcamentos/${id}` : '/orcamentos', { method: id ? 'PATCH' : 'POST', body });
      ['orcamentos', 'orcamento'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      nav(`/orcamentos/${r.id}`);
    } catch (err) { setErro(err.message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title={id ? 'Editar orçamento' : 'Novo orçamento'} />
      <form onSubmit={salvar} className="grid gap-4 lg:grid-cols-[1.5fr_1fr] items-start">
        <div className="flex flex-col gap-4">
          <Card className="grid gap-4 sm:grid-cols-3">
            <Field label="Cliente" className="sm:col-span-3">
              <Select required value={f.cliente_id} onChange={(e) => setF({ ...f, cliente_id: e.target.value })}>
                <option value="">Selecione…</option>{(clientes || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Field>
            <Field label="Prazo estimado (dias)"><Input inputMode="numeric" value={f.prazo_dias} onChange={(e) => setF({ ...f, prazo_dias: e.target.value })} /></Field>
            <Field label="Desconto (%)"><Input inputMode="decimal" value={f.desconto} onChange={(e) => setF({ ...f, desconto: e.target.value })} /></Field>
          </Card>

          {f.itens.map((it, idx) => {
            const p = prod(it.produto_id);
            const m2 = p?.unidade_medida === 'm2';
            const linear = p?.unidade_medida === 'metro_linear';
            const r = calc?.itens?.[idx];
            return (
              <Card key={idx} className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 flex justify-between items-center">
                  <h2 className="text-base font-extrabold m-0">Item {idx + 1}</h2>
                  {f.itens.length > 1 && <Btn variant="danger" onClick={() => setF({ ...f, itens: f.itens.filter((_, i) => i !== idx) })}>Remover</Btn>}
                </div>
                <Field label="Produto ou serviço" className="sm:col-span-2">
                  <Select required value={it.produto_id} onChange={(e) => setItem(idx, 'produto_id', e.target.value)}>
                    <option value="">Selecione…</option>{(produtos || []).filter((x) => x.ativo).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                  </Select>
                </Field>
                {(m2 || linear) && <Field label={m2 ? 'Largura (m)' : 'Comprimento (m)'}><Input required inputMode="decimal" value={it.largura} onChange={(e) => setItem(idx, 'largura', e.target.value)} /></Field>}
                {m2 && <Field label="Altura (m)"><Input required inputMode="decimal" value={it.altura} onChange={(e) => setItem(idx, 'altura', e.target.value)} /></Field>}
                <Field label="Quantidade"><Input required inputMode="decimal" value={it.quantidade} onChange={(e) => setItem(idx, 'quantidade', e.target.value)} /></Field>
                <Field label="Material (opcional: troca o padrão)">
                  <Select value={it.material_id} onChange={(e) => setItem(idx, 'material_id', e.target.value)}>
                    <option value="">Padrão do produto</option>{(materiais || []).filter((x) => x.ativo).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                  </Select>
                </Field>
                <Field label="Acabamento"><Input value={it.acabamento} onChange={(e) => setItem(idx, 'acabamento', e.target.value)} placeholder="Ex.: ilhós e bainha" /></Field>
                <Field label="Descrição no orçamento"><Input value={it.descricao} onChange={(e) => setItem(idx, 'descricao', e.target.value)} placeholder="Se vazio, usa o nome do produto" /></Field>
                {r && <p className="sm:col-span-2 m-0 text-sm text-muted">Base de cálculo: <b>{num(r.area_total)}</b> · Valor do item: <b className="text-ink">{brl(r.preco_total)}</b></p>}
              </Card>
            );
          })}
          <Btn variant="ghost" onClick={() => setF({ ...f, itens: [...f.itens, { ...ITEM0 }] })}>+ Adicionar item</Btn>
          <Card><Field label="Observações"><Textarea value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Field></Card>
        </div>

        <Card className="lg:sticky lg:top-4 flex flex-col gap-3">
          <h2 className="text-base font-extrabold m-0">Resumo</h2>
          {calc ? (
            <>
              <div className="flex justify-between text-sm"><span className="text-muted">Subtotal</span><b>{brl(calc.subtotal)}</b></div>
              {desconto > 0 && <div className="flex justify-between text-sm"><span className="text-muted">Desconto {num(desconto)}%</span><b>− {brl(calc.subtotal - calc.total)}</b></div>}
              <div className="flex justify-between items-baseline border-t-2 border-ink pt-3"><span className="font-semibold">Total</span><span className="text-3xl font-extrabold text-brand">{brl(calc.total)}</span></div>
            </>
          ) : <p className="text-sm text-muted m-0">{calcErro || 'Preencha os itens para ver o valor calculado.'}</p>}
          <ErrorBox msg={erro} />
          <Btn type="submit" disabled={busy || !completo}>{busy ? 'Salvando…' : 'Salvar rascunho'}</Btn>
          <Btn variant="ghost" onClick={() => nav(-1)}>Cancelar</Btn>
        </Card>
      </form>
    </>
  );
}
