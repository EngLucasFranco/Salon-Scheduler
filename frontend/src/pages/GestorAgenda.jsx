import { useEffect, useState } from 'react';
import api from '../api/axios';
import ModalConfirmacao from '../components/ModalConfirmacao';
import AlertaTemporario from '../components/AlertaTemporario';
import { useAuth } from '../context/AuthContext';

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function formatarDataAba(data) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    .format(new Date(`${data}T00:00:00`))
    .replace('.', '');
}

function formatarTelefone(telefone) {
  const numeros = String(telefone || '').replace(/\D/g, '');
  if (numeros.length === 11) return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  if (numeros.length === 10) return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  return telefone || '';
}

// Gera uma lista de horários entre início e fim, com o intervalo dado (em minutos)
function gerarHorarios(inicio, fim, intervaloMin) {
  const [horaInicio, minutoInicio] = inicio.split(':').map(Number);
  const [horaFim, minutoFim] = fim.split(':').map(Number);
  const passo = Number(intervaloMin);
  const atualInicial = horaInicio * 60 + minutoInicio;
  const limite = horaFim * 60 + minutoFim;
  if (!Number.isInteger(passo) || passo < 5 || atualInicial > limite) return [];

  const horarios = [];
  for (let atual = atualInicial; atual <= limite; atual += passo) {
    horarios.push(`${String(Math.floor(atual / 60)).padStart(2, '0')}:${String(atual % 60).padStart(2, '0')}`);
  }
  return horarios;
}

