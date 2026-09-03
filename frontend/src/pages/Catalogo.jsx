import { useEffect, useState } from 'react';
import api from '../api/axios';
import AlertaTemporario from '../components/AlertaTemporario';

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
        <h2>Serviços cadastrados</h2>
        {carregando ? <p>Carregando serviços...</p> : servicos.length > 0 ? (
          <div className="lista-servicos">
            {servicos.map((servico) => (
              <div className="card-servico" key={servico.id}>
                <strong>{servico.nome}</strong>
                <span>{formatarDuracao(servico.duracaoMinutos)}</span>
              </div>
            ))}
          </div>
        ) : <div className="aviso-vazio">Nenhum serviço cadastrado ainda.</div>}
      </section>
    </div>
  );
}
