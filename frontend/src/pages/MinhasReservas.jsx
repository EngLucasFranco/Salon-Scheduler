import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function MinhasReservas() {
  const [reservas, setReservas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

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

  async function cancelar(reserva) {
    if (!confirm(`Cancelar o horário de ${reserva.horario} em ${reserva.data}?`)) return;
    try {
      await api.patch(`/agenda/${reserva.data}/slots/${reserva.slotId}/cancelar-meu`);
      carregar();
    } catch (err) {
      alert(err.response?.data?.mensagem || 'Não foi possível cancelar.');
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-header">
        <h1>Minhas Reservas</h1>
        <p>Seus horários marcados no salão.</p>
      </header>

      {erro && <div className="alerta-erro">{erro}</div>}
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
              <button className="botao-secundario" onClick={() => cancelar(r)}>
                Cancelar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
