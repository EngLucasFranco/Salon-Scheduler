import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Notificacoes from './Notificacoes';

export default function Layout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="conteudo">
        <Notificacoes />
        <Outlet />
      </main>
    </div>
  );
}
