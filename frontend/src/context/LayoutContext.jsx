import { createContext, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/axios';

const LayoutContext = createContext(null);
const padrao = { administrativo: 'classico', cliente: 'classico' };
const chaveLayouts = `agenda:layouts:${api.defaults.baseURL}`;
const layoutsValidos = ['classico', 'oceano', 'aurora', 'noite'];

function validarLayouts(layouts) {
  return layouts && layoutsValidos.includes(layouts.administrativo) && layoutsValidos.includes(layouts.cliente);
}

function lerLayoutsSalvos() {
  try {
    const salvos = JSON.parse(localStorage.getItem(chaveLayouts));
    return validarLayouts(salvos) ? salvos : padrao;
  } catch {
    return padrao;
  }
}

function persistirLayouts(layouts) {
  try {
    localStorage.setItem(chaveLayouts, JSON.stringify(layouts));
  } catch {
    // O banco continua sendo a fonte persistente se o navegador bloquear o armazenamento.
  }
}

export function LayoutProvider({ children }) {
  const [layouts, setLayouts] = useState(lerLayoutsSalvos);
  const [carregandoLayouts, setCarregandoLayouts] = useState(true);
  const [salvandoLayouts, setSalvandoLayouts] = useState(false);
  const salvamentoEmAndamento = useRef(false);
  const revisao = useRef(0);

  useEffect(() => {
    let ativo = true;
    const revisaoInicial = revisao.current;
    api.get('/configuracoes/layout')
      .then(({ data }) => {
        if (!ativo || revisao.current !== revisaoInicial || !validarLayouts(data)) return;
        persistirLayouts(data);
        setLayouts(data);
      })
      .catch(() => {
        // Uma falha de conexão não deve substituir a última escolha pelo padrão.
      })
      .finally(() => { if (ativo) setCarregandoLayouts(false); });
    return () => { ativo = false; };
  }, []);

  async function salvarLayouts(novosLayouts) {
    if (salvamentoEmAndamento.current) return;
    salvamentoEmAndamento.current = true;
    revisao.current += 1;
    setSalvandoLayouts(true);
    try {
      const { data } = await api.put('/configuracoes/layout', novosLayouts);
      if (!validarLayouts(data)) throw new Error('Resposta de layout inválida.');
      persistirLayouts(data);
      setLayouts(data);
    } finally {
      salvamentoEmAndamento.current = false;
      setSalvandoLayouts(false);
    }
  }

  return <LayoutContext.Provider value={{ layouts, salvarLayouts, carregandoLayouts, salvandoLayouts }}>{children}</LayoutContext.Provider>;
}

export function useLayouts() {
  const contexto = useContext(LayoutContext);
  if (!contexto) throw new Error('useLayouts deve ser usado dentro de LayoutProvider.');
  return contexto;
}
