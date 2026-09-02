import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const salvo = localStorage.getItem('usuario');
    return salvo ? JSON.parse(salvo) : null;
  });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setCarregando(false);
      return;
    }
    // Revalida o usuário com o backend ao carregar a aplicação
    api
      .get('/auth/me')
      .then(({ data }) => {
        setUsuario(data.usuario);
        localStorage.setItem('usuario', JSON.stringify(data.usuario));
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        setUsuario(null);
      })
      .finally(() => setCarregando(false));
  }, []);

  async function login(loginUsuario, senha) {
    const { data } = await api.post('/auth/login', { login: loginUsuario, senha });
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  }

  async function registrar(payload) {
    const { data } = await api.post('/auth/registrar', payload);
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
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
