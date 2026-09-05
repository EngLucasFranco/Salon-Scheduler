import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registrar from './pages/Registrar';
import ClienteAgenda from './pages/ClienteAgenda';
import MinhasReservas from './pages/MinhasReservas';
import GestorAgenda from './pages/GestorAgenda';
import PaginaEmBreve from './pages/PaginaEmBreve';
import Usuarios from './pages/Usuarios';
import Catalogo from './pages/Catalogo';
import Configuracoes from './pages/Configuracoes';

// Decide qual "página inicial" renderizar dentro do Layout, de acordo com o papel
function PaginaInicial() {
  const { usuario } = useAuth();
  return ['gestor', 'colaborador'].includes(usuario?.papel) ? <GestorAgenda /> : <ClienteAgenda />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/registrar" element={<Registrar />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<PaginaInicial />} />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute papeisPermitidos={['gestor']}>
                  <PaginaEmBreve titulo="Dashboard" descricao="Visualize os principais indicadores do seu negócio." />
                </ProtectedRoute>
              }
            />
            <Route
              path="usuarios"
              element={
                <ProtectedRoute papeisPermitidos={['gestor']}>
                  <Usuarios />
                </ProtectedRoute>
              }
            />
            <Route
              path="catalogo"
              element={
                <ProtectedRoute papeisPermitidos={['gestor']}>
                  <Catalogo />
                </ProtectedRoute>
              }
            />
            <Route
              path="fluxo-de-caixa"
              element={
                <ProtectedRoute papeisPermitidos={['gestor']}>
                  <PaginaEmBreve titulo="Fluxo de caixa" descricao="Acompanhe as entradas e saídas financeiras." />
                </ProtectedRoute>
              }
            />
            <Route
              path="relatorios"
              element={
                <ProtectedRoute papeisPermitidos={['gestor']}>
                  <PaginaEmBreve titulo="Relatórios" descricao="Analise os resultados e a evolução do negócio." />
                </ProtectedRoute>
              }
            />
            <Route
              path="configuracoes"
              element={
                <ProtectedRoute papeisPermitidos={['gestor']}>
                  <Configuracoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="minhas-reservas"
              element={
                <ProtectedRoute papeisPermitidos={['cliente']}>
                  <MinhasReservas />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
