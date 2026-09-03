export default function ModalConfirmacao({ aberto, titulo, mensagem, textoConfirmar = 'Confirmar', carregando, onCancelar, onConfirmar }) {
  if (!aberto) return null;

  return (
    <div className="modal-fundo" role="presentation" onMouseDown={carregando ? undefined : onCancelar}>
      <div className="modal modal-confirmacao" role="dialog" aria-modal="true" aria-labelledby="titulo-confirmacao" onMouseDown={(evento) => evento.stopPropagation()}>
        <div className="modal-cabecalho">
          <h2 id="titulo-confirmacao">{titulo}</h2>
          <button type="button" className="modal-fechar" onClick={onCancelar} disabled={carregando} aria-label="Fechar">×</button>
        </div>
        <p>{mensagem}</p>
        <p className="subtitulo">Esta ação não pode ser desfeita.</p>
        <div className="modal-acoes">
          <button type="button" className="botao-secundario" onClick={onCancelar} disabled={carregando}>Cancelar</button>
          <button type="button" className="botao-confirmar-exclusao" onClick={onConfirmar} disabled={carregando}>
            {carregando ? 'Confirmando...' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
