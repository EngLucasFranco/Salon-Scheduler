export default function PaginaEmBreve({ titulo, descricao }) {
  return (
    <div className="pagina">
      <header className="pagina-header">
        <h1>{titulo}</h1>
        <p>{descricao}</p>
      </header>

      <div className="aviso-vazio">
        Esta área está pronta para receber suas configurações.
      </div>
    </div>
  );
}
