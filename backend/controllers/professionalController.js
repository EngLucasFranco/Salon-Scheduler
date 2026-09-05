const { createProfessional, listProfessionals } = require('../config/store');

async function listar(req, res) {
  try {
    return res.json(await listProfessionals());
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ mensagem: 'Erro ao listar os profissionais.' });
  }
}

async function criar(req, res) {
  const { nome, especialidade, telefone } = req.body;
  if (!nome?.trim()) return res.status(400).json({ mensagem: 'Informe o nome do profissional.' });

  try {
    const profissional = await createProfessional({
      nome: nome.trim(),
      especialidade: especialidade?.trim(),
      telefone: telefone?.trim(),
      criadoPor: req.usuario.id,
    });
    return res.status(201).json(profissional);
  } catch (erro) {
    if (erro.code === 11000 || /UNIQUE constraint failed/i.test(erro.message || '')) {
      return res.status(409).json({ mensagem: 'Já existe um profissional com este nome.' });
    }
    console.error(erro);
    return res.status(500).json({ mensagem: 'Erro ao cadastrar o profissional.' });
  }
}

module.exports = { listar, criar };
