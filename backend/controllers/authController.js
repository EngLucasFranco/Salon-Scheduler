const jwt = require('jsonwebtoken');
const { verifyPassword, needsPasswordRehash } = require('../utils/password');
const { safeUser, findUserByLogin, findUserById, createUser, upgradeUserPassword } = require('../config/store');

function gerarToken(usuario) {
  // A validade da sessão é controlada pelo sessionStorage no navegador.
  return jwt.sign({ id: usuario.id, papel: usuario.papel }, process.env.JWT_SECRET);
}

// POST /api/auth/registrar
// Cadastro público sempre cria "cliente". O nível de acesso é definido no programa.
async function registrar(req, res) {
  try {
    const { nome, login, telefone, senha } = req.body;

    if (!nome || !login || !senha) {
      return res.status(400).json({ mensagem: 'Nome, usuário e senha são obrigatórios.' });
    }
    if (!/^[a-z0-9]{6,}$/i.test(login) || senha.length < 6) return res.status(400).json({ mensagem: 'Usuário deve ter ao menos 6 letras ou números, e a senha ao menos 6 caracteres.' });

    const usuarioExistente = await findUserByLogin(login);
    if (usuarioExistente) {
      return res.status(409).json({ mensagem: 'Este usuário está indisponível.' });
    }

    const usuario = await createUser({ nome, login, telefone, senha, papel: 'cliente' });
    const token = gerarToken(usuario);

    return res.status(201).json({ usuario: safeUser(usuario), token });
  } catch (erro) {
    if (erro.code === 11000 || /UNIQUE constraint failed/i.test(erro.message || '')) return res.status(409).json({ mensagem: 'Este usuário está indisponível.' });
    console.error(erro);
    return res.status(500).json({ mensagem: 'Erro ao registrar usuário.' });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { login, senha } = req.body;

    if (!login || !senha) return res.status(401).json({ mensagem: 'Usuário ou senha inválidos.' });

    let usuario = await findUserByLogin(login);
    if (!usuario || !(await verifyPassword(senha, usuario.senha))) {
      return res.status(401).json({ mensagem: 'Usuário ou senha inválidos.' });
    }

    if (needsPasswordRehash(usuario.senha)) {
      const atualizado = await upgradeUserPassword(usuario.id, usuario.senha, senha);
      if (!atualizado) {
        usuario = await findUserById(usuario.id);
        if (!usuario || !(await verifyPassword(senha, usuario.senha))) {
          return res.status(401).json({ mensagem: 'Usuário ou senha inválidos.' });
        }
      }
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
