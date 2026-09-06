const { getLayoutSettings, saveLayoutSettings } = require('../config/store');

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

module.exports = { obterLayouts, atualizarLayouts };
