import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';
import AlertaTemporario from '../components/AlertaTemporario';
import ModalConfirmacao from '../components/ModalConfirmacao';

function hoje() { const agora = new Date(); return new Date(agora - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function moeda(valor) { return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`; }
function centavosParaValor(centavos) { return Number(centavos || 0) / 100; }
function mascaraMoeda(centavos) { return moeda(centavosParaValor(centavos)); }

function CampoMoeda({ valorEmCentavos, onChange, ...props }) {
  const inputRef = useRef(null);
  const quantidadeDigitosAntesCursor = useRef(null);
  const valorFormatado = mascaraMoeda(valorEmCentavos);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const quantidade = quantidadeDigitosAntesCursor.current;
    if (!input || quantidade === null) return;
    let vistos = 0; let posicao = valorFormatado.length;
    for (let indice = 0; indice < valorFormatado.length; indice += 1) {
      if (/\d/.test(valorFormatado[indice])) vistos += 1;
      if (vistos >= quantidade) { posicao = indice + 1; break; }
    }
    input.setSelectionRange(posicao, posicao);
    quantidadeDigitosAntesCursor.current = null;
  }, [valorFormatado]);

  function alterar(evento) {
    const cursor = evento.target.selectionStart || 0;
    quantidadeDigitosAntesCursor.current = evento.target.value.slice(0, cursor).replace(/\D/g, '').length;
    const digitos = evento.target.value.replace(/\D/g, '');
    onChange(Number(digitos || 0));
  }

  return <input {...props} ref={inputRef} type="text" inputMode="numeric" value={valorFormatado} onChange={alterar} />;
}

export default function FluxoCaixa() {
  const [data, setData] = useState(hoje);
  const [atendimentos, setAtendimentos] = useState([]); const [catalogo, setCatalogo] = useState([]); const [formas, setFormas] = useState([]); const [cobrancas, setCobrancas] = useState([]); const [colaboradores, setColaboradores] = useState([]);
  const [reservaId, setReservaId] = useState(''); const [itensExtras, setItensExtras] = useState([]); const [formaPagamentoId, setFormaPagamentoId] = useState(''); const [pagamentosPersonalizados, setPagamentosPersonalizados] = useState({}); const [desconto, setDesconto] = useState(0); const [acrescimo, setAcrescimo] = useState(0); const [nomeClienteAvulsa, setNomeClienteAvulsa] = useState(''); const [colaboradorId, setColaboradorId] = useState('');
  const [cobrancaAberta, setCobrancaAberta] = useState(false); const [seletorItensAberto, setSeletorItensAberto] = useState(false); const [itensEmSelecao, setItensEmSelecao] = useState([]); const [abaItensAtiva, setAbaItensAtiva] = useState('servicos');
  const [carregando, setCarregando] = useState(true); const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState(''); const [mensagem, setMensagem] = useState(''); const [confirmacaoFechamentoAberta, setConfirmacaoFechamentoAberta] = useState(false); const [fechandoCaixa, setFechandoCaixa] = useState(false);

  async function carregar() {
    setCarregando(true); setErro('');
    try { const [a, c, f, r, p] = await Promise.all([api.get('/cobrancas/atendimentos', { params: { data } }), api.get('/servicos'), api.get('/formas-pagamento'), api.get('/cobrancas', { params: { data } }), api.get('/profissionais')]); setAtendimentos(a.data); setCatalogo(c.data); setFormas(f.data); setCobrancas(r.data); setColaboradores(p.data); }
    catch (err) { setErro(err.response?.data?.mensagem || 'Não foi possível carregar os dados do caixa.'); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, [data]);
  const atendimento = atendimentos.find((item) => item.reservaId === reservaId);
  const cobrancaAvulsa = reservaId === '__outro__';
  const servicosMarcados = useMemo(() => (atendimento?.servicos || []).map((servico) => { const item = catalogo.find((x) => String(x.id) === String(servico.id)); return item ? { ...item, quantidade: 1 } : null; }).filter(Boolean), [atendimento, catalogo]);
  const itens = [...servicosMarcados, ...itensExtras]; const subtotal = itens.reduce((soma, item) => soma + Number(item.valor) * Number(item.quantidade), 0); const total = Math.max(0, subtotal - centavosParaValor(desconto) + centavosParaValor(acrescimo)); const totalDia = cobrancas.reduce((soma, item) => soma + Number(item.total), 0);
  const totalPersonalizado = formas.reduce((soma, forma) => soma + centavosParaValor(pagamentosPersonalizados[forma.id]), 0);
  const pagamentoPersonalizadoExato = Math.abs(totalPersonalizado - total) <= 0.009;
  const diferencaPagamentoPersonalizado = totalPersonalizado - total;
  const pagamentoPersonalizadoMaior = diferencaPagamentoPersonalizado > 0.009;

  function limparCobranca() { setReservaId(''); setItensExtras([]); setItensEmSelecao([]); setFormaPagamentoId(''); setPagamentosPersonalizados({}); setDesconto(0); setAcrescimo(0); setNomeClienteAvulsa(''); setColaboradorId(''); setCobrancaAberta(false); setSeletorItensAberto(false); setErro(''); }
  function mudarAtendimento(valor) { setReservaId(valor); setItensExtras([]); setFormaPagamentoId(''); setPagamentosPersonalizados({}); setDesconto(0); setAcrescimo(0); setNomeClienteAvulsa(''); setColaboradorId(''); setErro(''); setMensagem(''); }
  function mudarFormaPagamento(valor) { setFormaPagamentoId(valor); setPagamentosPersonalizados({}); }
  function abrirCobranca() { if (!atendimento && !cobrancaAvulsa) { setErro('Selecione uma cliente antes de continuar.'); return; } if (atendimento?.cobrado) { setErro('Este atendimento já foi cobrado.'); return; } setErro(''); setCobrancaAberta(true); }
  function abrirSeletorItens() { setItensEmSelecao(itensExtras.map((item) => ({ ...item }))); setAbaItensAtiva('servicos'); setSeletorItensAberto(true); }
  function descartarSelecaoItens() { setItensEmSelecao([]); setSeletorItensAberto(false); }
  function concluirSelecaoItens() { setItensExtras(itensEmSelecao); descartarSelecaoItens(); }
  function adicionarItem(item) { setItensEmSelecao((anteriores) => { const existente = anteriores.find((x) => String(x.id) === String(item.id)); return existente ? anteriores.map((x) => String(x.id) === String(item.id) ? { ...x, quantidade: x.quantidade + 1 } : x) : [...anteriores, { ...item, quantidade: 1 }]; }); }
  function alterarQuantidade(id, quantidade) { const valor = Number(quantidade); setItensExtras((anteriores) => valor < 1 ? anteriores.filter((item) => String(item.id) !== String(id)) : anteriores.map((item) => String(item.id) === String(id) ? { ...item, quantidade: valor } : item)); }
  function alterarQuantidadeSelecao(id, quantidade) { const valor = Number(quantidade); setItensEmSelecao((anteriores) => valor < 1 ? anteriores.filter((item) => String(item.id) !== String(id)) : anteriores.map((item) => String(item.id) === String(id) ? { ...item, quantidade: valor } : item)); }
  function quantidadeExtra(id) { return itensEmSelecao.find((item) => String(item.id) === String(id))?.quantidade || 0; }
  async function cobrar() {
    if (!atendimento && !cobrancaAvulsa) return;
    if (cobrancaAvulsa && !nomeClienteAvulsa.trim()) { setErro('Informe o nome da cliente.'); return; }
    if (cobrancaAvulsa && !colaboradorId) { setErro('Selecione o colaborador responsável.'); return; }
    if (formaPagamentoId === 'personalizado' && !pagamentoPersonalizadoExato) { setErro('A soma dos pagamentos deve ser igual ao valor total da cobrança.'); return; }
    setSalvando(true); setErro(''); setMensagem('');
    try { await api.post('/cobrancas', { data, reservaId: atendimento?.reservaId || `avulsa-${Date.now()}-${Math.random().toString(36).slice(2)}`, clienteNome: atendimento?.clienteNome || nomeClienteAvulsa.trim(), profissionalNome: atendimento?.profissionalNome || '', profissionalId: cobrancaAvulsa ? colaboradorId : '', formaPagamentoId, pagamentos: formas.filter((forma) => Number(pagamentosPersonalizados[forma.id] || 0) > 0).map((forma) => ({ formaPagamentoId: forma.id, valor: centavosParaValor(pagamentosPersonalizados[forma.id]) })), desconto: centavosParaValor(desconto), acrescimo: centavosParaValor(acrescimo), itens: itens.map((item) => ({ catalogoId: item.id, quantidade: item.quantidade })) }); setMensagem('Cobrança registrada com sucesso.'); limparCobranca(); await carregar(); }
    catch (err) { setErro(err.response?.data?.mensagem || 'Não foi possível registrar a cobrança.'); } finally { setSalvando(false); }
  }
  async function fecharCaixa() {
    setFechandoCaixa(true); setErro(''); setMensagem('');
    try { await api.post('/cobrancas/fechar-caixa', { data }); limparCobranca(); setConfirmacaoFechamentoAberta(false); setMensagem('Caixa fechado com sucesso. O movimento ficará disponível para consulta por 90 dias.'); await carregar(); }
    catch (err) { setErro(err.response?.data?.mensagem || 'Não foi possível fechar o caixa.'); }
    finally { setFechandoCaixa(false); }
  }

  return <div className="pagina fluxo-caixa">
    <header className="pagina-header"><h1>Fluxo de caixa</h1><p>Registre os recebimentos dos atendimentos e dos produtos vendidos.</p></header>
    <AlertaTemporario tipo="sucesso" mensagem={mensagem} /><AlertaTemporario tipo="erro" mensagem={erro} />
    <div className="caixa-resumo"><span>Recebido em {data.split('-').reverse().join('/')}</span><div className="caixa-resumo-acoes"><strong>{moeda(totalDia)}</strong><button type="button" className="botao-fechar-caixa" onClick={() => setConfirmacaoFechamentoAberta(true)} disabled={carregando || fechandoCaixa}>Fechar Caixa</button></div></div>
    <section className="card-cobranca">
      <div className="card-cobranca-cabecalho"><div><h2>Novo Pagamento</h2><p>Selecione uma marcação realizada no dia.</p></div><label>Data<input type="date" value={data} onChange={(e) => { limparCobranca(); setData(e.target.value); }} /></label></div>
      {carregando ? <p>Carregando atendimentos...</p> : <><div className="selecao-atendimento"><label className="campo-cobranca">Atendimento<select value={reservaId} onChange={(e) => mudarAtendimento(e.target.value)}><option value="">Selecione</option><option value="__outro__">Outro</option>{atendimentos.map((item) => { const valor = (item.servicos || []).reduce((soma, servico) => soma + Number(catalogo.find((x) => String(x.id) === String(servico.id))?.valor || 0), 0); return <option key={item.reservaId} value={item.reservaId} disabled={item.cobrado}>{item.horario} — {item.clienteNome} — {item.servico} — {moeda(valor)}{item.cobrado ? ' (já cobrado)' : ''}</option>; })}</select></label><button type="button" onClick={abrirCobranca} disabled={!reservaId}>Ok</button></div>{!atendimentos.length && <div className="aviso-vazio">Não há marcações para cobrança nesta data.</div>}</>}
    </section>
    <section className="lista-cobrancas"><h2>Pagamentos Registrados</h2>{!carregando && (cobrancas.length ? cobrancas.map((cobranca) => <article className="registro-cobranca" key={cobranca.id}><div><strong>{cobranca.clienteNome}</strong><span>{cobranca.itens.map((item) => `${item.quantidade}× ${item.nome}`).join(', ')}</span>{cobranca.formaPagamentoNome && <small>{cobranca.formaPagamentoNome}</small>}</div><strong>{moeda(cobranca.total)}</strong></article>) : <div className="aviso-vazio">Nenhuma cobrança registrada nesta data.</div>)}</section>

    {cobrancaAberta && (atendimento || cobrancaAvulsa) && <div className="modal-fundo" onMouseDown={() => !salvando && limparCobranca()}><section className="modal modal-cobranca" role="dialog" aria-modal="true" aria-label="Pagamento" onMouseDown={(e) => e.stopPropagation()}><div className="modal-cabecalho"><h2>Pagamento</h2><button type="button" className="modal-fechar" onClick={limparCobranca} disabled={salvando} aria-label="Fechar">×</button></div>{cobrancaAvulsa && <label className="campo-cobranca campo-colaborador">Colaboradores<select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}><option value="">Selecione</option>{colaboradores.map((colaborador) => <option key={colaborador.id} value={colaborador.id}>{colaborador.nome}</option>)}</select></label>}<div className="dados-atendimento">{cobrancaAvulsa ? <label className="campo-cobranca">Nome da cliente<input value={nomeClienteAvulsa} onChange={(e) => setNomeClienteAvulsa(e.target.value)} placeholder="Informe o nome" autoFocus /></label> : <span><strong>Nome da cliente:</strong> {atendimento.clienteNome}</span>}<span><strong>Serviço executado:</strong> {atendimento?.servico || ''}</span></div><div className="itens-cobranca"><h3>Itens da cobrança</h3>{itens.length ? <>{servicosMarcados.map((item) => <div className="item-cobranca" key={`marcado-${item.id}`}><span>{item.nome}</span><span>1 un.</span><strong>{moeda(item.valor)}</strong></div>)}{itensExtras.map((item) => <div className="item-cobranca item-produto" key={`extra-${item.id}`}><div className="descricao-item-cobranca"><span>{item.nome}</span><small>{item.tipo === 'produto' ? 'Produto' : 'Serviço adicional'}</small></div><label>Qtd.<input type="number" min="1" value={item.quantidade} onChange={(e) => alterarQuantidade(item.id, e.target.value)} /></label><strong>{moeda(item.valor * item.quantidade)}</strong><button type="button" className="botao-remover-servico" onClick={() => alterarQuantidade(item.id, 0)} aria-label={`Remover ${item.nome}`}>×</button></div>)}</> : <p className="texto-suave">Nenhum item adicionado.</p>}</div><button type="button" className="botao-secundario botao-adicionar-item" onClick={abrirSeletorItens}>+ Item</button><div className="ajustes-cobranca"><label>Desconto<CampoMoeda valorEmCentavos={desconto} onChange={setDesconto} /></label><label>Acréscimo<CampoMoeda valorEmCentavos={acrescimo} onChange={setAcrescimo} /></label></div><label className="campo-cobranca">Forma de pagamento<select value={formaPagamentoId} onChange={(e) => mudarFormaPagamento(e.target.value)}><option value="">Selecione</option>{formas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}<option value="personalizado">Personalizado</option></select></label>{formaPagamentoId === 'personalizado' && <div className="pagamentos-personalizados"><h3>Dividir pagamento</h3>{formas.map((forma) => <label key={forma.id}>{forma.nome}<CampoMoeda valorEmCentavos={pagamentosPersonalizados[forma.id] || 0} onChange={(valor) => setPagamentosPersonalizados((anterior) => ({ ...anterior, [forma.id]: valor }))} /></label>)}<div className={`resumo-personalizado${pagamentoPersonalizadoExato ? ' exato' : pagamentoPersonalizadoMaior ? ' maior' : ''}`}><span>Informado: {moeda(totalPersonalizado)}</span><strong>{pagamentoPersonalizadoExato ? 'Valor exato' : pagamentoPersonalizadoMaior ? `Acréscimo: ${moeda(diferencaPagamentoPersonalizado)}` : `Restante: ${moeda(Math.abs(diferencaPagamentoPersonalizado))}`}</strong></div></div>}<div className="total-cobranca"><span>Valor a ser cobrado</span><strong>{moeda(total)}</strong></div><div className="modal-acoes"><button type="button" className="botao-secundario" onClick={limparCobranca} disabled={salvando}>Cancelar</button><button type="button" onClick={cobrar} disabled={salvando || !itens.length || (cobrancaAvulsa && (!nomeClienteAvulsa.trim() || !colaboradorId)) || (formaPagamentoId === 'personalizado' && !pagamentoPersonalizadoExato)}>{salvando ? 'Registrando...' : 'Confirmar Pagamento'}</button></div></section></div>}
    {seletorItensAberto && <div className="modal-fundo modal-fundo-superior" onMouseDown={descartarSelecaoItens}><section className="modal modal-seletor-itens" role="dialog" aria-modal="true" aria-label="Adicionar item à cobrança" onMouseDown={(e) => e.stopPropagation()}><div className="modal-cabecalho"><div><h2>Adicionar item</h2><p className="subtitulo">Selecione produtos ou serviços do catálogo.</p></div><button type="button" className="modal-fechar" onClick={descartarSelecaoItens} aria-label="Fechar">×</button></div><div className="abas-itens" role="tablist" aria-label="Tipo de item"><button type="button" role="tab" aria-selected={abaItensAtiva === 'servicos'} className={abaItensAtiva === 'servicos' ? 'ativa' : ''} onClick={() => setAbaItensAtiva('servicos')}>Serviços</button><button type="button" role="tab" aria-selected={abaItensAtiva === 'produtos'} className={abaItensAtiva === 'produtos' ? 'ativa' : ''} onClick={() => setAbaItensAtiva('produtos')}>Produtos</button></div><div className="lista-itens-catalogo">{catalogo.filter((item) => abaItensAtiva === 'produtos' ? item.tipo === 'produto' : item.tipo !== 'produto').length ? catalogo.filter((item) => abaItensAtiva === 'produtos' ? item.tipo === 'produto' : item.tipo !== 'produto').map((item) => <article className="item-catalogo-cobranca" key={item.id}><div><strong>{item.nome}</strong><span>{item.tipo === 'produto' ? 'Produto' : 'Serviço'} · {moeda(item.valor)}</span></div>{quantidadeExtra(item.id) ? <div className="controle-item-catalogo" aria-label={`Quantidade de ${item.nome}`}><button type="button" className="botao-quantidade" onClick={() => alterarQuantidadeSelecao(item.id, quantidadeExtra(item.id) - 1)} aria-label={`Diminuir quantidade de ${item.nome}`}>−</button><span>{quantidadeExtra(item.id)}</span><button type="button" className="botao-quantidade" onClick={() => adicionarItem(item)} aria-label={`Aumentar quantidade de ${item.nome}`}>+</button></div> : <button type="button" onClick={() => adicionarItem(item)}>Adicionar</button>}</article>) : <div className="aviso-vazio">Nenhum {abaItensAtiva === 'produtos' ? 'produto' : 'serviço'} cadastrado.</div>}</div><div className="modal-acoes"><button type="button" className="botao-secundario" onClick={descartarSelecaoItens}>Cancelar</button><button type="button" onClick={concluirSelecaoItens}>Concluir itens</button></div></section></div>}
    <ModalConfirmacao aberto={confirmacaoFechamentoAberta} titulo="Fechar caixa" mensagem={`O movimento de ${data.split('-').reverse().join('/')} (${moeda(totalDia)}) será salvo para consulta por 90 dias. Os pagamentos atuais serão removidos do Fluxo de Caixa e do Dashboard.`} textoConfirmar="Fechar Caixa" carregando={fechandoCaixa} onCancelar={() => setConfirmacaoFechamentoAberta(false)} onConfirmar={fecharCaixa} />
  </div>;
}
