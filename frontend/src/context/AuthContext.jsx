import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import { clearNexusSession, getNexusSession, hasValidNexusSession, validateAtLogin } from '../services/nexusSession';

const AuthContext = createContext(null);

function limparSessaoLegada() {
  // Tokens antigos em localStorage não podem manter o login após fechar o navegador.
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      const salvo = sessionStorage.getItem('usuario');
      return salvo ? JSON.parse(salvo) : null;
    } catch {
      return null;
    }
  });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    limparSessaoLegada();
    const token = sessionStorage.getItem('token');
    if (!token || !hasValidNexusSession()) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('usuario');
      clearNexusSession();
      setUsuario(null);
      setCarregando(false);
      return;
    }
    // Revalida o usuário com o backend ao carregar a aplicação
    api
      .get('/auth/me')
      .then(({ data }) => {
        setUsuario(data.usuario);
        sessionStorage.setItem('usuario', JSON.stringify(data.usuario));
      })
      .catch(() => {
        clearStoredSession();
        setUsuario(null);
      })
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (!usuario) return undefined;
    const nexusSession = getNexusSession();
    if (!nexusSession) {
      logout();
      return undefined;
    }

    const delay = Date.parse(nexusSession.tokenExpiresAt) - Date.now();
    const timeoutId = window.setTimeout(() => logout(), Math.max(0, delay));
    return () => window.clearTimeout(timeoutId);
  }, [usuario]);

  useEffect(() => {
    const expire = () => {
      clearStoredSession();
      setUsuario(null);
    };
    window.addEventListener('auth-session-expired', expire);
    return () => window.removeEventListener('auth-session-expired', expire);
  }, []);

  async function login(loginUsuario, senha) {
    const data = await validateAtLogin({ login: loginUsuario, senha }, api);
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  }

  async function registrar(payload) {
    const { data } = await api.post('/auth/registrar', payload);
    return data.usuario;
  }

  function clearStoredSession() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('usuario');
    clearNexusSession();
  }

  function logout() {
    clearStoredSession();
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, registrar, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
