const { safeUser, findUserByLogin, createUser, listUsers, updateUser, deleteUser } = require('../config/store');

function validarUsuario({ nome, login, senha, papel }, senhaObrigatoria) {
  if (!nome?.trim() || !login?.trim() || (senhaObrigatoria && !senha)) {
    return 'Nome, usuário e senha são obrigatórios.';
  }
  if (!/^[a-z0-9]{6,}$/i.test(login) || (senha && senha.length < 6)) {
    return 'Usuário deve ter ao menos 6 letras ou números, e a senha ao menos 6 caracteres.';
  }
  if (!['cliente', 'gestor'].includes(papel)) return 'Nível de acesso inválido.';
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
    const { nome, login, telefone, senha, papel } = req.body;
    const erroValidacao = validarUsuario({ nome, login, senha, papel }, true);
    if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });
    if (await findUserByLogin(login)) return res.status(409).json({ mensagem: 'Este usuário já está em uso.' });

    const usuario = await createUser({ nome: nome.trim(), login: login.trim(), telefone, senha, papel });
    return res.status(201).json(safeUser(usuario));
  } catch (erro) {
    if (erro.code === 11000) return res.status(409).json({ mensagem: 'Este usuário já está em uso.' });
    console.error(erro);
    return res.status(500).json({ mensagem: 'Erro ao cadastrar usuário.' });
  }
}

async function atualizar(req, res) {
  try {
    const { nome, login, telefone, senha, papel } = req.body;
    const erroValidacao = validarUsuario({ nome, login, senha, papel }, false);
    if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });
    const existente = await findUserByLogin(login);
    if (existente && String(existente.id) !== String(req.params.id)) {
      return res.status(409).json({ mensagem: 'Este usuário já está em uso.' });
    }

    const usuario = await updateUser(req.params.id, { nome: nome.trim(), login: login.trim(), telefone, senha, papel });
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
