import { useEffect, useState } from 'react';
import api from '../api/axios';
import AlertaTemporario from '../components/AlertaTemporario';
import ModalConfirmacao from '../components/ModalConfirmacao';

const formularioInicial = { nome: '', duracaoMinutos: 30 };

function formatarDuracao(minutos) {
  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  if (!horas) return `${minutosRestantes} min`;
  return minutosRestantes ? `${horas}h ${minutosRestantes} min` : `${horas}h`;
}

export default function Catalogo() {
  const [servicos, setServicos] = useState([]);
  const [form, setForm] = useState(formularioInicial);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [servicoEmEdicao, setServicoEmEdicao] = useState(null);
  const [servicoParaExcluir, setServicoParaExcluir] = useState(null);
  const [formEdicao, setFormEdicao] = useState(formularioInicial);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [visualizacao, setVisualizacao] = useState('cards');

  async function carregarServicos() {
    setCarregando(true);
    try {
      const { data } = await api.get('/servicos');
      setServicos(data);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível carregar os serviços.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregarServicos(); }, []);

  async function salvar(evento) {
    evento.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await api.post('/servicos', form);
      setForm(formularioInicial);
      setMensagem('Serviço cadastrado com sucesso.');
      await carregarServicos();
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível cadastrar o serviço.');
    } finally {
      setSalvando(false);
    }
  }

  function abrirEdicao(servico) {
    setServicoEmEdicao(servico);
    setFormEdicao({ nome: servico.nome, duracaoMinutos: servico.duracaoMinutos });
    setErro('');
  }

  async function salvarEdicao(evento) {
    evento.preventDefault();
    setSalvandoEdicao(true);
    setErro('');
    try {
      await api.put(`/servicos/${servicoEmEdicao.id}`, formEdicao);
      setServicoEmEdicao(null);
      setMensagem('Serviço atualizado com sucesso.');
      await carregarServicos();
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível atualizar o serviço.');
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function confirmarExclusao() {
    if (!servicoParaExcluir) return;
    setExcluindo(true);
    setErro('');
    try {
      await api.delete(`/servicos/${servicoParaExcluir.id}`);
      setServicoParaExcluir(null);
      setMensagem('Serviço excluído com sucesso.');
      await carregarServicos();
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível excluir o serviço.');
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-header">
        <h1>Catálogo de serviços</h1>
        <p>Cadastre os serviços oferecidos e informe o tempo necessário para cada atendimento.</p>
      </header>

      <AlertaTemporario tipo="sucesso" mensagem={mensagem} />
      <AlertaTemporario tipo="erro" mensagem={erro} />

      <form className="card-cadastro-servico" onSubmit={salvar}>
        <h2>Novo serviço</h2>
        <div className="linha-form catalogo-form">
          <label>
            Nome do serviço
            <input value={form.nome} onChange={(e) => setForm((anterior) => ({ ...anterior, nome: e.target.value }))} placeholder="Ex.: Corte feminino" maxLength="100" required />
          </label>
          <label>
            Tempo de execução (minutos)
            <input type="number" min="5" max="720" step="5" value={form.duracaoMinutos} onChange={(e) => setForm((anterior) => ({ ...anterior, duracaoMinutos: e.target.value }))} required />
          </label>
          <button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Cadastrar serviço'}</button>
        </div>
      </form>

      <section className="lista-catalogo" aria-label="Serviços cadastrados">
        <div className="cabecalho-lista-catalogo">
          <h2>Serviços cadastrados</h2>
          <div className="seletor-visualizacao" role="group" aria-label="Visualização dos serviços">
            <button type="button" className={'botao-pequeno' + (visualizacao === 'cards' ? ' ativo' : ' botao-secundario')} aria-pressed={visualizacao === 'cards'} onClick={() => setVisualizacao('cards')}>Cards</button>
            <button type="button" className={'botao-pequeno' + (visualizacao === 'lista' ? ' ativo' : ' botao-secundario')} aria-pressed={visualizacao === 'lista'} onClick={() => setVisualizacao('lista')}>Lista</button>
          </div>
        </div>
        {carregando ? <p>Carregando serviços...</p> : servicos.length > 0 ? (
          <div className={'lista-servicos visualizacao-' + visualizacao}>
            {servicos.map((servico) => (
              <div className="card-servico" key={servico.id}>
                <div>
                  <strong>{servico.nome}</strong>
                  <span>{formatarDuracao(servico.duracaoMinutos)}</span>
                </div>
                <div className="acoes-servico">
                  <button type="button" className="botao-pequeno botao-secundario" onClick={() => abrirEdicao(servico)}>Editar</button>
                  <button type="button" className="botao-pequeno botao-perigo" onClick={() => setServicoParaExcluir(servico)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="aviso-vazio">Nenhum serviço cadastrado ainda.</div>}
      </section>

      {servicoEmEdicao && (
        <div className="modal-fundo" role="presentation" onMouseDown={() => !salvandoEdicao && setServicoEmEdicao(null)}>
          <form className="modal" onSubmit={salvarEdicao} onMouseDown={(evento) => evento.stopPropagation()}>
            <div className="modal-cabecalho">
              <h2>Editar serviço</h2>
              <button type="button" className="modal-fechar" onClick={() => setServicoEmEdicao(null)} disabled={salvandoEdicao} aria-label="Fechar">×</button>
            </div>
            <label>
              Nome do serviço
              <input value={formEdicao.nome} onChange={(e) => setFormEdicao((anterior) => ({ ...anterior, nome: e.target.value }))} maxLength="100" required />
            </label>
            <label>
              Tempo de execução (minutos)
              <input type="number" min="5" max="720" step="5" value={formEdicao.duracaoMinutos} onChange={(e) => setFormEdicao((anterior) => ({ ...anterior, duracaoMinutos: e.target.value }))} required />
            </label>
            {erro && <div className="alerta-erro" role="alert">{erro}</div>}
            <div className="modal-acoes">
              <button type="button" className="botao-secundario" onClick={() => setServicoEmEdicao(null)} disabled={salvandoEdicao}>Cancelar</button>
              <button type="submit" disabled={salvandoEdicao}>{salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}</button>
            </div>
          </form>
        </div>
      )}

      <ModalConfirmacao
        aberto={Boolean(servicoParaExcluir)}
        titulo="Excluir serviço"
        mensagem={servicoParaExcluir && <>Deseja excluir o serviço <strong>{servicoParaExcluir.nome}</strong>?</>}
        textoConfirmar="Excluir serviço"
        carregando={excluindo}
        onCancelar={() => setServicoParaExcluir(null)}
        onConfirmar={confirmarExclusao}
      />
    </div>
  );
}
