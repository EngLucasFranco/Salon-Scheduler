import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function chaveData(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formasPagamento(cobranca) {
  if (cobranca.formasPagamento?.length) return cobranca.formasPagamento.map((forma) => `${forma.formaPagamentoNome}: ${moeda(forma.valor)}`).join(' + ');
  return cobranca.formaPagamentoNome || 'Não informado';
}

export default function HistoricoFechamento({ aberto, onFechar }) {
  const agora = new Date();
  const [mes, setMes] = useState(() => new Date(agora.getFullYear(), agora.getMonth(), 1));
  const [fechamentos, setFechamentos] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!aberto) return;
    const atual = new Date();
    setMes(new Date(atual.getFullYear(), atual.getMonth(), 1));
    setSelecionado(null);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const inicio = chaveData(new Date(mes.getFullYear(), mes.getMonth(), 1));
    const fim = chaveData(new Date(mes.getFullYear(), mes.getMonth() + 1, 0));
    setCarregando(true); setErro(''); setSelecionado(null);
    api.get('/cobrancas/fechamentos', { params: { inicio, fim } })
      .then((resposta) => setFechamentos(resposta.data))
      .catch((e) => { setFechamentos([]); setErro(e.response?.data?.mensagem || 'Não foi possível carregar o histórico.'); })
      .finally(() => setCarregando(false));
  }, [aberto, mes]);

  const fechamentosPorData = useMemo(() => new Map(fechamentos.map((item) => [item.data, item])), [fechamentos]);
  const quantidadeDias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const espacosIniciais = new Date(mes.getFullYear(), mes.getMonth(), 1).getDay();
  const hoje = chaveData(new Date());
  const dias = Array.from({ length: quantidadeDias }, (_, indice) => indice + 1);

  function mudarMes(diferenca) {
    setMes((anterior) => new Date(anterior.getFullYear(), anterior.getMonth() + diferenca, 1));
  }

  if (!aberto) return null;

  return <div className="modal-fundo" onMouseDown={onFechar}>
    <section className="modal modal-historico-fechamento" role="dialog" aria-modal="true" aria-label="Histórico de fechamento" onMouseDown={(evento) => evento.stopPropagation()}>
      <div className="modal-cabecalho"><div><h2>Histórico de Fechamento</h2><p className="subtitulo">Os fechamentos completos ficam disponíveis por 120 dias.</p></div><button type="button" className="modal-fechar" onClick={onFechar} aria-label="Fechar">×</button></div>
      <div className="historico-conteudo">
        <section className="calendario-fechamentos" aria-label={`${NOMES_MESES[mes.getMonth()]} de ${mes.getFullYear()}`}>
          <div className="calendario-cabecalho"><button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button><strong>{NOMES_MESES[mes.getMonth()]} {mes.getFullYear()}</strong><button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button></div>
          <div className="calendario-grade calendario-semana">{DIAS_SEMANA.map((dia) => <span key={dia}>{dia}</span>)}</div>
          <div className="calendario-grade calendario-dias">
            {Array.from({ length: espacosIniciais }, (_, indice) => <span className="calendario-vazio" key={`vazio-${indice}`} />)}
            {dias.map((dia) => {
              const dataDia = chaveData(new Date(mes.getFullYear(), mes.getMonth(), dia));
              const fechamento = fechamentosPorData.get(dataDia);
              const classes = ['dia-calendario', fechamento ? 'com-fechamento' : 'sem-fechamento', dataDia === hoje ? 'hoje' : '', selecionado?.data === dataDia ? 'selecionado' : ''].filter(Boolean).join(' ');
              return <button type="button" className={classes} key={dataDia} disabled={!fechamento} onClick={() => fechamento && setSelecionado(fechamento)} aria-label={fechamento ? `${dia}, fechamento disponível` : `${dia}, sem fechamento`}><span>{dia}</span></button>;
            })}
          </div>
          {carregando && <p className="calendario-status">Carregando histórico...</p>}
          {erro && <p className="alerta-erro">{erro}</p>}
          {!carregando && !erro && <div className="legenda-calendario"><span><i className="legenda-com" />Com fechamento</span><span><i className="legenda-sem" />Sem fechamento</span><span><i className="legenda-hoje" />Hoje</span></div>}
        </section>

        <section className="detalhes-fechamento">
          {!selecionado ? <div className="historico-orientacao"><strong>Selecione uma data destacada</strong><span>Os dias em cinza não possuem fechamento.</span></div> : <>
            <div className="detalhes-fechamento-cabecalho"><div><h3>Fechamento de {selecionado.data.split('-').reverse().join('/')}</h3><small>Fechado em {selecionado.fechadoEm ? new Date(selecionado.fechadoEm).toLocaleString('pt-BR') : 'horário não informado'}</small></div></div>
            <div className="resumo-fechamento"><div><span>Entradas</span><strong>{moeda(selecionado.total)}</strong></div><div><span>Saídas</span><strong>{moeda(selecionado.totalSaidas)}</strong></div><div><span>Saldo</span><strong>{moeda(selecionado.saldo ?? selecionado.total)}</strong></div></div>
            <div className="historico-lista"><h4>Vendas ({selecionado.cobrancas?.length || 0})</h4>{selecionado.cobrancas?.length ? selecionado.cobrancas.map((cobranca) => <article className="historico-venda" key={cobranca.id}><div className="historico-registro-topo"><div><strong>{cobranca.clienteNome}</strong><span>{cobranca.profissionalNome || 'Profissional não informado'}</span></div><strong>{moeda(cobranca.total)}</strong></div><ul>{(cobranca.itens || []).map((item, indice) => <li key={`${cobranca.id}-item-${indice}`}><span>{item.quantidade}× {item.nome}</span><span>{moeda(Number(item.valorUnitario) * Number(item.quantidade))}</span></li>)}</ul><small>{formasPagamento(cobranca)}</small>{(Number(cobranca.desconto) > 0 || Number(cobranca.acrescimo) > 0) && <small>Desconto: {moeda(cobranca.desconto)} · Acréscimo: {moeda(cobranca.acrescimo)}</small>}</article>) : <p className="aviso-vazio">Nenhuma venda neste fechamento.</p>}</div>
            <div className="historico-lista"><h4>Saídas ({selecionado.saidas?.length || 0})</h4>{selecionado.saidas?.length ? selecionado.saidas.map((saida) => <article className="historico-saida" key={saida.id}><div><strong>Saída do caixa</strong><span>{saida.meioPagamento}</span></div><strong>- {moeda(saida.valor)}</strong></article>) : <p className="aviso-vazio">Nenhuma saída neste fechamento.</p>}</div>
          </>}
        </section>
      </div>
    </section>
  </div>;
}
