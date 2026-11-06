import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Btn, Card, ErrorBox, Field, Input } from '../components/ui.jsx';

export function Casca({ titulo, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-4">
        <div className="text-center text-brand text-3xl font-extrabold">PrintFlow</div>
        <Card className="flex flex-col gap-4">
          <h1 className="text-xl font-extrabold m-0">{titulo}</h1>
          {children}
        </Card>
      </div>
    </div>
  );
}

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const enviar = async (e) => {
    e.preventDefault();
    setBusy(true); setErro('');
    try { await login(f.email, f.senha); nav('/'); } catch (err) { setErro(err.message); } finally { setBusy(false); }
  };
  return (
    <Casca titulo="Entrar">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <Field label="E-mail"><Input type="email" required autoFocus value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Senha"><Input type="password" required value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} /></Field>
        <ErrorBox msg={erro} />
        <Btn type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</Btn>
      </form>
      <p className="text-sm text-muted m-0 text-center">Sua empresa ainda não tem conta? <Link to="/cadastro" className="text-brand font-semibold">Cadastrar empresa</Link></p>
    </Casca>
  );
}
