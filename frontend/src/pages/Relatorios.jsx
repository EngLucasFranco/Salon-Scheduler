import { useEffect, useState } from 'react';
import api from '../api/axios';

const hoje = () => new Date().toISOString().slice(0, 10);
const inicioMes = () => `${hoje().slice(0, 8)}01`;
const moeda = (valor) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Relatorios() {
  const [inicio, setInicio] = useState(inicioMes()); const [fim, setFim] = useState(hoje()); const [cobrancas, setCobrancas] = useState([]); const [erro, setErro] = useState('');
  async function carregar() { try { const { data } = await api.get('/cobrancas/relatorio-financeiro', { params: { inicio, fim } }); setCobrancas(data); } catch (e) { setErro(e.response?.data?.mensagem || 'Não foi possível gerar o relatório.'); } }
  useEffect(() => { carregar(); }, []);
  const total = cobrancas.reduce((soma, item) => soma + Number(item.total), 0); const ranking = {};
  cobrancas.forEach((cobranca) => (cobranca.itens || []).forEach((item) => { ranking[item.nome] = (ranking[item.nome] || 0) + Number(item.quantidade || 0); }));
  return <div className="pagina"><header className="pagina-header"><h1>Relatórios financeiros</h1><p>Recebimentos e serviços no período selecionado.</p></header><div className="filtros-dashboard"><label>Início<input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label><label>Fim<input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></label><button onClick={carregar}>Gerar relatório</button></div>{erro && <div className="alerta-erro">{erro}</div>}<div className="dashboard-cards"><div className="dashboard-indicador"><small>Faturamento</small><strong>{moeda(total)}</strong></div><div className="dashboard-indicador"><small>Qtd Pagamentos</small><strong>{cobrancas.length}</strong></div><div className="dashboard-indicador"><small>Ticket médio</small><strong>{moeda(cobrancas.length ? total / cobrancas.length : 0)}</strong></div></div><section className="lista-cobrancas"><h2>Serviços mais realizados</h2>{Object.keys(ranking).length ? Object.entries(ranking).sort((a, b) => b[1] - a[1]).map(([nome, quantidade]) => <div className="registro-cobranca" key={nome}><span>{nome}</span><strong>{quantidade}x</strong></div>) : <div className="aviso-vazio">Nenhum pagamento no período.</div>}</section></div>;
}
