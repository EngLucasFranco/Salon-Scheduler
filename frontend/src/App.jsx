import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registrar from './pages/Registrar';
import ClienteAgenda from './pages/ClienteAgenda';
import MinhasReservas from './pages/MinhasReservas';
import GestorAgenda from './pages/GestorAgenda';

// Decide qual "página inicial" renderizar dentro do Layout, de acordo com o papel
function PaginaInicial() {
  const { usuario } = useAuth();
  return usuario?.papel === 'gestor' ? <GestorAgenda /> : <ClienteAgenda />;
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
