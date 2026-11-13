const { getLayoutSettings, saveLayoutSettings, getGeneralSettings, saveGeneralSettings, getNexusAuthSettings, saveNexusAuthSettings, getNotificationSettings, saveNotificationSettings } = require('../config/store');
const { removerAgendasVencidas } = require('../utils/agendasVencidas');

async function obterLayouts(req, res) {
  try { return res.json(await getLayoutSettings()); }
  catch (erro) { console.error(erro); return res.status(500).json({ mensagem: 'Erro ao carregar os layouts.' }); }
}

async function atualizarLayouts(req, res) {
  const layoutsValidos = ['classico', 'oceano', 'aurora', 'noite'];
  const administrativo = req.body.administrativo;
  const cliente = req.body.cliente;
  if (!layoutsValidos.includes(administrativo) || !layoutsValidos.includes(cliente)) return res.status(400).json({ mensagem: 'Layout inválido.' });
  try { return res.json(await saveLayoutSettings({ administrativo, cliente })); }
  catch (erro) { console.error(erro); return res.status(500).json({ mensagem: 'Erro ao salvar os layouts.' }); }
}

async function obterConfiguracoesGerais(req, res) {
  try { return res.json(await getGeneralSettings()); }
  catch (erro) { console.error(erro); return res.status(500).json({ mensagem: 'Erro ao carregar as configurações gerais.' }); }
}

async function atualizarConfiguracoesGerais(req, res) {
  const texto = (valor, limite) => typeof valor === 'string' && valor.trim().length <= limite;
  const configuracoes = {
    nomeEstabelecimento: req.body.nomeEstabelecimento?.trim(), telefoneEstabelecimento: req.body.telefoneEstabelecimento?.trim(), logomarca: req.body.logomarca || '', enderecoEstabelecimento: req.body.enderecoEstabelecimento?.trim(), horarioFuncionamento: req.body.horarioFuncionamento?.trim(),
    antecedenciaDias: Number(req.body.antecedenciaDias), permitirCancelamentoCliente: req.body.permitirCancelamentoCliente, limiteCancelamentoHoras: req.body.limiteCancelamentoHoras === '' || req.body.limiteCancelamentoHoras === null ? null : Number(req.body.limiteCancelamentoHoras), tratamentoAgendasPassadas: req.body.tratamentoAgendasPassadas, diasVencimentoAgendas: Number(req.body.diasVencimentoAgendas), politicaCancelamento: req.body.politicaCancelamento?.trim(), mensagemConfirmacao: req.body.mensagemConfirmacao?.trim(),
  };
  if (!texto(configuracoes.nomeEstabelecimento, 120) || !texto(configuracoes.telefoneEstabelecimento, 30) || !texto(configuracoes.logomarca, 150000) || !Number.isInteger(configuracoes.antecedenciaDias) || configuracoes.antecedenciaDias < 0 || configuracoes.antecedenciaDias > 3650 || typeof configuracoes.permitirCancelamentoCliente !== 'boolean' || !['manter', 'excluir'].includes(configuracoes.tratamentoAgendasPassadas) || !Number.isInteger(configuracoes.diasVencimentoAgendas) || configuracoes.diasVencimentoAgendas < 0 || configuracoes.diasVencimentoAgendas > 3650 || (configuracoes.permitirCancelamentoCliente && configuracoes.limiteCancelamentoHoras === null) || (configuracoes.limiteCancelamentoHoras !== null && (!Number.isInteger(configuracoes.limiteCancelamentoHoras) || configuracoes.limiteCancelamentoHoras < 0 || configuracoes.limiteCancelamentoHoras > 168))) return res.status(400).json({ mensagem: 'Revise os dados das configurações gerais.' });
  try { const salvas = await saveGeneralSettings(configuracoes); await removerAgendasVencidas(); return res.json(salvas); }
  catch (erro) { console.error(erro); return res.status(500).json({ mensagem: 'Erro ao salvar as configurações gerais.' }); }
}

async function obterAutenticacaoNexus(req, res) {
  try { return res.json(await getNexusAuthSettings()); }
  catch (erro) { console.error(erro); return res.status(500).json({ mensagem: 'Erro ao carregar o estado da autenticação.' }); }
}

async function atualizarAutenticacaoNexus(req, res) {
  const baseUrlInformada = req.body.baseUrl?.trim();
  const systemKey = req.body.systemKey?.trim();
  const apiKey = req.body.apiKey?.trim();
  let baseUrl;
  try {
    const url = new URL(baseUrlInformada);
    if (!['http:', 'https:'].includes(url.protocol) || (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) throw new Error('Protocolo inválido');
    baseUrl = url.href.replace(/\/$/, '');
  } catch {
    return res.status(400).json({ mensagem: process.env.NODE_ENV === 'production' ? 'Informe uma URL HTTPS válida.' : 'Informe uma URL HTTP ou HTTPS válida.' });
  }
  if (baseUrl.length > 2048 || !systemKey || systemKey.length > 200 || !apiKey || apiKey.length > 1000) return res.status(400).json({ mensagem: 'Informe URL da API, System Key e API Key válidas.' });
  try { return res.json(await saveNexusAuthSettings({ baseUrl, systemKey, apiKey })); }
  catch (erro) { console.error(erro.message); return res.status(500).json({ mensagem: 'Não foi possível proteger e salvar a autenticação. Verifique a chave de criptografia do servidor.' }); }
}

async function obterConfiguracoesNotificacao(req, res) {
  try { return res.json(await getNotificationSettings()); }
  catch (erro) { console.error(erro); return res.status(500).json({ mensagem: 'Erro ao carregar as configurações de notificações.' }); }
}

async function atualizarConfiguracoesNotificacao(req, res) {
  const horasAntecedenciaCliente = Number(req.body.horasAntecedenciaCliente);
  const mensagemCliente = req.body.mensagemCliente?.trim();
  if (!Number.isInteger(horasAntecedenciaCliente) || horasAntecedenciaCliente < 0 || horasAntecedenciaCliente > 720 || !mensagemCliente || mensagemCliente.length > 500) return res.status(400).json({ mensagem: 'Informe de 0 a 720 horas e uma mensagem de até 500 caracteres.' });
  try { return res.json(await saveNotificationSettings({ horasAntecedenciaCliente, mensagemCliente })); }
  catch (erro) { console.error(erro); return res.status(500).json({ mensagem: 'Erro ao salvar as configurações de notificações.' }); }
}

module.exports = { obterLayouts, atualizarLayouts, obterConfiguracoesGerais, atualizarConfiguracoesGerais, obterAutenticacaoNexus, atualizarAutenticacaoNexus, obterConfiguracoesNotificacao, atualizarConfiguracoesNotificacao };
