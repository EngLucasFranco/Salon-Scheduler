import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

function limparSessaoLegada() {
  // Tokens antigos em localStorage não podem manter o login após fechar o navegador.
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const salvo = sessionStorage.getItem('usuario');
    return salvo ? JSON.parse(salvo) : null;
  });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    limparSessaoLegada();
    const token = sessionStorage.getItem('token');
    if (!token) {
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
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('usuario');
        setUsuario(null);
      })
      .finally(() => setCarregando(false));
  }, []);

  async function login(loginUsuario, senha) {
    const { data } = await api.post('/auth/login', { login: loginUsuario, senha });
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  }

  async function registrar(payload) {
    const { data } = await api.post('/auth/registrar', payload);
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  }

  function logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('usuario');
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
