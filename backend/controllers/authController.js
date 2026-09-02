const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { safeUser, findUserByEmail, createUser } = require('../config/store');

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
    const { nome, email, telefone, senha, codigoGestor } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ mensagem: 'Nome, e-mail e senha são obrigatórios.' });
    }

    const usuarioExistente = await findUserByEmail(email);
    if (usuarioExistente) {
      return res.status(409).json({ mensagem: 'Já existe uma conta com este e-mail.' });
    }

    let papel = 'cliente';
    if (codigoGestor && codigoGestor === process.env.MANAGER_INVITE_CODE) {
      papel = 'gestor';
    }

    const usuario = await createUser({ nome, email, telefone, senha, papel });
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
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ mensagem: 'Informe e-mail e senha.' });
    }

    const usuario = await findUserByEmail(email);
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
      return res.status(401).json({ mensagem: 'E-mail ou senha inválidos.' });
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