export default function GestorAgenda() {
  const { usuario } = useAuth();
  const colaborador = usuario?.papel === 'colaborador';
  const [data, setData] = useState(hoje());
  const [agenda, setAgenda] = useState(null);
  const [agendas, setAgendas] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [profissionalId, setProfissionalId] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [confirmacao, setConfirmacao] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [pesquisaCliente, setPesquisaCliente] = useState('');
  const [slotParaMarcar, setSlotParaMarcar] = useState(null);
  const [clienteSelecionada, setClienteSelecionada] = useState(null);
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [modalMarcacaoAberto, setModalMarcacaoAberto] = useState(false);
  const [servicosCatalogo, setServicosCatalogo] = useState([]);
  const [servicosSelecionados, setServicosSelecionados] = useState([]);
  const [servicoEscolhido, setServicoEscolhido] = useState('');
  const [marcandoHorario, setMarcandoHorario] = useState(false);

  const [modalAgendaAberto, setModalAgendaAberto] = useState(false);
  const [formAgenda, setFormAgenda] = useState({ data: hoje(), inicio: '09:00', fim: '18:00', intervalo: 30 });

  async function carregarAgenda(d, emSegundoPlano = false) {
    if (!emSegundoPlano) setCarregando(true);
    setErro('');
    try {
      const { data: resp } = await api.get(`/agenda/${d}`, { params: { profissionalId } });
      setAgenda(resp);
    } catch (err) {
      setErro('Não foi possível carregar a agenda deste dia.');
    } finally {
      if (!emSegundoPlano) setCarregando(false);
    }
  }

  async function carregarAgendasAbertas() {
    try {
      const { data: agendas } = await api.get('/agenda', { params: { profissionalId } });
      setAgendas(agendas);
    } catch (err) {
      setErro('Não foi possível carregar os dias com agenda aberta.');
    }
  }

  useEffect(() => {
    if (profissionalId) carregarAgenda(data);
  }, [data, profissionalId]);

  useEffect(() => {
    if (colaborador) {
      setProfissionalId(usuario.profissionalId || '');
      return;
    }
    api.get('/profissionais').then(({ data }) => {
      setProfissionais(data);
      setProfissionalId(data[0]?.id || '');
    }).catch(() => setErro('Não foi possível carregar os profissionais.'));
  }, [colaborador, usuario?.profissionalId]);

  useEffect(() => {
    if (profissionalId) carregarAgendasAbertas();
  }, [profissionalId]);

  useEffect(() => {
    api.get('/servicos').then(({ data }) => setServicosCatalogo(data)).catch(() => setErro('Não foi possível carregar os serviços disponíveis.'));
  }, []);

  const agendasAbertas = agendas.filter((item) => item.aberta);
  const agendaSelecionadaExiste = agendas.some((item) => item.data === data);

  function abrirModalAgenda() {
    setFormAgenda({ data, inicio: '09:00', fim: '18:00', intervalo: 30, periodo: 'dia' });
    setErro('');
    setModalAgendaAberto(true);
  }

  function atualizarFormAgenda(campo, valor) {
    setFormAgenda((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function abrirAgendaDoDia(evento) {
    evento.preventDefault();
    setErro('');
    setMensagem('');
    const horarios = gerarHorarios(formAgenda.inicio, formAgenda.fim, formAgenda.intervalo);
    if (horarios.length === 0) {
      setErro('Informe horários válidos e um intervalo mínimo de 5 minutos.');
      return;
    }
    try {
      const { data: resposta } = await api.post('/agenda', { data: formAgenda.data, inicio: formAgenda.inicio, fim: formAgenda.fim, intervalo: formAgenda.intervalo, periodo: formAgenda.periodo, horarios, profissionalId });
      setData(formAgenda.data);
      setModalAgendaAberto(false);
      setMensagem(resposta.mensagem || 'Agenda aberta com sucesso!');
      carregarAgenda(formAgenda.data);
      carregarAgendasAbertas();
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível abrir a agenda.');
    }
  }

  async function executarConfirmacao() {
    if (!confirmacao) return;
    setConfirmando(true);
    try {
      if (confirmacao.tipo === 'fechar') {
        await api.patch(`/agenda/${data}/fechar?profissionalId=${profissionalId}`);
        carregarAgendasAbertas();
      }
      if (confirmacao.tipo === 'excluir-agenda') {
        await api.delete(`/agenda/${data}?profissionalId=${profissionalId}`);
        setData(hoje());
        await Promise.all([carregarAgenda(hoje()), carregarAgendasAbertas()]);
        setConfirmacao(null);
        return;
      }
      if (confirmacao.tipo === 'cancelar') {
        await api.patch(`/agenda/${data}/slots/${confirmacao.slot._id}/cancelar?profissionalId=${profissionalId}`);
      }
      if (confirmacao.tipo === 'cancelar-servico') {
        await api.patch(`/agenda/${data}/slots/${confirmacao.slot._id}/cancelar-servico/${confirmacao.servico.id}?profissionalId=${profissionalId}`);
      }
      if (confirmacao.tipo === 'remover') {
        await api.delete(`/agenda/${data}/slots/${confirmacao.slot._id}?profissionalId=${profissionalId}`);
      }
      setConfirmacao(null);
      carregarAgenda(data);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível concluir a ação.');
    } finally {
      setConfirmando(false);
    }
  }

  async function alternarBloqueio(slot) {
    try {
      await api.patch(`/agenda/${data}/slots/${slot._id}/bloquear?profissionalId=${profissionalId}`);
      await carregarAgenda(data, true);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível bloquear/desbloquear.');
    }
  }

  async function abrirSelecaoCliente(slot) {
    setErro('');
    setSlotParaMarcar(slot);
    setClienteSelecionada(null);
    setPesquisaCliente('');
    setServicosSelecionados([]);
    setServicoEscolhido('');
    setModalClienteAberto(true);
    setCarregandoClientes(true);
    try {
      const { data: listaClientes } = await api.get('/agenda/clientes');
      setClientes(listaClientes);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível carregar as clientes.');
      setModalClienteAberto(false);
    } finally {
      setCarregandoClientes(false);
    }
  }

  function selecionarCliente(cliente) {
    setClienteSelecionada(cliente);
    setModalClienteAberto(false);
    setModalMarcacaoAberto(true);
  }

  function adicionarServicoMarcacao() {
    const servico = servicosCatalogo.find((item) => item.id === servicoEscolhido);
    if (!servico) return;
    setServicosSelecionados((anteriores) => [...anteriores, servico]);
    setServicoEscolhido('');
  }

  function fecharMarcacao() {
    if (marcandoHorario) return;
    setModalClienteAberto(false);
    setModalMarcacaoAberto(false);
    setSlotParaMarcar(null);
    setClienteSelecionada(null);
    setServicosSelecionados([]);
    setServicoEscolhido('');
  }

  async function confirmarMarcacao(evento) {
    evento.preventDefault();
    if (!slotParaMarcar || !clienteSelecionada || !servicosSelecionados.length) return;
    if (!clienteSelecionada.id && !clienteSelecionada.nome.trim()) {
      setErro('Informe o nome da cliente.');
      return;
    }
    setMarcandoHorario(true);
    setErro('');
    try {
      await api.post(`/agenda/${data}/slots/${slotParaMarcar._id}/marcar`, {
        profissionalId,
        clienteId: clienteSelecionada.id || undefined,
        clienteNome: clienteSelecionada.id ? undefined : clienteSelecionada.nome.trim(),
        servicos: servicosSelecionados.map((servico) => servico.id),
      });
      setMensagem(`Horário marcado para ${clienteSelecionada.nome}.`);
      fecharMarcacao();
      await carregarAgenda(data, true);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível marcar este horário.');
    } finally {
      setMarcandoHorario(false);
    }
  }

  const normalizarPesquisa = (valor) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const termoPesquisa = normalizarPesquisa(pesquisaCliente);
  const termoTelefone = pesquisaCliente.replace(/\D/g, '');
  const clientesFiltradas = clientes
    .filter((cliente) => normalizarPesquisa(cliente.nome).includes(termoPesquisa) || (termoTelefone && String(cliente.telefone || '').replace(/\D/g, '').includes(termoTelefone)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

  return (
    <div className="pagina">
      <header className="pagina-header">
        <h1>Gerenciar Agenda</h1>
        <p>Abra os horários do dia e acompanhe as reservas dos clientes.</p>
      </header>

      {!colaborador && profissionais.length > 0 && (
        <section className="profissionais-agenda" aria-label="Agendas por profissional">
          <div className="profissionais-agenda-cabecalho">
            <strong>Agenda por profissional</strong>
            <span>Selecione um profissional para gerenciar seus horários e marcações.</span>
          </div>
          <div className="sub-abas" role="tablist" aria-label="Profissionais cadastrados">
            {profissionais.map((profissional) => (
              <button
                key={profissional.id}
                id={`aba-profissional-${profissional.id}`}
                type="button"
                role="tab"
                aria-selected={profissional.id === profissionalId}
                aria-controls="painel-agenda-profissional"
                className={'sub-aba' + (profissional.id === profissionalId ? ' ativa' : '')}
                onClick={() => setProfissionalId(profissional.id)}
              >
                {profissional.nome}
              </button>
            ))}
          </div>
        </section>
      )}
      {!colaborador && !profissionais.length && <div className="aviso-vazio">Cadastre ao menos um profissional em Configurações para abrir agendas.</div>}
      {colaborador && !profissionalId && <div className="aviso-vazio">Seu usuário ainda não está associado a um profissional. Solicite o ajuste a um gestor.</div>}

      <div id="painel-agenda-profissional" role="tabpanel" aria-labelledby={profissionalId ? `aba-profissional-${profissionalId}` : undefined}>
      <button className="botao-abrir-agenda" onClick={abrirModalAgenda} disabled={!profissionalId}>Abrir agenda</button>

      <section className="agendas-abertas" aria-label="Agendas abertas">
        <div className="agendas-abertas-cabecalho">
          <strong>{agendasAbertas.length} {agendasAbertas.length === 1 ? 'dia com agenda aberta' : 'dias com agenda aberta'}</strong>
          <span>Selecione o dia desejado.</span>
        </div>
        {agendas.length > 0 ? (
          <div className="sub-abas" role="tablist" aria-label="Dias com agenda cadastrada">
            {agendas.map((item) => (
              <button
                key={item.data}
                type="button"
                role="tab"
                aria-selected={item.data === data}
                className={'sub-aba' + (item.data === data ? ' ativa' : '') + (!item.aberta ? ' fechada' : '')}
                onClick={() => setData(item.data)}
              >
                {formatarDataAba(item.data)} {!item.aberta && '(fechada)'}
              </button>
            ))}
          </div>
        ) : (
          <span className="agendas-abertas-vazio">Nenhuma agenda cadastrada no momento.</span>
        )}
      </section>

      {agendaSelecionadaExiste && (
        <div className="linha-form-botoes acoes-agenda">
          <button className="botao-perigo" onClick={() => setConfirmacao({ tipo: 'excluir-agenda' })}>
            Excluir agenda
          </button>
        </div>
      )}

      <AlertaTemporario tipo="sucesso" mensagem={mensagem} />
      <AlertaTemporario tipo="erro" mensagem={erro} />
      {carregando && <p>Carregando horários...</p>}

      {!carregando && agenda && agenda.slots?.length > 0 && (
        <div className="lista-slots-gestor">
          {agenda.slots.map((slot) => (
            <div key={slot._id} className={'linha-slot status-' + slot.status}>
              <div className="linha-slot-info">
                <span className="linha-slot-horario">{slot.horario}</span>
                <span className={'badge badge-' + slot.status}>
                  {slot.status === 'disponivel' && 'Disponível'}
                  {slot.status === 'reservado' && 'Reservado'}
                  {slot.status === 'bloqueado' && 'Indisponível'}
                </span>
                {slot.status === 'reservado' && (
                  <span className="linha-slot-cliente">
                    {slot.clienteNome} {slot.servico && `· ${slot.servico}`}
                  </span>
                )}
              </div>
              <div className="linha-slot-acoes">
                {slot.status === 'reservado' && slot.reservaInicio !== false && (
                  <>
                    <button className="botao-pequeno" onClick={() => setConfirmacao({ tipo: 'cancelar', slot })}>
                      Cancelar reserva completa
                    </button>
                    {(slot.servicos || []).length > 1 && slot.servicos.map((servico) => (
                      <button key={servico.id} className="botao-pequeno botao-secundario" onClick={() => setConfirmacao({ tipo: 'cancelar-servico', slot, servico })}>
                        Cancelar {servico.nome}
                      </button>
                    ))}
                  </>
                )}
                {agenda.aberta && slot.status === 'disponivel' && (
                  <button className="botao-pequeno" onClick={() => abrirSelecaoCliente(slot)}>
                    Marcar cliente
                  </button>
                )}
                {slot.status !== 'reservado' && (
                  <button className="botao-pequeno" onClick={() => alternarBloqueio(slot)}>
                    {slot.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                  </button>
                )}
                {slot.status !== 'reservado' && (
                  <button className="botao-pequeno botao-perigo" onClick={() => setConfirmacao({ tipo: 'remover', slot })}>
                    Remover
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!carregando && (!agenda || !agenda.slots || agenda.slots.length === 0) && (
        <div className="aviso-vazio">Nenhum horário cadastrado para este dia ainda.</div>
      )}

      {modalClienteAberto && (
        <div className="modal-fundo" role="presentation" onMouseDown={fecharMarcacao}>
          <section className="modal modal-selecao-cliente" role="dialog" aria-modal="true" aria-labelledby="titulo-selecao-cliente" onMouseDown={(evento) => evento.stopPropagation()}>
            <div className="modal-cabecalho"><h2 id="titulo-selecao-cliente">Selecionar cliente</h2><button type="button" className="modal-fechar" onClick={fecharMarcacao} aria-label="Fechar">×</button></div>
            <p className="subtitulo">Marcação para {slotParaMarcar?.horario} em {data}.</p>
            <label>Pesquisar cliente<input value={pesquisaCliente} onChange={(evento) => setPesquisaCliente(evento.target.value)} placeholder="Digite o nome ou telefone" autoFocus /></label>
            <div className="lista-selecao-clientes" aria-label="Clientes disponíveis">
              <button type="button" className="opcao-cliente outro" onClick={() => selecionarCliente({ id: null, nome: '' })}><strong>Outro</strong><small>Cliente sem cadastro no sistema</small></button>
              {carregandoClientes ? <p>Carregando clientes...</p> : clientesFiltradas.length ? clientesFiltradas.map((cliente) => <button type="button" className="opcao-cliente" key={cliente.id} onClick={() => selecionarCliente(cliente)}><strong>{cliente.nome}{cliente.telefone && ` - ${formatarTelefone(cliente.telefone)}`}</strong></button>) : <p className="texto-suave">Nenhuma cliente encontrada.</p>}
            </div>
            <div className="modal-acoes"><button type="button" className="botao-secundario" onClick={fecharMarcacao}>Cancelar</button></div>
          </section>
        </div>
      )}

      {modalMarcacaoAberto && clienteSelecionada && (
        <div className="modal-fundo" role="presentation" onMouseDown={fecharMarcacao}>
          <form className="modal modal-marcacao-cliente" role="dialog" aria-modal="true" aria-labelledby="titulo-marcacao-cliente" onSubmit={confirmarMarcacao} onMouseDown={(evento) => evento.stopPropagation()}>
            <div className="modal-cabecalho"><h2 id="titulo-marcacao-cliente">Marcar horário</h2><button type="button" className="modal-fechar" onClick={fecharMarcacao} disabled={marcandoHorario} aria-label="Fechar">×</button></div>
            <p className="subtitulo">{data} às {slotParaMarcar?.horario}</p>
            {clienteSelecionada.id ? <p className="cliente-selecionada"><strong>Cliente:</strong> {clienteSelecionada.nome}</p> : <label>Nome da cliente<input value={clienteSelecionada.nome} onChange={(evento) => setClienteSelecionada((anterior) => ({ ...anterior, nome: evento.target.value }))} placeholder="Informe o nome" maxLength="120" autoFocus required /></label>}
            <label>Serviço<select value={servicoEscolhido} onChange={(evento) => setServicoEscolhido(evento.target.value)}><option value="">Selecione</option>{servicosCatalogo.filter((servico) => servico.tipo !== 'produto').map((servico) => <option key={servico.id} value={servico.id} disabled={servicosSelecionados.some((item) => item.id === servico.id)}>{servico.nome} ({servico.duracaoMinutos} min)</option>)}</select></label>
            <button type="button" className="botao-secundario" onClick={adicionarServicoMarcacao} disabled={!servicoEscolhido}>Adicionar serviço</button>
            {servicosSelecionados.length > 0 && <div className="servicos-selecionados"><strong>Serviços selecionados</strong>{servicosSelecionados.map((servico) => <div key={servico.id} className="servico-selecionado"><span>{servico.nome} · {servico.duracaoMinutos} min</span><button type="button" className="botao-remover-servico" onClick={() => setServicosSelecionados((anteriores) => anteriores.filter((item) => item.id !== servico.id))} aria-label={`Remover ${servico.nome}`}>×</button></div>)}<span className="duracao-total">Tempo total: {servicosSelecionados.reduce((total, servico) => total + servico.duracaoMinutos, 0)} min</span></div>}
            <div className="modal-acoes"><button type="button" className="botao-secundario" onClick={fecharMarcacao} disabled={marcandoHorario}>Cancelar</button><button type="submit" disabled={marcandoHorario || !servicosSelecionados.length}>{marcandoHorario ? 'Marcando...' : 'Confirmar marcação'}</button></div>
          </form>
        </div>
      )}

      <ModalConfirmacao
        aberto={Boolean(confirmacao)}
        titulo={confirmacao?.tipo === 'excluir-agenda' ? 'Excluir agenda' : confirmacao?.tipo === 'fechar' ? 'Fechar agenda' : confirmacao?.tipo === 'cancelar' ? 'Cancelar reserva' : confirmacao?.tipo === 'cancelar-servico' ? 'Cancelar serviço' : 'Remover horário'}
        mensagem={
          confirmacao?.tipo === 'excluir-agenda'
            ? 'Deseja excluir toda a agenda deste dia? Todos os horários e reservas desta agenda serão removidos.'
            : confirmacao?.tipo === 'fechar'
            ? 'Deseja fechar a agenda deste dia? Os clientes não poderão fazer novas reservas.'
            : confirmacao?.tipo === 'cancelar'
              ? <>Deseja cancelar a reserva de <strong>{confirmacao.slot.clienteNome}</strong> às <strong>{confirmacao.slot.horario}</strong>?</>
              : confirmacao?.tipo === 'cancelar-servico'
                ? <>Deseja cancelar o serviço <strong>{confirmacao.servico.nome}</strong> da reserva de <strong>{confirmacao.slot.clienteNome}</strong>?</>
              : confirmacao && <>Deseja remover o horário de <strong>{confirmacao.slot.horario}</strong>?</>
        }
        textoConfirmar={confirmacao?.tipo === 'excluir-agenda' ? 'Excluir agenda' : confirmacao?.tipo === 'fechar' ? 'Fechar agenda' : confirmacao?.tipo === 'cancelar' ? 'Cancelar reserva' : confirmacao?.tipo === 'cancelar-servico' ? 'Cancelar serviço' : 'Remover horário'}
        carregando={confirmando}
        onCancelar={() => setConfirmacao(null)}
        onConfirmar={executarConfirmacao}
      />

      {modalAgendaAberto && (
        <div className="modal-fundo" role="presentation" onMouseDown={() => setModalAgendaAberto(false)}>
          <form className="modal modal-agenda" onSubmit={abrirAgendaDoDia} onMouseDown={(evento) => evento.stopPropagation()}>
            <div className="modal-cabecalho">
              <h2>Abrir agenda</h2>
              <button type="button" className="modal-fechar" onClick={() => setModalAgendaAberto(false)} aria-label="Fechar">×</button>
            </div>
            <p className="subtitulo">Selecione a data e defina os horários disponíveis.</p>
            <AlertaTemporario tipo="erro" mensagem={erro} />
            <label>
              Data da agenda
              <input type="date" min={hoje()} value={formAgenda.data} onChange={(e) => atualizarFormAgenda('data', e.target.value)} required />
            </label>
            <fieldset className="seletor-periodo-agenda">
              <legend>Abrir para</legend>
              {[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']].map(([valor, rotulo]) => <label key={valor} className={formAgenda.periodo === valor ? 'selecionado' : ''}><input type="radio" name="periodo-agenda" value={valor} checked={formAgenda.periodo === valor} onChange={(e) => atualizarFormAgenda('periodo', e.target.value)} /><span>{rotulo}</span></label>)}
            </fieldset>
            <div className="linha-form linha-form-modal">
              <label>
                Início
                <input type="time" value={formAgenda.inicio} onChange={(e) => atualizarFormAgenda('inicio', e.target.value)} required />
              </label>
              <label>
                Fim
                <input type="time" value={formAgenda.fim} onChange={(e) => atualizarFormAgenda('fim', e.target.value)} required />
              </label>
              <label>
                Intervalo (min)
                <input type="number" min="5" step="5" value={formAgenda.intervalo} onChange={(e) => atualizarFormAgenda('intervalo', e.target.value)} required />
              </label>
            </div>
            <div className="modal-acoes">
              <button type="button" className="botao-secundario" onClick={() => setModalAgendaAberto(false)}>Cancelar</button>
              <button type="submit">OK</button>
            </div>
          </form>
        </div>
      )}
      </div>
    </div>
  );
}
