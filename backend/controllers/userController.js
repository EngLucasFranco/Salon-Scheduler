const { safeUser, findUserByLogin, createUser, listUsers, updateUser, deleteUser, listProfessionals } = require('../config/store');

function validarUsuario({ nome, login, senha, papel, profissionalId }, senhaObrigatoria) {
  if (!nome?.trim() || !login?.trim() || (senhaObrigatoria && !senha)) {
    return 'Nome, usuário e senha são obrigatórios.';
  }
  if (!/^[a-z0-9]{6,}$/i.test(login) || (senha && senha.length < 6)) {
    return 'Usuário deve ter ao menos 6 letras ou números, e a senha ao menos 6 caracteres.';
  }
  if (!['cliente', 'gestor', 'colaborador'].includes(papel)) return 'Nível de acesso inválido.';
  if (papel === 'colaborador' && !profissionalId) return 'Selecione o profissional do colaborador.';
  return null;
}

async function validarAgendaFixa(agendaFixa) {
  if (!agendaFixa?.ativa) return null;
  if (!agendaFixa.profissionalId || !agendaFixa.frequencia || !agendaFixa.horario || !agendaFixa.servicoId) return 'Preencha as configurações da agenda fixa.';
  if (!/^(diario|semanal|quinzenal|mensal)$/.test(agendaFixa.frequencia)) return 'Informe uma recorrência válida para a agenda fixa.';
  if (['semanal', 'quinzenal'].includes(agendaFixa.frequencia) && !/^[0-6]$/.test(String(agendaFixa.diaSemana))) return 'Selecione um dia da semana válido.';
  if (agendaFixa.frequencia === 'mensal' && (!Number.isInteger(Number(agendaFixa.diaMes)) || Number(agendaFixa.diaMes) < 1 || Number(agendaFixa.diaMes) > 31)) return 'Informe um dia do mês válido.';
  const profissional = (await listProfessionals()).find((item) => String(item.id) === String(agendaFixa.profissionalId));
  if (!profissional) return 'Profissional da agenda fixa não encontrado.';
  if (['semanal', 'quinzenal'].includes(agendaFixa.frequencia) && !(profissional.diasAtendimento || []).includes(Number(agendaFixa.diaSemana))) return 'A profissional não atende no dia selecionado.';
  if ((profissional.intervalos || []).some((intervalo) => agendaFixa.horario >= intervalo.inicio && agendaFixa.horario < intervalo.fim)) return 'O horário da agenda fixa coincide com um intervalo da profissional.';
  return null;
}

async function listar(req, res) {
  try {
    const usuarios = await listUsers();
    return res.json(usuarios.map(safeUser));
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ mensagem: 'Erro ao listar usuários.' });
  }
}

async function criar(req, res) {
  try {
    const { nome, login, telefone, senha, papel, profissionalId, agendaFixa } = req.body;
    const erroValidacao = validarUsuario({ nome, login, senha, papel, profissionalId }, true);
    if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });
    const erroAgendaFixa = await validarAgendaFixa(papel === 'cliente' ? agendaFixa : null); if (erroAgendaFixa) return res.status(400).json({ mensagem: erroAgendaFixa });
    if (await findUserByLogin(login)) return res.status(409).json({ mensagem: 'Este usuário já está em uso.' });

    const usuario = await createUser({ nome: nome.trim(), login: login.trim(), telefone, senha, papel, profissionalId, agendaFixa: papel === 'cliente' ? agendaFixa : null });
    return res.status(201).json(safeUser(usuario));
  } catch (erro) {
    if (erro.code === 11000) return res.status(409).json({ mensagem: 'Este usuário já está em uso.' });
    console.error(erro);
    return res.status(500).json({ mensagem: 'Erro ao cadastrar usuário.' });
  }
}

async function atualizar(req, res) {
  try {
    const { nome, login, telefone, senha, papel, profissionalId, agendaFixa } = req.body;
    const erroValidacao = validarUsuario({ nome, login, senha, papel, profissionalId }, false);
    if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });
    const erroAgendaFixa = await validarAgendaFixa(papel === 'cliente' ? agendaFixa : null); if (erroAgendaFixa) return res.status(400).json({ mensagem: erroAgendaFixa });
    const existente = await findUserByLogin(login);
    if (existente && String(existente.id) !== String(req.params.id)) {
      return res.status(409).json({ mensagem: 'Este usuário já está em uso.' });
    }

    const usuario = await updateUser(req.params.id, { nome: nome.trim(), login: login.trim(), telefone, senha, papel, profissionalId, agendaFixa: papel === 'cliente' ? agendaFixa : null });
    if (!usuario) return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    return res.json(safeUser(usuario));
  } catch (erro) {
    if (erro.code === 11000) return res.status(409).json({ mensagem: 'Este usuário já está em uso.' });
    console.error(erro);
    return res.status(500).json({ mensagem: 'Erro ao atualizar usuário.' });
  }
}

async function remover(req, res) {
  try {
    if (String(req.usuario.id) === String(req.params.id)) {
      return res.status(400).json({ mensagem: 'Você não pode excluir seu próprio usuário.' });
    }
    if (!(await deleteUser(req.params.id))) return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    return res.status(204).send();
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ mensagem: 'Erro ao excluir usuário.' });
  }
}

module.exports = { listar, criar, atualizar, remover };
