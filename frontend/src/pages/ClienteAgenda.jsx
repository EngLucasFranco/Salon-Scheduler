import { useEffect, useState } from 'react';
import api from '../api/axios';
import AlertaTemporario from '../components/AlertaTemporario';

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function formatarDataAba(data) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    .format(new Date(`${data}T00:00:00`))
    .replace('.', '');
}

export default function ClienteAgenda() {
  const [data, setData] = useState(hoje());
  const [agenda, setAgenda] = useState(null);
  const [agendasAbertas, setAgendasAbertas] = useState([]);
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

  async function carregarAgendasAbertas() {
    try {
      const { data: agendas } = await api.get('/agenda/abertas');
      setAgendasAbertas(agendas);
      setData((dataAtual) => {
        if (agendas.some((agendaAberta) => agendaAberta.data === dataAtual)) return dataAtual;
        return agendas.find((agendaAberta) => agendaAberta.data >= hoje())?.data || agendas[0]?.data || dataAtual;
      });
    } catch (err) {
      setErro('NÃ£o foi possÃ­vel carregar os dias com agenda aberta.');
    }
  }

  useEffect(() => {
    carregarAgenda(data);
    setMensagem('');
    setSlotSelecionado(null);
    setServico('');
  }, [data]);

  useEffect(() => {
    carregarAgendasAbertas();
  }, []);

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

      <section className="agendas-abertas" aria-label="Agendas abertas">
        <div className="agendas-abertas-cabecalho">
          <strong>{agendasAbertas.length} {agendasAbertas.length === 1 ? 'dia com agenda aberta' : 'dias com agenda aberta'}</strong>
          <span>Selecione uma aba para visualizar o dia.</span>
        </div>
        {agendasAbertas.length > 0 ? (
          <div className="sub-abas" role="tablist" aria-label="Dias com agenda aberta">
            {agendasAbertas.map((item) => (
              <button
                key={item.data}
                type="button"
                role="tab"
                aria-selected={item.data === data}
                className={'sub-aba' + (item.data === data ? ' ativa' : '')}
                onClick={() => setData(item.data)}
              >
                {formatarDataAba(item.data)}
              </button>
            ))}
          </div>
        ) : (
          <span className="agendas-abertas-vazio">Nenhuma agenda aberta no momento.</span>
        )}
      </section>

      <AlertaTemporario tipo="sucesso" mensagem={mensagem} />
      <AlertaTemporario tipo="erro" mensagem={erro} />

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
