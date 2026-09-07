import { useEffect, useState } from 'react';
import api from '../api/axios';
import AlertaTemporario from '../components/AlertaTemporario';
import ModalConfirmacao from '../components/ModalConfirmacao';

function formatarData(data) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function dataLocal(data) {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

function diaDaSemana(data) {
  const dia = dataLocal(data).toLocaleDateString('pt-BR', { weekday: 'long' });
  return `${dia[0].toUpperCase()}${dia.slice(1)}`;
}

function situacaoReserva(data) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataReserva = dataLocal(data);
  if (dataReserva < hoje) return 'passada';
  if (dataReserva > hoje) return 'futura';
  return 'hoje';
}

function podeCancelarReserva(reserva, limiteCancelamentoHoras, agora) {
  if (limiteCancelamentoHoras === null) return false;
  const [ano, mes, dia] = reserva.data.split('-').map(Number);
  const [hora, minuto] = reserva.horario.split(':').map(Number);
  const inicio = new Date(ano, mes - 1, dia, hora, minuto).getTime();
  return inicio - agora >= Number(limiteCancelamentoHoras) * 60 * 60 * 1000;
}

export default function MinhasReservas() {
  const [reservas, setReservas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [reservaParaExcluir, setReservaParaExcluir] = useState(null);
  const [reservaParaCancelar, setReservaParaCancelar] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [limiteCancelamentoHoras, setLimiteCancelamentoHoras] = useState(2);
  const [agora, setAgora] = useState(Date.now());

  async function carregar() {
    setCarregando(true);
    try {
      const [{ data: reservasCarregadas }, { data: configuracoes }] = await Promise.all([api.get('/agenda/minhas-reservas'), api.get('/configuracoes/geral')]);
      setReservas(reservasCarregadas);
      setLimiteCancelamentoHoras(configuracoes.limiteCancelamentoHoras === null ? null : Number(configuracoes.limiteCancelamentoHoras || 0));
    } catch (err) {
      setErro('Não foi possível carregar suas reservas.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    const atualizador = window.setInterval(() => setAgora(Date.now()), 60 * 1000);
    return () => window.clearInterval(atualizador);
  }, []);

  async function excluirReservaPassada() {
    if (!reservaParaExcluir) return;
    setExcluindo(true);
    setErro('');
    try {
      await api.delete(`/agenda/minhas-reservas/${reservaParaExcluir.data}/slots/${reservaParaExcluir.slotId}`);
      setReservas((anteriores) => anteriores.filter((reserva) => reserva.slotId !== reservaParaExcluir.slotId));
      setReservaParaExcluir(null);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível excluir a reserva da lista.');
    } finally {
      setExcluindo(false);
    }
  }

  async function cancelarReserva() {
    if (!reservaParaCancelar) return;
    setCancelando(true);
    setErro('');
    try {
      await api.patch(`/agenda/minhas-reservas/${reservaParaCancelar.data}/slots/${reservaParaCancelar.slotId}/cancelar`);
      setReservas((anteriores) => anteriores.filter((reserva) => reserva.slotId !== reservaParaCancelar.slotId));
      setReservaParaCancelar(null);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível cancelar a reserva.');
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-header">
        <h1>Minhas Reservas</h1>
        <p>Seus horários marcados no salão.</p>
      </header>

      <AlertaTemporario tipo="erro" mensagem={erro} />
      {carregando && <p>Carregando...</p>}

      {!carregando && reservas.length === 0 && (
        <div className="aviso-vazio">Você ainda não tem nenhum horário marcado.</div>
      )}

      {!carregando && reservas.length > 0 && (
        <div className="lista-reservas">
          {reservas.map((r, indice) => {
            const situacao = situacaoReserva(r.data);
            const corFutura = situacao === 'futura' ? ` card-reserva-futura-${indice % 3}` : '';
            return (
            <div key={r.slotId} className={`card-reserva card-reserva-${situacao}${corFutura}`}>
              <div>
                <div className="card-reserva-data">{formatarData(r.data)} • {diaDaSemana(r.data)} • {r.horario}</div>
                {(r.profissionalNome || r.servico) && <div className="card-reserva-servico">{[r.profissionalNome, r.servico].filter(Boolean).join(' - ')}</div>}
              </div>
              <div className="acoes-reserva">
                {situacao !== 'passada' && podeCancelarReserva(r, limiteCancelamentoHoras, agora) && <button type="button" className="botao-cancelar-reserva" onClick={() => setReservaParaCancelar(r)}>Cancelar</button>}
                {situacao === 'passada' && <button type="button" className="botao-excluir-reserva" onClick={() => setReservaParaExcluir(r)} aria-label={`Excluir reserva de ${formatarData(r.data)}`} title="Excluir reserva da lista">🗑</button>}
              </div>
            </div>
            );
          })}
        </div>
      )}
      <ModalConfirmacao
        aberto={Boolean(reservaParaExcluir)}
        titulo="Excluir reserva da lista"
        mensagem={reservaParaExcluir && <>Deseja excluir a reserva de <strong>{formatarData(reservaParaExcluir.data)}</strong> da sua lista?</>}
        textoConfirmar="Excluir reserva"
        carregando={excluindo}
        onCancelar={() => setReservaParaExcluir(null)}
        onConfirmar={excluirReservaPassada}
      />
      <ModalConfirmacao
        aberto={Boolean(reservaParaCancelar)}
        titulo="Cancelar reserva"
        mensagem={reservaParaCancelar && <>Deseja cancelar a reserva de <strong>{formatarData(reservaParaCancelar.data)}</strong> às <strong>{reservaParaCancelar.horario}</strong>?</>}
        textoConfirmar="Cancelar reserva"
        carregando={cancelando}
        onCancelar={() => setReservaParaCancelar(null)}
        onConfirmar={cancelarReserva}
      />
    </div>
  );
}
