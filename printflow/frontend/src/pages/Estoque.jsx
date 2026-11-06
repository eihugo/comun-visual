import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, useGet } from '../lib/api.js';
import { PODE, useAuth } from '../lib/auth.jsx';
import { brl, dataHoraBR, num, toNum } from '../lib/format.js';
import { Badge, Btn, Card, ErrorBox, Field, Input, Modal, PageHeader, Select, Tabela, Vazio } from '../components/ui.jsx';

function MovModal({ material, onClose }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ tipo: 'entrada', quantidade: '', custo_unitario: '', observacao: '' });
  const [erro, setErro] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const salvar = async (e) => {
    e.preventDefault(); setErro('');
    try {
      await api('/estoque/movimentacoes', { method: 'POST', body: {
        material_id: material.id, tipo: f.tipo, quantidade: toNum(f.quantidade), custo_unitario: toNum(f.custo_unitario), observacao: f.observacao || null } });
      ['estoque', 'movimentacoes', 'dashboard', 'notificacoes'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    } catch (err) { setErro(err.message); }
  };
  return (
    <Modal open onClose={onClose} title={`Movimentar: ${material.nome}`}>
      <p className="text-sm text-muted m-0">Saldo atual: <b>{num(material.estoque_atual)} {material.unidade}</b></p>
      <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo"><Select value={f.tipo} onChange={set('tipo')}><option value="entrada">Entrada</option><option value="saida">Saída</option></Select></Field>
        <Field label={`Quantidade (${material.unidade})`}><Input required inputMode="decimal" value={f.quantidade} onChange={set('quantidade')} /></Field>
        {f.tipo === 'entrada' && <Field label="Custo de aquisição (R$/unid.)"><Input inputMode="decimal" value={f.custo_unitario} onChange={set('custo_unitario')} /></Field>}
        <Field label="Observação" className="sm:col-span-2"><Input value={f.observacao} onChange={set('observacao')} placeholder="Ex.: compra NF 123, perda, ajuste" /></Field>
        <div className="sm:col-span-2 flex flex-col gap-3"><ErrorBox msg={erro} /><div className="flex gap-3 justify-end"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn type="submit">Registrar</Btn></div></div>
      </form>
    </Modal>
  );
}

export default function Estoque() {
  const { user } = useAuth();
  const [sel, setSel] = useState(null);
  const [filtro, setFiltro] = useState('');
  const { data: itens } = useGet('estoque', '/estoque');
  const { data: movs } = useGet(['movimentacoes', filtro], `/estoque/movimentacoes${filtro ? `?material_id=${filtro}` : ''}`);
  const pode = PODE.estoque.includes(user.perfil);
  return (
    <>
      <PageHeader title="Estoque" />
      <Card className="mb-4">
        {!itens ? <Vazio>Carregando…</Vazio> : itens.length === 0 ? <Vazio>Cadastre materiais em “Produtos e materiais”.</Vazio> : (
          <Tabela cols={['Material', 'Saldo', 'Mínimo', 'Custo', '']}>
            {itens.map((m) => (
              <tr key={m.id}>
                <td className="font-semibold">{m.nome}</td>
                <td>{num(m.estoque_atual)} {m.unidade} {m.abaixo_minimo && <Badge tone="red">Estoque baixo</Badge>}</td>
                <td>{num(m.estoque_minimo)}</td><td>{brl(m.custo_unitario)}</td>
                <td className="text-right">{pode && <Btn variant="ghost" onClick={() => setSel(m)}>Movimentar</Btn>}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold m-0">Movimentações</h2>
          <Select className="!w-auto" aria-label="Filtrar por material" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos os materiais</option>{(itens || []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
        </div>
        {!movs || movs.length === 0 ? <Vazio>Nenhuma movimentação registrada.</Vazio> : (
          <Tabela cols={['Data', 'Material', 'Tipo', 'Qtd', 'Por', 'Obs.']}>
            {movs.map((m) => (
              <tr key={m.id}>
                <td>{dataHoraBR(m.criado_em)}</td><td>{m.material}</td>
                <td><Badge tone={m.tipo === 'entrada' ? 'green' : 'amber'}>{m.tipo === 'entrada' ? 'Entrada' : 'Saída'}</Badge></td>
                <td>{num(m.quantidade)} {m.unidade}</td><td>{m.usuario || '—'}</td><td>{m.os_id ? `O.S. · ` : ''}{m.observacao || ''}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>
      {sel && <MovModal material={sel} onClose={() => setSel(null)} />}
    </>
  );
}
