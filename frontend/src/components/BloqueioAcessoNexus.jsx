import { useEffect, useState } from 'react';
import api from '../api/axios';
import ModalAcessoNegado from './ModalAcessoNegado';

const BLOCKED_KEY = 'nexus_access_blocked';
const EVENT_NAME = 'nexus-access-denied';
const CHECK_INTERVAL_MS = 10 * 1000;

export default function BloqueioAcessoNexus({ children }) {
  const [bloqueado, setBloqueado] = useState(() => sessionStorage.getItem(BLOCKED_KEY) === 'true');

  useEffect(() => {
    const bloquear = () => setBloqueado(true);
    window.addEventListener(EVENT_NAME, bloquear);
    return () => window.removeEventListener(EVENT_NAME, bloquear);
  }, []);

  useEffect(() => {
    if (!bloqueado) return undefined;

    async function verificarLiberacao() {
      try {
        const { data } = await api.get('/licenca/status', { skipNexusModal: true });
        if (data.online === true && data.licenseStatus === 'ATIVA') {
          sessionStorage.removeItem(BLOCKED_KEY);
          sessionStorage.removeItem('nexus_access_error');
          window.location.replace('/login');
        }
      } catch {
        // O programa permanece bloqueado até uma confirmação ATIVA.
      }
    }

    const intervalId = window.setInterval(verificarLiberacao, CHECK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [bloqueado]);

  if (!bloqueado) return children;

  return (
    <>
      <ModalAcessoNegado />
      <main className="tela-bloqueio-nexus" aria-label="Programa bloqueado aguardando autorização">
        <div className="conteudo-bloqueio-nexus" role="status" aria-label="Erro de autenticação. Acesso negado.">
          <p className="legenda-bloqueio legenda-bloqueio-superior">Erro de autenticação</p>
          <div className="animacao-bloqueio-nexus" aria-hidden="true">
            <span className="orbita-bloqueio orbita-externa" />
            <span className="orbita-bloqueio orbita-interna" />
            <span className="cadeado-bloqueio">
              <i className="haste-cadeado" />
              <i className="corpo-cadeado"><b /></i>
            </span>
          </div>
          <p className="legenda-bloqueio legenda-bloqueio-inferior">Acesso negado</p>
        </div>
      </main>
    </>
  );
}
