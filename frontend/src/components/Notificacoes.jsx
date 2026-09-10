import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const sino = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
const lixeira = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" /></svg>;
const atualizar = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" /></svg>;

export default function Notificacoes() {
  const [notificacoes, setNotificacoes] = useState([]);
  const [aberto, setAberto] = useState(false);
  const { usuario } = useAuth();
  const naoLidas = notificacoes.filter((notificacao) => !notificacao.lida);
  const notificacoesPorProfissional = usuario?.papel === 'gestor'
    ? notificacoes.reduce((grupos, notificacao) => {
      const profissional = notificacao.profissionalNome || 'Profissional removido';
      (grupos[profissional] ||= []).push(notificacao);
      return grupos;
    }, {})
    : null;

  async function carregar() {
    try { const { data } = await api.get('/notificacoes'); setNotificacoes(data); } catch { /* Tela segue utilizável. */ }
  }

  useEffect(() => {
    carregar();
    const intervalo = window.setInterval(carregar, 30 * 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  async function marcarComoLida(notificacao) {
    if (notificacao.lida) return;
    setNotificacoes((anteriores) => anteriores.map((item) => item.id === notificacao.id ? { ...item, lida: true } : item));
    try { await api.patch('/notificacoes/lidas', { ids: [notificacao.id] }); } catch { carregar(); }
  }

  async function excluir(notificacao) {
    setNotificacoes((anteriores) => anteriores.filter((item) => item.id !== notificacao.id));
    try { await api.delete(`/notificacoes/${notificacao.id}`); } catch { carregar(); }
  }

  function atualizarAgenda() { window.dispatchEvent(new Event('agenda:atualizar')); }

  function itemNotificacao(notificacao) {
    return <article key={notificacao.id} className={!notificacao.lida ? 'nao-lida' : ''} onDoubleClick={() => marcarComoLida(notificacao)} title={notificacao.lida ? undefined : 'Dê duplo clique para marcar como lida'}>
      <div><strong>{notificacao.titulo}</strong><p>{notificacao.mensagem}</p>{notificacao.dataReserva && <small>{notificacao.dataReserva.split('-').reverse().join('/')} às {notificacao.horarioReserva}</small>}</div>
      <button type="button" className="botao-excluir-notificacao" onClick={() => excluir(notificacao)} aria-label={`Excluir ${notificacao.titulo}`} title="Excluir notificação">{lixeira}</button>
    </article>;
  }

  const itensNotificacao = usuario?.papel === 'gestor'
    ? Object.entries(notificacoesPorProfissional).map(([profissional, itens]) => <section className="grupo-notificacoes-profissional" key={profissional}><h3>{profissional}</h3>{itens.map(itemNotificacao)}</section>)
    : notificacoes.map(itemNotificacao);

  return <div className="area-notificacoes">
    <button type="button" className={`card-notificacoes${naoLidas.length ? ' possui-nao-lidas' : ''}`} onClick={() => setAberto(true)} aria-label="Abrir notificações">{sino}<span>Notificações</span>{naoLidas.length > 0 && <strong>{naoLidas.length}</strong>}</button>
    {aberto && <div className="modal-fundo" onMouseDown={() => setAberto(false)}><section className="modal modal-notificacoes" role="dialog" aria-modal="true" aria-label="Notificações" onMouseDown={(evento) => evento.stopPropagation()}><div className="modal-cabecalho"><h2>Notificações</h2><div className="modal-cabecalho-acoes">{usuario?.papel !== 'cliente' && <button type="button" className="modal-atualizar" onClick={atualizarAgenda} aria-label="Atualizar Gerenciar Agenda" title="Atualizar Gerenciar Agenda">{atualizar}</button>}<button type="button" className="modal-fechar" onClick={() => setAberto(false)} aria-label="Fechar">×</button></div></div><div className="lista-notificacoes">{notificacoes.length ? itensNotificacao : <p>Nenhuma notificação.</p>}</div></section></div>}
  </div>;
}
