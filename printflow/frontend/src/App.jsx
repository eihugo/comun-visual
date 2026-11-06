import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Registro from './pages/Registro.jsx';
import Proposta from './pages/Proposta.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clientes from './pages/Clientes.jsx';
import Produtos from './pages/Produtos.jsx';
import Orcamentos from './pages/Orcamentos.jsx';
import OrcamentoForm from './pages/OrcamentoForm.jsx';
import OrcamentoDetalhe from './pages/OrcamentoDetalhe.jsx';
import OS from './pages/OS.jsx';
import Estoque from './pages/Estoque.jsx';
import Usuarios from './pages/Usuarios.jsx';
import Configuracoes from './pages/Configuracoes.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Registro />} />
      <Route path="/proposta/:token" element={<Proposta />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="orcamentos" element={<Orcamentos />} />
        <Route path="orcamentos/novo" element={<OrcamentoForm />} />
        <Route path="orcamentos/:id/editar" element={<OrcamentoForm />} />
        <Route path="orcamentos/:id" element={<OrcamentoDetalhe />} />
        <Route path="os" element={<OS />} />
        <Route path="os/:id" element={<Navigate to="/os" replace />} />
        <Route path="estoque" element={<Estoque />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
