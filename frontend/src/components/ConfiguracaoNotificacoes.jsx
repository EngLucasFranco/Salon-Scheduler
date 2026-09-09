import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function ConfiguracaoNotificacoes() {
  const [configuracoes, setConfiguracoes] = useState({ horasAntecedenciaCliente: 2, mensagemCliente: '' });
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => { api.get('/configuracoes/notificacoes').then(({ data }) => setConfiguracoes(data)).catch(() => setMensagem('Não foi possível carregar as notificações.')); }, []);
  async function salvar(evento) {
    evento.preventDefault(); setSalvando(true); setMensagem('');
    try { const { data } = await api.put('/configuracoes/notificacoes', configuracoes); setConfiguracoes(data); setMensagem('Notificações salvas com sucesso.'); }
    catch (erro) { setMensagem(erro.response?.data?.mensagem || 'Não foi possível salvar as notificações.'); }
    finally { setSalvando(false); }
  }

  return <form className="card-profissional formulario-notificacoes" onSubmit={salvar}>
    <h2>Notificações para clientes</h2><p>Defina quando o lembrete aparecerá na área da cliente.</p>
    <label>Horas antes do horário agendado<input type="number" min="0" max="720" value={configuracoes.horasAntecedenciaCliente} onChange={(evento) => setConfiguracoes({ ...configuracoes, horasAntecedenciaCliente: evento.target.value })} required /></label>
    <label>Mensagem da notificação<textarea value={configuracoes.mensagemCliente} onChange={(evento) => setConfiguracoes({ ...configuracoes, mensagemCliente: evento.target.value })} maxLength="500" required /></label>
    {mensagem && <p className="mensagem-configuracao">{mensagem}</p>}<button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar notificações'}</button>
  </form>;
}
