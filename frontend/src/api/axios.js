import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL;

if (!baseURL) {
  throw new Error('VITE_API_URL não foi definida. Configure a URL da API para este ambiente.');
}

const api = axios.create({
  baseURL,
});

// O token existe somente durante a sessão aberta do navegador.
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Se o token expirar/for inválido, desloga automaticamente
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const nexusBlocked = error.response?.data?.online === false && !error.config?.skipNexusModal;
    if (error.response?.status === 401 || nexusBlocked) {
      const configurandoNexus = window.location.pathname === '/configuracoes';
      if (nexusBlocked) {
        sessionStorage.setItem('nexus_access_blocked', 'true');
        sessionStorage.setItem(
          'nexus_access_error',
          error.response.data.mensagem || 'A licença do programa não autoriza operações online.'
        );
        window.dispatchEvent(new CustomEvent('nexus-access-denied'));
      }
      // Um gestor que já estava autenticado pode permanecer nesta tela para
      // substituir uma configuração incorreta do NexusControl.
      if (!(nexusBlocked && configurandoNexus)) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('usuario');
        if (window.location.pathname !== '/login') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
