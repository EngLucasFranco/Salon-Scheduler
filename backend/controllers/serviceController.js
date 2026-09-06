const { createService, listServices, updateService, deleteService } = require('../config/store');

function validarServico({ nome, tipo, valor, duracaoMinutos }) {
  const duracao = Number(duracaoMinutos);
  const preco = Number(valor);
  if (!nome?.trim()) return 'Informe o nome do serviço.';
  if (!['produto', 'servico'].includes(tipo)) return 'Selecione Produto ou Serviço.';
  if (!Number.isFinite(preco) || preco < 0) return 'Informe um valor válido.';
  if (tipo === 'servico' && (!Number.isInteger(duracao) || duracao < 5 || duracao > 720)) return 'O tempo deve ser um número inteiro entre 5 e 720 minutos.';
  return null;
}

async function listar(req, res) {
  try { return res.json(await listServices()); }
  catch (erro) { console.error(erro); return res.status(500).json({ mensagem: 'Erro ao listar os serviços.' }); }
}

async function criar(req, res) {
  try {
    const erroValidacao = validarServico(req.body);
    if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });
    const servico = await createService({ nome: req.body.nome.trim(), tipo: req.body.tipo, valor: Number(req.body.valor), duracaoMinutos: req.body.tipo === 'servico' ? Number(req.body.duracaoMinutos) : null, criadoPor: req.usuario.id });
    return res.status(201).json(servico);
  } catch (erro) {
    if (erro.code === 11000 || /UNIQUE constraint failed/i.test(erro.message || '')) return res.status(409).json({ mensagem: 'Já existe um serviço com este nome.' });
    console.error(erro);
    return res.status(500).json({ mensagem: 'Erro ao cadastrar o serviço.' });
  }
}

async function atualizar(req, res) {
  try {
    const erroValidacao = validarServico(req.body);
    if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });
    const servico = await updateService(req.params.id, { nome: req.body.nome.trim(), tipo: req.body.tipo, valor: Number(req.body.valor), duracaoMinutos: req.body.tipo === 'servico' ? Number(req.body.duracaoMinutos) : null });
    if (!servico) return res.status(404).json({ mensagem: 'Serviço não encontrado.' });
    return res.json(servico);
  } catch (erro) {
    if (erro.code === 11000 || /UNIQUE constraint failed/i.test(erro.message || '')) return res.status(409).json({ mensagem: 'Já existe um serviço com este nome.' });
    console.error(erro);
    return res.status(500).json({ mensagem: 'Erro ao atualizar o serviço.' });
  }
}

async function remover(req, res) {
  try {
    if (!(await deleteService(req.params.id))) return res.status(404).json({ mensagem: 'Serviço não encontrado.' });
    return res.status(204).send();
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ mensagem: 'Erro ao excluir o serviço.' });
  }
}

module.exports = { listar, criar, atualizar, remover };
