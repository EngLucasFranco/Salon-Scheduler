import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

function hoje() { const agora = new Date(); return new Date(agora - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function moeda(valor) { return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`; }

function meiosDaCobranca(cobranca) {
  return cobranca.formasPagamento?.length ? cobranca.formasPagamento.map((pagamento) => pagamento.formaPagamentoNome) : (cobranca.formaPagamentoNome ? [cobranca.formaPagamentoNome] : []);
}

export default function Dashboard() {
  const [data, setData] = useState(hoje);
  const [cobrancas, setCobrancas] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [meioPagamento, setMeioPagamento] = useState('');
  const [colaborador, setColaborador] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      setCarregando(true); setErro('');
      try {
        const cobrancasResposta = await api.get('/cobrancas', { params: { data } });
        setCobrancas(cobrancasResposta.data);
        api.get('/profissionais').then(({ data: lista }) => setProfissionais(lista)).catch(() => setProfissionais([]));
      } catch (err) { setErro(err.response?.data?.mensagem || 'Não foi possível carregar os indicadores.'); }
      finally { setCarregando(false); }
    }
    carregar();
  }, [data]);

  const meiosPagamento = useMemo(() => [...new Set(cobrancas.flatMap(meiosDaCobranca))].sort((a, b) => a.localeCompare(b)), [cobrancas]);
  const cobrancasFiltradas = cobrancas.filter((cobranca) => (!meioPagamento || meiosDaCobranca(cobranca).includes(meioPagamento)) && (!colaborador || cobranca.profissionalNome === colaborador));
  const total = cobrancasFiltradas.reduce((soma, cobranca) => soma + Number(cobranca.total), 0);
  const custoProdutos = cobrancasFiltradas.reduce((soma, cobranca) => soma + cobranca.itens.filter((item) => item.tipo === 'produto').reduce((subtotal, item) => subtotal + Number(item.custoUnitario || 0) * Number(item.quantidade || 0), 0), 0);
  const servicosExecutados = cobrancasFiltradas.reduce((soma, cobranca) => soma + cobranca.itens.filter((item) => item.tipo === 'servico').reduce((quantidade, item) => quantidade + Number(item.quantidade), 0), 0);
  const produtosVendidos = cobrancasFiltradas.reduce((soma, cobranca) => soma + cobranca.itens.filter((item) => item.tipo === 'produto').reduce((quantidade, item) => quantidade + Number(item.quantidade), 0), 0);
  const clientesAtendidos = new Set(cobrancasFiltradas.map((cobranca) => cobranca.clienteNome).filter(Boolean)).size;

  return <div className="pagina dashboard">
    <header className="pagina-header"><h1>Dashboard</h1><p>Acompanhe os recebimentos e resultados do seu negócio.</p></header>
    <section className="filtros-dashboard" aria-label="Filtros do dashboard">
      <label>Data<input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
      <label>Meio de pagamento<select value={meioPagamento} onChange={(e) => setMeioPagamento(e.target.value)}><option value="">Geral</option>{meiosPagamento.map((meio) => <option key={meio} value={meio}>{meio}</option>)}</select></label>
      <label>Colaboradores<select value={colaborador} onChange={(e) => setColaborador(e.target.value)}><option value="">Geral</option>{profissionais.map((profissional) => <option key={profissional.id} value={profissional.nome}>{profissional.nome}</option>)}</select></label>
    </section>
    <section className="dashboard-cards" aria-label="Indicadores financeiros">
      <article className="dashboard-indicador"><span>Total recebido</span><strong>{moeda(total)}</strong><small>no período selecionado</small></article>
      <article className="dashboard-indicador indicador-claro"><span>Pagamentos registrados</span><strong>{cobrancasFiltradas.length}</strong><small>vendas encontradas</small></article>
      <article className="dashboard-indicador indicador-claro"><span>Custo</span><strong>{moeda(custoProdutos)}</strong><small>dos produtos vendidos</small></article>
      <article className="dashboard-indicador indicador-claro"><span>Serviços executados</span><strong>{servicosExecutados}</strong><small>no período selecionado</small></article>
      <article className="dashboard-indicador indicador-claro"><span>Produtos vendidos</span><strong>{produtosVendidos}</strong><small>no período selecionado</small></article>
      <article className="dashboard-indicador indicador-claro"><span>Clientes atendidos</span><strong>{clientesAtendidos}</strong><small>clientes únicos</small></article>
    </section>
    <section className="lista-cobrancas"><h2>Pagamentos Registrados</h2>{carregando ? <p>Carregando pagamentos...</p> : erro ? <div className="alerta-erro">{erro}</div> : cobrancasFiltradas.length ? cobrancasFiltradas.map((cobranca) => <article className="registro-cobranca" key={cobranca.id}><div><strong>{cobranca.clienteNome}</strong><span>{cobranca.itens.map((item) => `${item.quantidade}× ${item.nome}`).join(', ')}</span><small>{[cobranca.profissionalNome, meiosDaCobranca(cobranca).join(' + ')].filter(Boolean).join(' · ')}</small></div><strong>{moeda(cobranca.total)}</strong></article>) : <div className="aviso-vazio">Nenhum pagamento registrado.</div>}</section>
  </div>;
}
