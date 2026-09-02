import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const iconeAgenda = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const iconeReservas = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const iconeGerenciar = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
const iconeSair = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

export default function Sidebar() {
  const { usuario, logout } = useAuth();

  const itensCliente = [
    { to: '/', label: 'Agenda Disponível', icon: iconeAgenda },
    { to: '/minhas-reservas', label: 'Minhas Reservas', icon: iconeReservas },
  ];

  const itensGestor = [
    { to: '/', label: 'Gerenciar Agenda', icon: iconeGerenciar },
  ];

  const itens = usuario?.papel === 'gestor' ? itensGestor : itensCliente;

  return (
    <aside className="sidebar">
      <div className="sidebar-topo">
        <div className="logo-salao">💇 Agenda Salão</div>
        {usuario && (
          <div className="sidebar-usuario">
            <div className="avatar">{usuario.nome?.charAt(0)?.toUpperCase()}</div>
            <div>
              <div className="sidebar-usuario-nome">{usuario.nome}</div>
              <div className="sidebar-usuario-papel">{usuario.papel === 'gestor' ? 'Gestor(a)' : 'Cliente'}</div>
            </div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {itens.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => 'sidebar-link' + (isActive ? ' ativo' : '')}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <button className="sidebar-sair" onClick={logout}>
        {iconeSair}
        <span>Sair</span>
      </button>
    </aside>
  );
}
