const { listPaymentMethods, createPaymentMethod } = require('../config/store');

async function listar(req, res) {
  try { return res.json(await listPaymentMethods()); }
  catch (erro) { console.error(erro); return res.status(500).json({ mensagem: 'Erro ao listar as formas de pagamento.' }); }
}

async function criar(req, res) {
  if (!req.body.nome?.trim()) return res.status(400).json({ mensagem: 'Informe o nome da forma de pagamento.' });
  try { return res.status(201).json(await createPaymentMethod({ nome: req.body.nome.trim(), criadoPor: req.usuario.id })); }
  catch (erro) {
    if (erro.code === 11000 || /UNIQUE constraint failed/i.test(erro.message || '')) return res.status(409).json({ mensagem: 'Esta forma de pagamento já foi cadastrada.' });
    console.error(erro); return res.status(500).json({ mensagem: 'Erro ao cadastrar a forma de pagamento.' });
  }
}

module.exports = { listar, criar };
