import { useEffect, useState } from 'react';
import api from '../api/axios';
import ModalConfirmacao from '../components/ModalConfirmacao';
import AlertaTemporario from '../components/AlertaTemporario';

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function formatarDataAba(data) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    .format(new Date(`${data}T00:00:00`))
    .replace('.', '');
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
  const [data, setData] = useState(hoje());
  const [agenda, setAgenda] = useState(null);
  const [agendas, setAgendas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [confirmacao, setConfirmacao] = useState(null);
  const [confirmando, setConfirmando] = useState(false);

  const [modalAgendaAberto, setModalAgendaAberto] = useState(false);
  const [formAgenda, setFormAgenda] = useState({ data: hoje(), inicio: '09:00', fim: '18:00', intervalo: 30 });

  async function carregarAgenda(d, emSegundoPlano = false) {
    if (!emSegundoPlano) setCarregando(true);
    setErro('');
    try {
      const { data: resp } = await api.get(`/agenda/${d}`);
      setAgenda(resp);
    } catch (err) {
      setErro('Não foi possível carregar a agenda deste dia.');
    } finally {
      if (!emSegundoPlano) setCarregando(false);
    }
  }

  async function carregarAgendasAbertas() {
    try {
      const { data: agendas } = await api.get('/agenda');
      setAgendas(agendas);
    } catch (err) {
      setErro('Não foi possível carregar os dias com agenda aberta.');
    }
  }

  useEffect(() => {
    carregarAgenda(data);
  }, [data]);

  useEffect(() => {
    carregarAgendasAbertas();
  }, []);

  const agendasAbertas = agendas.filter((item) => item.aberta);
  const agendaSelecionadaExiste = agendas.some((item) => item.data === data);

  function abrirModalAgenda() {
    setFormAgenda({ data, inicio: '09:00', fim: '18:00', intervalo: 30 });
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
      await api.post('/agenda', { data: formAgenda.data, inicio: formAgenda.inicio, fim: formAgenda.fim, intervalo: formAgenda.intervalo, horarios });
      setData(formAgenda.data);
      setModalAgendaAberto(false);
      setMensagem('Agenda do dia aberta/atualizada com sucesso!');
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
        await api.patch(`/agenda/${data}/fechar`);
        carregarAgendasAbertas();
      }
      if (confirmacao.tipo === 'excluir-agenda') {
        await api.delete(`/agenda/${data}`);
        setData(hoje());
        await Promise.all([carregarAgenda(hoje()), carregarAgendasAbertas()]);
        setConfirmacao(null);
        return;
      }
      if (confirmacao.tipo === 'cancelar') {
        await api.patch(`/agenda/${data}/slots/${confirmacao.slot._id}/cancelar`);
      }
      if (confirmacao.tipo === 'remover') {
        await api.delete(`/agenda/${data}/slots/${confirmacao.slot._id}`);
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
      await api.patch(`/agenda/${data}/slots/${slot._id}/bloquear`);
      await carregarAgenda(data, true);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível bloquear/desbloquear.');
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-header">
        <h1>Gerenciar Agenda</h1>
        <p>Abra os horários do dia e acompanhe as reservas dos clientes.</p>
      </header>

      <button className="botao-abrir-agenda" onClick={abrirModalAgenda}>Abrir agenda</button>

      <section className="agendas-abertas" aria-label="Agendas abertas">
        <div className="agendas-abertas-cabecalho">
          <strong>{agendasAbertas.length} {agendasAbertas.length === 1 ? 'dia com agenda aberta' : 'dias com agenda aberta'}</strong>
          <span>Selecione uma aba para visualizar o dia.</span>
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
                {slot.status === 'reservado' && (
                  <button className="botao-pequeno" onClick={() => setConfirmacao({ tipo: 'cancelar', slot })}>
                    Cancelar reserva
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

      <ModalConfirmacao
        aberto={Boolean(confirmacao)}
        titulo={confirmacao?.tipo === 'excluir-agenda' ? 'Excluir agenda' : confirmacao?.tipo === 'fechar' ? 'Fechar agenda' : confirmacao?.tipo === 'cancelar' ? 'Cancelar reserva' : 'Remover horário'}
        mensagem={
          confirmacao?.tipo === 'excluir-agenda'
            ? 'Deseja excluir toda a agenda deste dia? Todos os horários e reservas desta agenda serão removidos.'
            : confirmacao?.tipo === 'fechar'
            ? 'Deseja fechar a agenda deste dia? Os clientes não poderão fazer novas reservas.'
            : confirmacao?.tipo === 'cancelar'
              ? <>Deseja cancelar a reserva de <strong>{confirmacao.slot.clienteNome}</strong> às <strong>{confirmacao.slot.horario}</strong>?</>
              : confirmacao && <>Deseja remover o horário de <strong>{confirmacao.slot.horario}</strong>?</>
        }
        textoConfirmar={confirmacao?.tipo === 'excluir-agenda' ? 'Excluir agenda' : confirmacao?.tipo === 'fechar' ? 'Fechar agenda' : confirmacao?.tipo === 'cancelar' ? 'Cancelar reserva' : 'Remover horário'}
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
  );
}
