import { useEffect, useState } from 'react';
import api from '../api/axios';

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

// Gera uma lista de horários entre início e fim, com o intervalo dado (em minutos)
function gerarHorarios(inicio, fim, intervaloMin) {
  const horarios = [];
  const [hIni, mIni] = inicio.split(':').map(Number);
  const [hFim, mFim] = fim.split(':').map(Number);
  let atual = hIni * 60 + mIni;
  const limite = hFim * 60 + mFim;

  while (atual <= limite) {
    const h = String(Math.floor(atual / 60)).padStart(2, '0');
    const m = String(atual % 60).padStart(2, '0');
    horarios.push(`${h}:${m}`);
    atual += Number(intervaloMin);
  }
  return horarios;
}

export default function GestorAgenda() {
  const [data, setData] = useState(hoje());
  const [agenda, setAgenda] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [inicio, setInicio] = useState('09:00');
  const [fim, setFim] = useState('18:00');
  const [intervalo, setIntervalo] = useState(30);

  async function carregarAgenda(d) {
    setCarregando(true);
    setErro('');
    try {
      const { data: resp } = await api.get(`/agenda/${d}`);
      setAgenda(resp);
    } catch (err) {
      setErro('Não foi possível carregar a agenda deste dia.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarAgenda(data);
    setMensagem('');
  }, [data]);

  async function abrirAgendaDoDia() {
    setErro('');
    setMensagem('');
    const horarios = gerarHorarios(inicio, fim, intervalo);
    if (horarios.length === 0) {
      setErro('Intervalo de horários inválido.');
      return;
    }
    try {
      await api.post('/agenda', { data, horarios });
      setMensagem('Agenda do dia aberta/atualizada com sucesso!');
      carregarAgenda(data);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível abrir a agenda.');
    }
  }

  async function fecharAgendaDoDia() {
    if (!confirm('Fechar a agenda deste dia? Os clientes deixarão de enxergar novos horários.')) return;
    try {
      await api.patch(`/agenda/${data}/fechar`);
      carregarAgenda(data);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível fechar a agenda.');
    }
  }

  async function alternarBloqueio(slot) {
    try {
      await api.patch(`/agenda/${data}/slots/${slot._id}/bloquear`);
      carregarAgenda(data);
    } catch (err) {
      alert(err.response?.data?.mensagem || 'Não foi possível bloquear/desbloquear.');
    }
  }

  async function cancelarReserva(slot) {
    if (!confirm(`Cancelar a reserva de ${slot.clienteNome} às ${slot.horario}?`)) return;
    try {
      await api.patch(`/agenda/${data}/slots/${slot._id}/cancelar`);
      carregarAgenda(data);
    } catch (err) {
      alert(err.response?.data?.mensagem || 'Não foi possível cancelar.');
    }
  }

  async function removerSlot(slot) {
    if (!confirm(`Remover o horário ${slot.horario}?`)) return;
    try {
      await api.delete(`/agenda/${data}/slots/${slot._id}`);
      carregarAgenda(data);
    } catch (err) {
      alert(err.response?.data?.mensagem || 'Não foi possível remover.');
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-header">
        <h1>Gerenciar Agenda</h1>
        <p>Abra os horários do dia e acompanhe as reservas dos clientes.</p>
      </header>

      <div className="seletor-data">
        <label>
          Data
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
      </div>

      <div className="card-abrir-agenda">
        <h3>Abrir/complementar horários deste dia</h3>
        <div className="linha-form">
          <label>
            Início
            <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label>
            Fim
            <input type="time" value={fim} onChange={(e) => setFim(e.target.value)} />
          </label>
          <label>
            Intervalo (min)
            <input
              type="number"
              min="5"
              step="5"
              value={intervalo}
              onChange={(e) => setIntervalo(e.target.value)}
            />
          </label>
        </div>
        <div className="linha-form-botoes">
          <button onClick={abrirAgendaDoDia}>Abrir / atualizar agenda</button>
          {agenda?.aberta && (
            <button className="botao-secundario" onClick={fecharAgendaDoDia}>
              Fechar agenda do dia
            </button>
          )}
        </div>
      </div>

      {mensagem && <div className="alerta-sucesso">{mensagem}</div>}
      {erro && <div className="alerta-erro">{erro}</div>}
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
                  {slot.status === 'bloqueado' && 'Bloqueado'}
                </span>
                {slot.status === 'reservado' && (
                  <span className="linha-slot-cliente">
                    {slot.clienteNome} {slot.servico && `· ${slot.servico}`}
                  </span>
                )}
              </div>
              <div className="linha-slot-acoes">
                {slot.status === 'reservado' && (
                  <button className="botao-pequeno" onClick={() => cancelarReserva(slot)}>
                    Cancelar reserva
                  </button>
                )}
                {slot.status !== 'reservado' && (
                  <button className="botao-pequeno" onClick={() => alternarBloqueio(slot)}>
                    {slot.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                  </button>
                )}
                {slot.status !== 'reservado' && (
                  <button className="botao-pequeno botao-perigo" onClick={() => removerSlot(slot)}>
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
    </div>
  );
}
