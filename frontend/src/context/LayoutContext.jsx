import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const LayoutContext = createContext(null);
const padrao = { administrativo: 'classico', cliente: 'classico' };

export function LayoutProvider({ children }) {
  const [layouts, setLayouts] = useState(padrao);

  useEffect(() => {
    api.get('/configuracoes/layout').then(({ data }) => setLayouts(data)).catch(() => setLayouts(padrao));
  }, []);

  async function salvarLayouts(novosLayouts) {
    const { data } = await api.put('/configuracoes/layout', novosLayouts);
    setLayouts(data);
  }

  return <LayoutContext.Provider value={{ layouts, salvarLayouts }}>{children}</LayoutContext.Provider>;
}

export function useLayouts() {
  const contexto = useContext(LayoutContext);
  if (!contexto) throw new Error('useLayouts deve ser usado dentro de LayoutProvider.');
  return contexto;
}
