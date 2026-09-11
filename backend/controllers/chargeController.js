const { listAgendas, listServices, listPaymentMethods, listProfessionals, createCharge, listChargesByDate, listChargesByPeriod, findChargeByReservation, closeCashRegister, listCashClosings } = require('../config/store');

function erroServidor(res, erro, mensagem) { console.error(erro); return res.status(500).json({ mensagem }); }

async function atendimentosDoDia(req, res) {
  try {
    const data = req.query.data;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return res.status(400).json({ mensagem: 'Informe uma data válida.' });
    const [agendas, cobrancas] = await Promise.all([listAgendas(data, data), listChargesByDate(data)]);
    const cobradas = new Set(cobrancas.filter((item) => item.reservaId).map((item) => item.reservaId));
    const atendimentos = agendas.flatMap((agenda) => agenda.slots
      .filter((slot) => slot.status === 'reservado' && (slot.reservaInicio || !slot.reservaId))
      .map((slot) => ({
        reservaId: slot.reservaId || `${agenda.data}:${slot._id}`,
        slotId: slot._id,
        horario: slot.horario,
        clienteNome: slot.clienteNome,
        profissionalNome: agenda.profissionalNome,
        servicos: slot.servicos || [],
        servico: slot.servico,
        cobrado: cobradas.has(slot.reservaId || `${agenda.data}:${slot._id}`),
      })));
    return res.json(atendimentos);
  } catch (erro) { return erroServidor(res, erro, 'Erro ao listar os atendimentos do dia.'); }
}

async function listar(req, res) {
  try {
    const data = req.query.data;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return res.status(400).json({ mensagem: 'Informe uma data válida.' });
    return res.json(await listChargesByDate(data));
  } catch (erro) { return erroServidor(res, erro, 'Erro ao listar as cobranças.'); }
}

async function relatorioFinanceiro(req, res) {
  const { inicio, fim } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio || '') || !/^\d{4}-\d{2}-\d{2}$/.test(fim || '') || inicio > fim) return res.status(400).json({ mensagem: 'Informe um período válido.' });
  try { return res.json(await listChargesByPeriod(inicio, fim)); }
  catch (erro) { return erroServidor(res, erro, 'Erro ao gerar relatório financeiro.'); }
}

