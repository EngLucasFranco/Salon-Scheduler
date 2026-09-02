const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { safeUser, findUserByLogin, createUser } = require('../config/store');

function gerarToken(usuario) {
  return jwt.sign({ id: usuario.id, papel: usuario.papel }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /api/auth/registrar
// Cadastro público sempre cria "cliente". Para virar "gestor" é preciso
// informar o código de convite correto (MANAGER_INVITE_CODE).
async function registrar(req, res) {
  try {
    const { nome, login, telefone, senha, codigoGestor } = req.body;

    if (!nome || !login || !senha) {
      return res.status(400).json({ mensagem: 'Nome, usuário e senha são obrigatórios.' });
    }
    if (!/^[a-z0-9]{6,}$/i.test(login) || senha.length < 6) return res.status(400).json({ mensagem: 'Usuário deve ter ao menos 6 letras ou números, e a senha ao menos 6 caracteres.' });

    const usuarioExistente = await findUserByLogin(login);
    if (usuarioExistente) {
      return res.status(409).json({ mensagem: 'Este usuário já está em uso.' });
    }

    let papel = 'cliente';
    if (codigoGestor && codigoGestor === process.env.MANAGER_INVITE_CODE) {
      papel = 'gestor';
    }

    const usuario = await createUser({ nome, login, telefone, senha, papel });
    const token = gerarToken(usuario);

    return res.status(201).json({ usuario: safeUser(usuario), token });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ mensagem: 'Erro ao registrar usuário.' });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { login, senha } = req.body;

    if (!login || !senha) {
      return res.status(400).json({ mensagem: 'Informe usuário e senha.' });
    }

    const usuario = await findUserByLogin(login);
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
      return res.status(401).json({ mensagem: 'Usuário ou senha inválidos.' });
    }

    const token = gerarToken(usuario);
    return res.json({ usuario: safeUser(usuario), token });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ mensagem: 'Erro ao fazer login.' });
  }
}

// GET /api/auth/me
async function me(req, res) {
  return res.json({ usuario: req.usuario });
}

module.exports = { registrar, login, me };
