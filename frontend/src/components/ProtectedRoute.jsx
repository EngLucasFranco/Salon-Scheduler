import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, papeisPermitidos }) {
  const { usuario, carregando } = useAuth();

  if (carregando) return <div className="tela-carregando">Carregando...</div>;
  if (!usuario) return <Navigate to="/login" replace />;

  if (papeisPermitidos && !papeisPermitidos.includes(usuario.papel)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
