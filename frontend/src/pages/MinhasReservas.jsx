import { useEffect, useState } from 'react';
import api from '../api/axios';
import ModalConfirmacao from '../components/ModalConfirmacao';
import AlertaTemporario from '../components/AlertaTemporario';

export default function MinhasReservas() {
  const [reservas, setReservas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [reservaParaCancelar, setReservaParaCancelar] = useState(null);
  const [cancelando, setCancelando] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const { data } = await api.get('/agenda/minhas-reservas');
      setReservas(data);
    } catch (err) {
      setErro('Não foi possível carregar suas reservas.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function cancelarReserva() {
    if (!reservaParaCancelar) return;
    setCancelando(true);
    try {
      await api.patch(`/agenda/${reservaParaCancelar.data}/slots/${reservaParaCancelar.slotId}/cancelar-meu`);
      setReservaParaCancelar(null);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível cancelar.');
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
          {reservas.map((r) => (
            <div key={r.slotId} className="card-reserva">
              <div>
                <div className="card-reserva-data">{r.data} às {r.horario}</div>
                {r.servico && <div className="card-reserva-servico">{r.servico}</div>}
              </div>
              <button className="botao-secundario" onClick={() => setReservaParaCancelar(r)}>
                Cancelar
              </button>
            </div>
          ))}
        </div>
      )}

      <ModalConfirmacao
        aberto={Boolean(reservaParaCancelar)}
        titulo="Cancelar reserva"
        mensagem={reservaParaCancelar && <>Deseja cancelar o horário de <strong>{reservaParaCancelar.horario}</strong> em <strong>{reservaParaCancelar.data}</strong>?</>}
        textoConfirmar="Cancelar reserva"
        carregando={cancelando}
        onCancelar={() => setReservaParaCancelar(null)}
        onConfirmar={cancelarReserva}
      />
    </div>
  );
}
