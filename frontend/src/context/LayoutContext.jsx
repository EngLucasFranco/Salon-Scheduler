import { createContext, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/axios';

const LayoutContext = createContext(null);
const padrao = { administrativo: 'classico', cliente: 'classico' };
const chaveLayouts = `agenda:layouts:${api.defaults.baseURL}`;
const canalLayouts = `agenda:layouts-atualizados:${api.defaults.baseURL}`;
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

  function aplicarLayouts(novosLayouts) {
    if (!validarLayouts(novosLayouts)) return;
    persistirLayouts(novosLayouts);
    setLayouts(novosLayouts);
  }

  useEffect(() => {
    const receberLayouts = (novosLayouts) => aplicarLayouts(novosLayouts);
    const aoAlterarStorage = (evento) => {
      if (evento.key !== chaveLayouts || !evento.newValue) return;
      try { receberLayouts(JSON.parse(evento.newValue)); } catch { /* Ignora valores inválidos. */ }
    };
    const canal = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(canalLayouts);
    const aoReceberMensagem = (evento) => receberLayouts(evento.data);

    window.addEventListener('storage', aoAlterarStorage);
    canal?.addEventListener('message', aoReceberMensagem);
    return () => {
      window.removeEventListener('storage', aoAlterarStorage);
      canal?.removeEventListener('message', aoReceberMensagem);
      canal?.close();
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    const revisaoInicial = revisao.current;
    api.get('/configuracoes/layout')
      .then(({ data }) => {
        if (!ativo || revisao.current !== revisaoInicial || !validarLayouts(data)) return;
        aplicarLayouts(data);
      })
      .catch(() => {
        // Uma falha de conexão não deve substituir a última escolha pelo padrão.
      })
      .finally(() => { if (ativo) setCarregandoLayouts(false); });
    return () => { ativo = false; };
  }, []);

  async function salvarLayouts(novosLayouts) {
    if (salvamentoEmAndamento.current) return;
    const layoutsAnteriores = layouts;
    salvamentoEmAndamento.current = true;
    revisao.current += 1;
    setSalvandoLayouts(true);
    aplicarLayouts(novosLayouts);
    try {
      const { data } = await api.put('/configuracoes/layout', novosLayouts);
      if (!validarLayouts(data)) throw new Error('Resposta de layout inválida.');
      aplicarLayouts(data);
      if (typeof BroadcastChannel !== 'undefined') {
        const canal = new BroadcastChannel(canalLayouts);
        canal.postMessage(data);
        canal.close();
      }
    } catch (erro) {
      aplicarLayouts(layoutsAnteriores);
      throw erro;
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
