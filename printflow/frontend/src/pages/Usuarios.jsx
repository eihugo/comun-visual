import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, useGet } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { dataHoraBR, toNum } from '../lib/format.js';
import { Badge, Btn, Card, ErrorBox, Field, Input, Modal, PageHeader, PERFIS, Select, Tabela, Vazio } from '../components/ui.jsx';

function UsuarioModal({ item, onClose, souEu }) {
  const qc = useQueryClient();
  const [f, setF] = useState(item
    ? { nome: item.nome, email: item.email, senha: '', perfil: item.perfil, limite: String(item.limite_desconto_percentual), ativo: item.ativo }
    : { nome: '', email: '', senha: '', perfil: 'vendedor', limite: '0', ativo: true });
  const [erro, setErro] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const salvar = async (e) => {
    e.preventDefault(); setErro('');
    const base = { nome: f.nome, perfil: f.perfil, limite_desconto_percentual: toNum(f.limite) ?? 0 };
    try {
      if (item) await api(`/usuarios/${item.id}`, { method: 'PATCH', body: { ...base, ativo: f.ativo, ...(f.senha ? { senha: f.senha } : {}) } });
      else await api('/usuarios', { method: 'POST', body: { ...base, email: f.email, senha: f.senha } });
      qc.invalidateQueries({ queryKey: ['usuarios'] }); onClose();
    } catch (err) { setErro(err.message); }
  };
  return (
    <Modal open onClose={onClose} title={item ? 'Editar usuário' : 'Novo usuário'}>
      <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome"><Input required minLength={2} value={f.nome} onChange={set('nome')} /></Field>
        <Field label="E-mail"><Input type="email" required disabled={!!item} value={f.email} onChange={set('email')} /></Field>
        <Field label="Perfil"><Select value={f.perfil} onChange={set('perfil')} disabled={souEu}>{Object.entries(PERFIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Limite de desconto (%)"><Input inputMode="decimal" value={f.limite} onChange={set('limite')} /></Field>
        <Field label={item ? 'Nova senha (deixe vazio para manter)' : 'Senha (mín. 8 caracteres)'} className="sm:col-span-2">
          <Input type="password" minLength={f.senha || !item ? 8 : undefined} required={!item} value={f.senha} onChange={set('senha')} autoComplete="new-password" />
        </Field>
        {item && !souEu && <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Acesso liberado</label>}
        <div className="sm:col-span-2 flex flex-col gap-3"><ErrorBox msg={erro} /><div className="flex gap-3 justify-end"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn type="submit">Salvar</Btn></div></div>
      </form>
    </Modal>
  );
}

export default function Usuarios() {
  const { user } = useAuth();
  const admin = user.perfil === 'admin';
  const [sel, setSel] = useState(undefined);
  const { data } = useGet('usuarios', '/usuarios');
  return (
    <>
      <PageHeader title="Usuários e permissões">{admin && <Btn onClick={() => setSel(null)}>Novo usuário</Btn>}</PageHeader>
      <Card>
        {!data ? <Vazio>Carregando…</Vazio> : (
          <Tabela cols={['Nome', 'E-mail', 'Perfil', 'Desconto máx.', 'Último acesso', 'Situação']}>
            {data.map((u) => (
              <tr key={u.id} onClick={() => admin && setSel(u)} className={admin ? 'cursor-pointer hover:bg-slate-50' : ''}>
                <td className="font-semibold">{u.nome}</td><td>{u.email}</td><td>{PERFIS[u.perfil]}</td>
                <td>{Number(u.limite_desconto_percentual)}%</td><td>{dataHoraBR(u.ultimo_login)}</td>
                <td><Badge tone={u.ativo ? 'green' : 'red'}>{u.ativo ? 'Ativo' : 'Bloqueado'}</Badge></td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>
      {sel !== undefined && <UsuarioModal item={sel} souEu={sel?.id === user.id} onClose={() => setSel(undefined)} />}
    </>
  );
}
