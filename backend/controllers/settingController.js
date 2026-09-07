const { getLayoutSettings, saveLayoutSettings, getGeneralSettings, saveGeneralSettings } = require('../config/store');

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
    antecedenciaDias: Number(req.body.antecedenciaDias), limiteCancelamentoHoras: req.body.limiteCancelamentoHoras === '' || req.body.limiteCancelamentoHoras === null ? null : Number(req.body.limiteCancelamentoHoras), politicaCancelamento: req.body.politicaCancelamento?.trim(), mensagemConfirmacao: req.body.mensagemConfirmacao?.trim(),
  };
  if (!texto(configuracoes.nomeEstabelecimento, 120) || !texto(configuracoes.telefoneEstabelecimento, 30) || !texto(configuracoes.logomarca, 2000000) || !Number.isInteger(configuracoes.antecedenciaDias) || configuracoes.antecedenciaDias < 0 || configuracoes.antecedenciaDias > 3650 || (configuracoes.limiteCancelamentoHoras !== null && (!Number.isInteger(configuracoes.limiteCancelamentoHoras) || configuracoes.limiteCancelamentoHoras < 0 || configuracoes.limiteCancelamentoHoras > 168))) return res.status(400).json({ mensagem: 'Revise os dados das configurações gerais.' });
  try { return res.json(await saveGeneralSettings(configuracoes)); }
  catch (erro) { console.error(erro); return res.status(500).json({ mensagem: 'Erro ao salvar as configurações gerais.' }); }
}

module.exports = { obterLayouts, atualizarLayouts, obterConfiguracoesGerais, atualizarConfiguracoesGerais };
