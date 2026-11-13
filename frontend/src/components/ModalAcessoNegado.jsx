import { useEffect, useState } from 'react';

const STORAGE_KEY = 'nexus_access_error';
const BLOCKED_KEY = 'nexus_access_blocked';
const EVENT_NAME = 'nexus-access-denied';

export default function ModalAcessoNegado() {
  const [aberto, setAberto] = useState(() => (
    Boolean(sessionStorage.getItem(STORAGE_KEY))
    || sessionStorage.getItem(BLOCKED_KEY) === 'true'
  ));

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENT_NAME, abrir);
    return () => window.removeEventListener(EVENT_NAME, abrir);
  }, []);

  function fechar() {
    sessionStorage.removeItem(STORAGE_KEY);
    setAberto(false);
  }

  if (!aberto) return null;

  return (
    <div className="modal-fundo modal-fundo-nexus" role="presentation">
      <section className="modal modal-acesso-negado" role="alertdialog" aria-modal="true" aria-labelledby="titulo-acesso-negado">
        <div className="modal-cabecalho">
          <h2 id="titulo-acesso-negado">Erro de autenticação, acesso negado.</h2>
        </div>
        <p>Entre em contato com o desenvolvedor Lucas Pires Franco</p>
        <div className="contato-acesso-negado">
          <p><strong>Contato:</strong> (035) 99746-8037</p>
          <p><strong>e-mail:</strong> lpfranco09@gmail.com</p>
        </div>
        <div className="modal-acoes">
          <button type="button" onClick={fechar} autoFocus>Fechar</button>
        </div>
      </section>
    </div>
  );
}
