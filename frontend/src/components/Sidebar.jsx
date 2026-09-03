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
const iconeUsuarios = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const iconeCatalogo = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
const iconeConfiguracoes = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2 2-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V20h-2.82v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2-2 .06-.06A1.65 1.65 0 0 0 7.6 15a1.65 1.65 0 0 0-1.51-1H6v-2h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06 2-2 .06.06A1.65 1.65 0 0 0 11.09 7.6h.01a1.65 1.65 0 0 0 1-1.51V6h2.82v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06 2 2-.06.06A1.65 1.65 0 0 0 19.4 11v.01a1.65 1.65 0 0 0 1.51 1H21v2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const iconeDashboard = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const iconeFluxoCaixa = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 10h18M16 14h2" />
  </svg>
);
const iconeRelatorios = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14" />
    <path d="M8 17v-4M12 17V7M16 17v-7M3 21h18" />
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
    { to: '/dashboard', label: 'Dashboard', icon: iconeDashboard },
    { to: '/', label: 'Gerenciar Agenda', icon: iconeGerenciar },
    { to: '/usuarios', label: 'Usuários', icon: iconeUsuarios },
    { to: '/catalogo', label: 'Catálogo', icon: iconeCatalogo },
    { to: '/fluxo-de-caixa', label: 'Fluxo de caixa', icon: iconeFluxoCaixa },
    { to: '/relatorios', label: 'Relatórios', icon: iconeRelatorios },
    { to: '/configuracoes', label: 'Configurações', icon: iconeConfiguracoes },
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

      <nav className="sidebar-nav" aria-label="Menu principal">
        {itens.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => 'sidebar-link' + (isActive ? ' ativo' : '')}
            aria-label={item.label}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <button className="sidebar-sair" onClick={logout} aria-label="Sair" title="Sair">
        {iconeSair}
        <span>Sair</span>
      </button>
    </aside>
  );
}