async function criar(req, res) {
  try {
    const { data, reservaId, clienteNome, profissionalNome, profissionalId, formaPagamentoId, itens } = req.body;
    const desconto = Number(req.body.desconto || 0);
    const acrescimo = Number(req.body.acrescimo || 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '') || !reservaId || !clienteNome?.trim()) return res.status(400).json({ mensagem: 'Informe o atendimento e a data da cobrança.' });
    if (!Array.isArray(itens) || !itens.length) return res.status(400).json({ mensagem: 'Adicione ao menos um serviço ou produto.' });
    if (!Number.isFinite(desconto) || desconto < 0 || !Number.isFinite(acrescimo) || acrescimo < 0) return res.status(400).json({ mensagem: 'Informe valores válidos para desconto e acréscimo.' });
    if (reservaId && await findChargeByReservation(reservaId)) return res.status(409).json({ mensagem: 'Este atendimento já foi cobrado.' });
    const [catalogo, formas, profissionais] = await Promise.all([listServices(), listPaymentMethods(), listProfessionals()]);
    const profissionalSelecionado = profissionalId ? profissionais.find((item) => String(item.id) === String(profissionalId)) : null;
    if (profissionalId && !profissionalSelecionado) return res.status(400).json({ mensagem: 'Colaborador inválido.' });
    if (reservaId.startsWith('avulsa-') && !profissionalSelecionado) return res.status(400).json({ mensagem: 'Selecione o colaborador responsável pelo pagamento.' });
    const forma = formaPagamentoId && formaPagamentoId !== 'personalizado' ? formas.find((item) => String(item.id) === String(formaPagamentoId)) : null;
    if (formaPagamentoId && formaPagamentoId !== 'personalizado' && !forma) return res.status(400).json({ mensagem: 'Forma de pagamento inválida.' });
    const itensCobranca = itens.map((item) => {
      const catalogoItem = catalogo.find((produto) => String(produto.id) === String(item.catalogoId));
      const quantidade = Number(item.quantidade);
      if (!catalogoItem || !Number.isInteger(quantidade) || quantidade < 1) return null;
      return { catalogoId: catalogoItem.id, nome: catalogoItem.nome, tipo: catalogoItem.tipo, quantidade, valorUnitario: Number(catalogoItem.valor), custoUnitario: catalogoItem.tipo === 'produto' ? Number(catalogoItem.custo || 0) : 0 };
    });
    if (itensCobranca.some((item) => !item)) return res.status(400).json({ mensagem: 'Há itens inválidos na cobrança.' });
    const subtotal = itensCobranca.reduce((soma, item) => soma + item.quantidade * item.valorUnitario, 0);
    const total = Math.max(0, subtotal - desconto + acrescimo);
    let formasPagamento = [];
    if (formaPagamentoId === 'personalizado') {
      const pagamentos = Array.isArray(req.body.pagamentos) ? req.body.pagamentos : [];
      formasPagamento = pagamentos.map((pagamento) => {
        const metodo = formas.find((item) => String(item.id) === String(pagamento.formaPagamentoId));
        const valor = Number(pagamento.valor);
        return metodo && Number.isFinite(valor) && valor > 0 ? { formaPagamentoId: metodo.id, formaPagamentoNome: metodo.nome, valor } : null;
      });
      if (!formasPagamento.length || formasPagamento.some((item) => !item)) return res.status(400).json({ mensagem: 'Informe os valores das formas de pagamento.' });
      const totalPagamentos = formasPagamento.reduce((soma, item) => soma + item.valor, 0);
      if (Math.abs(totalPagamentos - total) > 0.009) return res.status(400).json({ mensagem: 'A soma dos pagamentos deve ser igual ao valor total da cobrança.' });
    } else if (forma) formasPagamento = [{ formaPagamentoId: forma.id, formaPagamentoNome: forma.nome, valor: total }];
    const cobranca = await createCharge({ data, agendaData: data, reservaId, clienteNome: clienteNome.trim(), profissionalNome: profissionalSelecionado?.nome || profissionalNome || '', formaPagamentoId: forma?.id || '', formaPagamentoNome: forma?.nome || (formaPagamentoId === 'personalizado' ? 'Personalizado' : ''), formasPagamento, itens: itensCobranca, desconto, acrescimo, total, criadoPor: req.usuario.id });
    return res.status(201).json(cobranca);
  } catch (erro) {
    if (erro.code === 11000 || /UNIQUE constraint failed/i.test(erro.message || '')) return res.status(409).json({ mensagem: 'Este atendimento já foi cobrado.' });
    return erroServidor(res, erro, 'Erro ao registrar a cobrança.');
  }
}

async function fecharCaixa(req, res) {
  try {
    const { data } = req.body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return res.status(400).json({ mensagem: 'Informe uma data válida para o fechamento.' });
    return res.json(await closeCashRegister(data, req.usuario.id));
  } catch (erro) { return erroServidor(res, erro, 'Não foi possível fechar o caixa.'); }
}

async function listarFechamentos(req, res) {
  const { inicio, fim } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio || '') || !/^\d{4}-\d{2}-\d{2}$/.test(fim || '') || inicio > fim) return res.status(400).json({ mensagem: 'Informe um período válido.' });
  try { return res.json(await listCashClosings(inicio, fim)); }
  catch (erro) { return erroServidor(res, erro, 'Não foi possível consultar os fechamentos.'); }
}

module.exports = { atendimentosDoDia, listar, criar, relatorioFinanceiro, fecharCaixa, listarFechamentos };
