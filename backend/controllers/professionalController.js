const { createProfessional, listProfessionals, updateProfessional, deleteProfessional } = require('../config/store');

function validarIntervalos(intervalos) {
  if (!Array.isArray(intervalos)) return null;
  for (const intervalo of intervalos) {
    if (!/^\d{2}:\d{2}$/.test(intervalo.inicio || '') || !/^\d{2}:\d{2}$/.test(intervalo.fim || '') || intervalo.inicio >= intervalo.fim) return 'Informe horários de intervalo válidos.';
  }
  return null;
}

async function listar(req, res) {
  try {
    return res.json(await listProfessionals());
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ mensagem: 'Erro ao listar os profissionais.' });
  }
}

async function criar(req, res) {
  const { nome, especialidade, telefone, intervalos = [] } = req.body;
  if (!nome?.trim()) return res.status(400).json({ mensagem: 'Informe o nome do profissional.' });
  const erroIntervalos = validarIntervalos(intervalos); if (erroIntervalos) return res.status(400).json({ mensagem: erroIntervalos });

  try {
    const profissional = await createProfessional({
      nome: nome.trim(),
      especialidade: especialidade?.trim(),
      telefone: telefone?.trim(),
      intervalos,
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

async function atualizar(req, res) {
  const { nome, especialidade, telefone, intervalos = [] } = req.body;
  if (!nome?.trim()) return res.status(400).json({ mensagem: 'Informe o nome do profissional.' });
  const erroIntervalos = validarIntervalos(intervalos); if (erroIntervalos) return res.status(400).json({ mensagem: erroIntervalos });
  try {
    const profissional = await updateProfessional(req.params.id, { nome: nome.trim(), especialidade: especialidade?.trim(), telefone: telefone?.trim(), intervalos });
    if (!profissional) return res.status(404).json({ mensagem: 'Profissional não encontrado.' });
    return res.json(profissional);
  } catch (erro) { if (erro.code === 11000 || /UNIQUE constraint failed/i.test(erro.message || '')) return res.status(409).json({ mensagem: 'Já existe um profissional com este nome.' }); console.error(erro); return res.status(500).json({ mensagem: 'Erro ao atualizar o profissional.' }); }
}

async function remover(req, res) {
  try { if (!(await deleteProfessional(req.params.id))) return res.status(404).json({ mensagem: 'Profissional não encontrado.' }); return res.status(204).send(); }
  catch (erro) { console.error(erro); return res.status(500).json({ mensagem: 'Erro ao excluir o profissional.' }); }
}

module.exports = { listar, criar, atualizar, remover };
