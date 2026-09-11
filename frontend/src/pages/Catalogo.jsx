import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import api from '../api/axios';
import AlertaTemporario from '../components/AlertaTemporario';
import ModalConfirmacao from '../components/ModalConfirmacao';

const formularioInicial = { nome: '', tipo: 'servico', valor: '', custo: 0, duracaoMinutos: 30 };

function moedaDeCentavos(centavos) { return `R$ ${(Number(centavos || 0) / 100).toFixed(2).replace('.', ',')}`; }
function valorParaCentavos(valor) { return Math.round(Number(valor || 0) * 100); }

function CampoMoeda({ centavos, onChange, ...props }) {
  const referencia = useRef(null); const digitosAntesCursor = useRef(null); const valor = moedaDeCentavos(centavos);
  useLayoutEffect(() => {
    const input = referencia.current; const digitos = digitosAntesCursor.current;
    if (!input || digitos === null) return;
    let vistos = 0; let posicao = valor.length;
    for (let indice = 0; indice < valor.length; indice += 1) { if (/\d/.test(valor[indice])) vistos += 1; if (vistos >= digitos) { posicao = indice + 1; break; } }
    input.setSelectionRange(posicao, posicao); digitosAntesCursor.current = null;
  }, [valor]);
  function alterar(evento) { const cursor = evento.target.selectionStart || 0; digitosAntesCursor.current = evento.target.value.slice(0, cursor).replace(/\D/g, '').length; onChange(Number(evento.target.value.replace(/\D/g, '')) || 0); }
  return <input {...props} ref={referencia} type="text" inputMode="numeric" value={valor} onChange={alterar} />;
}

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
  const [servicoEmEdicao, setServicoEmEdicao] = useState(null);
  const [servicoParaExcluir, setServicoParaExcluir] = useState(null);
  const [formEdicao, setFormEdicao] = useState(formularioInicial);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [detalhamentoAberto, setDetalhamentoAberto] = useState(false); const [origemDetalhamento, setOrigemDetalhamento] = useState('novo'); const [detalheNome, setDetalheNome] = useState(''); const [detalheCusto, setDetalheCusto] = useState(0); const [detalheMargem, setDetalheMargem] = useState(''); const [detalhePreco, setDetalhePreco] = useState(0);
  const esperaAjuste = useRef(null); const intervaloAjuste = useRef(null); const pressionamentoLongo = useRef(false);

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
  useEffect(() => () => { clearTimeout(esperaAjuste.current); clearInterval(intervaloAjuste.current); }, []);
  function calcularPreco(custo, margem) { return Math.round(Number(custo || 0) * (1 + Number(margem || 0) / 100)); }
  function margemDoProduto(custo, preco) { return custo > 0 ? String(Math.max(0, Math.min(999, Math.round(((preco / custo) - 1) * 100)))) : ''; }
  function abrirDetalhamento(origem = 'novo') { const produto = origem === 'edicao' ? formEdicao : form; const custo = valorParaCentavos(produto.custo); const preco = valorParaCentavos(produto.valor); setOrigemDetalhamento(origem); setDetalheNome(produto.nome); setDetalheCusto(custo); setDetalheMargem(margemDoProduto(custo, preco)); setDetalhePreco(preco); setDetalhamentoAberto(true); }
  function alterarCusto(custo) { setDetalheCusto(custo); setDetalhePreco(calcularPreco(custo, detalheMargem)); }
  function alterarMargem(valor) { const margem = valor.replace(/\D/g, '').slice(0, 3); setDetalheMargem(margem); setDetalhePreco(calcularPreco(detalheCusto, margem)); }
  function atualizarMargem(preco) { setDetalheMargem(margemDoProduto(detalheCusto, preco)); }
  function ajustarPreco(variacao) { setDetalhePreco((anterior) => { const preco = Math.max(0, anterior + variacao); atualizarMargem(preco); return preco; }); }
  function iniciarAjuste(variacao) { pressionamentoLongo.current = false; esperaAjuste.current = setTimeout(() => { pressionamentoLongo.current = true; ajustarPreco(variacao); intervaloAjuste.current = setInterval(() => ajustarPreco(variacao), 75); }, 1000); }
  function pararAjuste() { clearTimeout(esperaAjuste.current); clearInterval(intervaloAjuste.current); esperaAjuste.current = null; intervaloAjuste.current = null; }
  function confirmarDetalhamento() { const valores = { nome: detalheNome, custo: (detalheCusto / 100).toFixed(2), valor: (detalhePreco / 100).toFixed(2) }; if (origemDetalhamento === 'edicao') setFormEdicao((anterior) => ({ ...anterior, ...valores })); else setForm((anterior) => ({ ...anterior, ...valores })); setDetalhamentoAberto(false); }
  function renderizarItens(itens) {
    return (
      <div className="lista-servicos visualizacao-lista">
        {itens.map((servico) => (
          <div className="card-servico" key={servico.id}>
            <div>
              <strong>{servico.nome}</strong>
              <span>{servico.tipo === 'produto' ? 'Produto' : formatarDuracao(servico.duracaoMinutos)} · R$ {Number(servico.valor || 0).toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="acoes-servico">
              <button type="button" className="botao-pequeno botao-secundario" onClick={() => abrirEdicao(servico)}>Editar</button>
              <button type="button" className="botao-pequeno botao-perigo" onClick={() => setServicoParaExcluir(servico)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  async function salvar(evento) {
    evento.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await api.post('/servicos', form);
      setForm(formularioInicial);
      setModalNovoAberto(false);
      await carregarServicos();
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível cadastrar o serviço.');
    } finally {
      setSalvando(false);
    }
  }

  function abrirEdicao(servico) {
    setServicoEmEdicao(servico);
    setFormEdicao({ nome: servico.nome, tipo: servico.tipo || 'servico', valor: servico.valor ?? '', custo: servico.custo ?? 0, duracaoMinutos: servico.duracaoMinutos || 30 });
    setErro('');
  }

  async function salvarEdicao(evento) {
    evento.preventDefault();
    setSalvandoEdicao(true);
    setErro('');
    try {
      await api.put(`/servicos/${servicoEmEdicao.id}`, formEdicao);
      setServicoEmEdicao(null);
      setMensagem('Serviço atualizado com sucesso.');
      await carregarServicos();
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível atualizar o serviço.');
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function confirmarExclusao() {
    if (!servicoParaExcluir) return;
    setExcluindo(true);
    setErro('');
    try {
      await api.delete(`/servicos/${servicoParaExcluir.id}`);
      setServicoParaExcluir(null);
      setMensagem('Serviço excluído com sucesso.');
      await carregarServicos();
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível excluir o serviço.');
    } finally {
      setExcluindo(false);
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

      <div className="card-cadastro-servico"><button type="button" onClick={() => { setForm({ ...formularioInicial, tipo: '' }); setModalNovoAberto(true); }}>+ Produto / Serviço</button></div>

      {modalNovoAberto && <div className="modal-fundo"><form className="modal" onSubmit={salvar}><h2>Novo produto / serviço</h2><div className="tipo-catalogo"><label><input type="checkbox" checked={form.tipo === 'produto'} onChange={() => setForm((x) => ({ ...x, tipo: 'produto' }))} /> Produto</label><label><input type="checkbox" checked={form.tipo === 'servico'} onChange={() => setForm((x) => ({ ...x, tipo: 'servico' }))} /> Serviço</label></div>{form.tipo && <><label>Descrição<input value={form.nome} onChange={(e) => setForm((x) => ({ ...x, nome: e.target.value }))} required /></label>{form.tipo === 'produto' ? <div className="campo-valor-detalhar"><label>Valor<input type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm((x) => ({ ...x, valor: e.target.value }))} required /></label><button type="button" className="botao-secundario" onClick={() => abrirDetalhamento('novo')}>Detalhar</button></div> : <label>Valor<input type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm((x) => ({ ...x, valor: e.target.value }))} required /></label>}{form.tipo === 'servico' && <label>Tempo<input type="number" min="5" value={form.duracaoMinutos} onChange={(e) => setForm((x) => ({ ...x, duracaoMinutos: e.target.value }))} required /></label>}</>}<div className="modal-acoes"><button type="button" className="botao-secundario" onClick={() => setModalNovoAberto(false)}>Cancelar</button><button type="submit" disabled={!form.tipo || salvando}>Salvar</button></div></form></div>}

      {detalhamentoAberto && <div className="modal-fundo modal-fundo-superior" role="presentation" onMouseDown={() => { pararAjuste(); setDetalhamentoAberto(false); }}><section className="modal modal-detalhar-produto" role="dialog" aria-modal="true" aria-label="Detalhar preço do produto" onMouseDown={(evento) => evento.stopPropagation()}><div className="modal-cabecalho"><h2>Detalhar produto</h2><button type="button" className="modal-fechar" onClick={() => setDetalhamentoAberto(false)} aria-label="Fechar">×</button></div><label>Nome do produto<input value={detalheNome} onChange={(e) => setDetalheNome(e.target.value)} autoFocus /></label><div className="campos-custo-margem"><label>Custo<CampoMoeda centavos={detalheCusto} onChange={alterarCusto} /></label><label>Margem<input inputMode="numeric" value={detalheMargem} onChange={(e) => alterarMargem(e.target.value)} placeholder="00" /></label></div><label>Preço<div className="ajuste-fino-preco"><button type="button" onPointerDown={() => iniciarAjuste(-1)} onPointerUp={pararAjuste} onPointerLeave={pararAjuste} onPointerCancel={pararAjuste} onClick={() => { if (pressionamentoLongo.current) { pressionamentoLongo.current = false; return; } ajustarPreco(-1); }} aria-label="Reduzir preço">−</button><CampoMoeda centavos={detalhePreco} onChange={(preco) => { setDetalhePreco(preco); atualizarMargem(preco); }} /><button type="button" onPointerDown={() => iniciarAjuste(1)} onPointerUp={pararAjuste} onPointerLeave={pararAjuste} onPointerCancel={pararAjuste} onClick={() => { if (pressionamentoLongo.current) { pressionamentoLongo.current = false; return; } ajustarPreco(1); }} aria-label="Aumentar preço">+</button></div></label><div className="modal-acoes"><button type="button" className="botao-secundario" onClick={() => setDetalhamentoAberto(false)}>Cancelar</button><button type="button" onClick={confirmarDetalhamento}>Ok</button></div></section></div>}

      <section className="lista-catalogo" aria-label="Serviços cadastrados">
        {carregando ? <p>Carregando catálogo...</p> : servicos.length > 0 ? (
          <div className="grupos-catalogo">
            <div className="grupo-catalogo"><h3>Serviços cadastrados</h3>{servicos.filter((item) => item.tipo !== 'produto').length ? renderizarItens(servicos.filter((item) => item.tipo !== 'produto')) : <p className="catalogo-vazio">Nenhum serviço cadastrado.</p>}</div>
            <div className="grupo-catalogo"><h3>Produtos cadastrados</h3>{servicos.filter((item) => item.tipo === 'produto').length ? renderizarItens(servicos.filter((item) => item.tipo === 'produto')) : <p className="catalogo-vazio">Nenhum produto cadastrado.</p>}</div>
          </div>
        ) : <div className="aviso-vazio">Nenhum produto ou serviço cadastrado ainda.</div>}
      </section>

      {servicoEmEdicao && (
        <div className="modal-fundo" role="presentation" onMouseDown={() => !salvandoEdicao && setServicoEmEdicao(null)}>
          <form className="modal" onSubmit={salvarEdicao} onMouseDown={(evento) => evento.stopPropagation()}>
            <div className="modal-cabecalho">
              <h2>Editar serviço</h2>
              <button type="button" className="modal-fechar" onClick={() => setServicoEmEdicao(null)} disabled={salvandoEdicao} aria-label="Fechar">×</button>
            </div>
            <label>
              Nome do serviço
              <input value={formEdicao.nome} onChange={(e) => setFormEdicao((anterior) => ({ ...anterior, nome: e.target.value }))} maxLength="100" required />
            </label>
            <label>Tipo<select value={formEdicao.tipo} onChange={(e) => setFormEdicao((anterior) => ({ ...anterior, tipo: e.target.value }))}><option value="servico">Serviço</option><option value="produto">Produto</option></select></label>
            {formEdicao.tipo === 'produto' ? <div className="campo-valor-detalhar"><label>Valor<input type="number" min="0" step="0.01" value={formEdicao.valor} onChange={(e) => setFormEdicao((anterior) => ({ ...anterior, valor: e.target.value }))} required /></label><button type="button" className="botao-secundario" onClick={() => abrirDetalhamento('edicao')}>Detalhar</button></div> : <label>Valor<input type="number" min="0" step="0.01" value={formEdicao.valor} onChange={(e) => setFormEdicao((anterior) => ({ ...anterior, valor: e.target.value }))} required /></label>}
            {formEdicao.tipo === 'produto' && <label>Custo<input type="number" min="0" step="0.01" value={formEdicao.custo} onChange={(e) => setFormEdicao((anterior) => ({ ...anterior, custo: e.target.value }))} required /></label>}
            {formEdicao.tipo === 'servico' && <label>
              Tempo de execução (minutos)
              <input type="number" min="5" max="720" step="5" value={formEdicao.duracaoMinutos} onChange={(e) => setFormEdicao((anterior) => ({ ...anterior, duracaoMinutos: e.target.value }))} required />
            </label>}
            {erro && <div className="alerta-erro" role="alert">{erro}</div>}
            <div className="modal-acoes">
              <button type="button" className="botao-secundario" onClick={() => setServicoEmEdicao(null)} disabled={salvandoEdicao}>Cancelar</button>
              <button type="submit" disabled={salvandoEdicao}>{salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}</button>
            </div>
          </form>
        </div>
      )}

      <ModalConfirmacao
        aberto={Boolean(servicoParaExcluir)}
        titulo={servicoParaExcluir?.tipo === 'produto' ? 'Excluir produto' : 'Excluir serviço'}
        mensagem={servicoParaExcluir && <>Deseja excluir {servicoParaExcluir.tipo === 'produto' ? 'o produto' : 'o serviço'} <strong>{servicoParaExcluir.nome}</strong>?</>}
        textoConfirmar={servicoParaExcluir?.tipo === 'produto' ? 'Excluir Produto' : 'Excluir Serviço'}
        carregando={excluindo}
        onCancelar={() => setServicoParaExcluir(null)}
        onConfirmar={confirmarExclusao}
      />
    </div>
  );
}
