import { useEffect, useState } from 'react';
import api from '../api/axios';

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

export default function ClienteAgenda() {
  const [data, setData] = useState(hoje());
  const [agenda, setAgenda] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [slotSelecionado, setSlotSelecionado] = useState(null);
  const [servico, setServico] = useState('');

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

  async function confirmarReserva() {
    if (!slotSelecionado) return;
    setErro('');
    try {
      await api.post(`/agenda/${data}/slots/${slotSelecionado._id}/reservar`, { servico });
      setMensagem('Horário marcado com sucesso!');
      setSlotSelecionado(null);
      setServico('');
      carregarAgenda(data);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível marcar este horário.');
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-header">
        <h1>Agenda Disponível</h1>
        <p>Escolha um dia e marque seu horário.</p>
      </header>

      <div className="seletor-data">
        <label>
          Data
          <input type="date" value={data} min={hoje()} onChange={(e) => setData(e.target.value)} />
        </label>
      </div>

      {mensagem && <div className="alerta-sucesso">{mensagem}</div>}
      {erro && <div className="alerta-erro">{erro}</div>}

      {carregando && <p>Carregando horários...</p>}

      {!carregando && agenda && !agenda.aberta && (
        <div className="aviso-vazio">A agenda deste dia ainda não foi aberta pelo salão.</div>
      )}

      {!carregando && agenda?.aberta && agenda.slots.length === 0 && (
        <div className="aviso-vazio">Nenhum horário cadastrado para este dia.</div>
      )}

      {!carregando && agenda?.aberta && agenda.slots.length > 0 && (
        <div className="grade-horarios">
          {agenda.slots.map((slot) => {
            const ocupado = slot.status !== 'disponivel';
            const selecionado = slotSelecionado?._id === slot._id;
            return (
              <button
                key={slot._id}
                disabled={ocupado}
                className={
                  'chip-horario' +
                  (ocupado ? ' ocupado' : '') +
                  (slot.minhaReserva ? ' minha-reserva' : '') +
                  (selecionado ? ' selecionado' : '')
                }
                onClick={() => setSlotSelecionado(slot)}
                title={slot.minhaReserva ? 'Você reservou este horário' : ocupado ? 'Indisponível' : 'Disponível'}
              >
                {slot.horario}
              </button>
            );
          })}
        </div>
      )}

      {slotSelecionado && (
        <div className="painel-confirmacao">
          <h3>Confirmar horário {slotSelecionado.horario}</h3>
          <label>
            Serviço desejado (opcional)
            <input
              value={servico}
              onChange={(e) => setServico(e.target.value)}
              placeholder="Ex: corte, escova, coloração..."
            />
          </label>
          <div className="painel-confirmacao-botoes">
            <button className="botao-secundario" onClick={() => setSlotSelecionado(null)}>
              Cancelar
            </button>
            <button onClick={confirmarReserva}>Confirmar marcação</button>
          </div>
        </div>
      )}
    </div>
  );
}
