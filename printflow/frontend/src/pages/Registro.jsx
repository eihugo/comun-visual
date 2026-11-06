import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Btn, ErrorBox, Field, Input } from '../components/ui.jsx';
import { Casca } from './Login.jsx';

export default function Registro() {
  const { user, registrar } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ empresa: '', cnpj: '', nome: '', email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setBusy(true); setErro('');
    try {
      await registrar({
        empresa: { nome: f.empresa, ...(f.cnpj ? { cnpj: f.cnpj } : {}) },
        admin: { nome: f.nome, email: f.email, senha: f.senha },
      });
      nav('/');
    } catch (err) { setErro(err.message); } finally { setBusy(false); }
  };
  return (
    <Casca titulo="Cadastrar empresa">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <Field label="Nome da empresa"><Input required value={f.empresa} onChange={set('empresa')} /></Field>
        <Field label="CNPJ (opcional)"><Input value={f.cnpj} onChange={set('cnpj')} maxLength={18} /></Field>
        <Field label="Seu nome"><Input required value={f.nome} onChange={set('nome')} /></Field>
        <Field label="E-mail de acesso"><Input type="email" required value={f.email} onChange={set('email')} /></Field>
        <Field label="Senha (mínimo 8 caracteres)"><Input type="password" required minLength={8} value={f.senha} onChange={set('senha')} /></Field>
        <ErrorBox msg={erro} />
        <Btn type="submit" disabled={busy}>{busy ? 'Criando…' : 'Criar conta'}</Btn>
      </form>
      <p className="text-sm text-muted m-0 text-center">Já tem conta? <Link to="/login" className="text-brand font-semibold">Entrar</Link></p>
    </Casca>
  );
}
