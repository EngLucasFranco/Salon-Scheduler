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
  const [profissionais, setProfissionais] = useState([]);
  const [profissionalId, setProfissionalId] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [slotSelecionado, setSlotSelecionado] = useState(null);
  const [servicosCatalogo, setServicosCatalogo] = useState([]);
  const [servicosSelecionados, setServicosSelecionados] = useState([]);
  const [servicoEscolhido, setServicoEscolhido] = useState('');

  async function carregarAgenda(d) {
    setCarregando(true);
    setErro('');
    try {
      const { data: resp } = await api.get(`/agenda/${d}`, { params: { profissionalId } });
      setAgenda(resp);
    } catch (err) {
      setErro('Não foi possível carregar a agenda deste dia.');
    } finally {
      setCarregando(false);
    }
  }

  async function carregarAgendasAbertas() {
    try {
      const { data: agendas } = await api.get('/agenda/abertas', { params: { profissionalId } });
      setAgendasAbertas(agendas);
      setData((dataAtual) => {
        if (agendas.some((agendaAberta) => agendaAberta.data === dataAtual)) return dataAtual;
        return agendas.find((agendaAberta) => agendaAberta.data >= hoje())?.data || agendas[0]?.data || dataAtual;
      });
    } catch (err) {
      setErro('NÃ£o foi possÃ­vel carregar os dias com agenda aberta.');
    }
  }

  async function carregarServicos() {
    try {
      const { data: servicos } = await api.get('/servicos');
      setServicosCatalogo(servicos);
    } catch (err) {
      setErro('Não foi possível carregar os serviços disponíveis.');
    }
  }

  useEffect(() => {
    if (profissionalId) carregarAgenda(data);
    setMensagem('');
    setSlotSelecionado(null);
    setServicosSelecionados([]);
    setServicoEscolhido('');
  }, [data, profissionalId]);

  useEffect(() => {
    carregarServicos();
    api.get('/profissionais').then(({ data }) => {
      setProfissionais(data);
      if (data.length === 1) setProfissionalId(data[0].id);
    }).catch(() => setErro('Não foi possível carregar os profissionais.'));
  }, []);

  useEffect(() => { if (profissionalId) carregarAgendasAbertas(); }, [profissionalId]);

  function adicionarServico() {
    const servico = servicosCatalogo.find((item) => item.id === servicoEscolhido);
    if (!servico) return;
    setServicosSelecionados((anteriores) => [...anteriores, servico]);
    setServicoEscolhido('');
  }

  async function confirmarReserva() {
    if (!slotSelecionado || !servicosSelecionados.length) return;
    setErro('');
    try {
      await api.post(`/agenda/${data}/slots/${slotSelecionado._id}/reservar`, { servicos: servicosSelecionados.map((servico) => servico.id), profissionalId });
      setMensagem('Horário marcado com sucesso!');
      setSlotSelecionado(null);
      setServicosSelecionados([]);
      setServicoEscolhido('');
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

      {profissionais.length > 1 && (
        <div className="seletor-data"><label>Profissional<select value={profissionalId} onChange={(e) => setProfissionalId(e.target.value)}><option value="">Selecione um profissional</option>{profissionais.map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>)}</select></label></div>
      )}
      {!profissionais.length && <div className="aviso-vazio">Não há profissionais disponíveis para agendamento.</div>}

      {profissionalId && <>

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
            Serviço desejado
            <select value={servicoEscolhido} onChange={(e) => setServicoEscolhido(e.target.value)}>
              <option value="">Selecione</option>
              {servicosCatalogo.map((servico) => (
                <option key={servico.id} value={servico.id} disabled={servicosSelecionados.some((item) => item.id === servico.id)}>
                  {servico.nome} ({servico.duracaoMinutos} min)
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="botao-secundario" onClick={adicionarServico} disabled={!servicoEscolhido}>OK</button>
          {servicosSelecionados.length > 0 && (
            <div className="servicos-selecionados">
              <strong>Serviços selecionados</strong>
              {servicosSelecionados.map((servico) => (
                <div key={servico.id} className="servico-selecionado">
                  <span>{servico.nome} · {servico.duracaoMinutos} min</span>
                  <button type="button" className="botao-remover-servico" onClick={() => setServicosSelecionados((anteriores) => anteriores.filter((item) => item.id !== servico.id))} aria-label={`Remover ${servico.nome}`} title="Remover serviço">×</button>
                </div>
              ))}
              <span className="duracao-total">Tempo total: {servicosSelecionados.reduce((total, servico) => total + servico.duracaoMinutos, 0)} min</span>
            </div>
          )}
          <div className="painel-confirmacao-botoes">
            <button className="botao-secundario" onClick={() => setSlotSelecionado(null)}>
              Cancelar
            </button>
            <button onClick={confirmarReserva} disabled={!servicosSelecionados.length}>Confirmar marcação</button>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
